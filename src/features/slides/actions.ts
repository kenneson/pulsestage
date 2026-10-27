"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnedSession } from "@/lib/data/sessions";
import { randomUUID } from "node:crypto";
import { removeSlideFiles, slidePaths, SLIDES_BUCKET } from "@/lib/data/slides";
import { isSlideFormat, MAX_SLIDES, SLIDE_FORMATS, slidePath } from "@/lib/domain/deck";
import {
  isIdentityOrder,
  isSlideOrder,
  reorderInteractions,
  reorderSlideNotes,
  slideOrderSchema,
} from "@/lib/domain/slide-order";
import { saveArrangement } from "@/features/interactions/core";
import { isEditable } from "@/lib/domain/session";
import { slideNoteInputSchema, withSlideNote } from "@/lib/domain/slide-notes";
import { hasDbErrorCode } from "@/lib/supabase/errors";
import { messageKey } from "@/lib/domain/message-key";
import { getMessageTranslator } from "@/i18n/server";
import { fail, isUuid, ok, type ActionResult } from "@/lib/action-result";

function revalidateSession(sessionId: string) {
  revalidatePath(`/dashboard/sessions/${sessionId}`, "layout");
}

// Mensagens são chaves de tradução completas (traduzidas com getMessageTranslator()).
const deckSchema = z.object({
  batch: z.uuid({ error: "session.slides.errors.invalidUpload" }),
  count: z
    .number()
    .int()
    .min(1, "session.slides.errors.noPages")
    .max(MAX_SLIDES, messageKey("session.slides.errors.maxSlides", { max: MAX_SLIDES })),
  format: z.enum(SLIDE_FORMATS),
});

/**
 * Passa a usar os slides de um envio. O navegador já converteu o PDF e gravou as imagens em
 * {speaker}/{sessão}/{lote}/; aqui conferimos que todas chegaram e trocamos o deck da sessão.
 */
export async function saveSlidesAction(sessionId: string, raw: unknown): Promise<ActionResult<{ count: number }>> {
  const [t, tSession] = await Promise.all([
    getTranslations("session.slides.errors"),
    getTranslations("session.errors"),
  ]);
  const parsed = deckSchema.safeParse(raw);
  if (!isUuid(sessionId)) return fail(tSession("invalidSession"));
  if (!parsed.success) return fail((await getMessageTranslator()).issue(parsed.error));
  const { batch, count, format } = parsed.data;

  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return fail(tSession("sessionNotFound"));
  if (!isEditable(session.status)) return fail(tSession("sessionEnded"));

  const folder = `${session.speaker_id}/${sessionId}`;
  const { data: files, error: listError } = await supabase.storage
    .from(SLIDES_BUCKET)
    .list(`${folder}/${batch}`, { limit: 1000 });
  if (listError) return fail(t("verifyFailed"));
  const uploaded = new Set(files.map((f) => `${folder}/${batch}/${f.name}`));
  const expected = Array.from({ length: count }, (_, i) => slidePath(session.speaker_id, sessionId, batch, i, format));
  if (!expected.every((path) => uploaded.has(path))) return fail(t("incompleteUpload"));

  const { error } = await supabase
    .from("sessions")
    .update({ slides_batch: batch, slide_count: count, slides_format: format })
    .eq("id", sessionId);
  if (error) return fail(t("saveFailed"));

  // O deck anterior e envios interrompidos deixam de ser usados.
  await removeSlideFiles(supabase, folder, batch);

  revalidateSession(sessionId);
  return ok({ count });
}

export async function removeSlidesAction(sessionId: string): Promise<ActionResult> {
  const [t, tSession] = await Promise.all([
    getTranslations("session.slides.errors"),
    getTranslations("session.errors"),
  ]);
  if (!isUuid(sessionId)) return fail(tSession("invalidSession"));
  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return fail(tSession("sessionNotFound"));
  if (!isEditable(session.status)) return fail(tSession("sessionEnded"));

  // As posições das perguntas (after_slide) ficam guardadas: valem de novo se outro PDF for enviado.
  const { error } = await supabase
    .from("sessions")
    .update({ slides_batch: null, slide_count: 0, slides_format: null })
    .eq("id", sessionId);
  if (error) return fail(t("removeFailed"));

  await removeSlideFiles(supabase, `${session.speaker_id}/${sessionId}`);
  revalidateSession(sessionId);
  return ok(null);
}

const COPY_CONCURRENCY = 6;

/**
 * Nova ordem dos slides (só em rascunho: ao vivo, telão e sala já têm as URLs do deck atual).
 * Os arquivos são copiados para um lote novo, já na ordem nova; assim telão, sala ao vivo, duplicar e MCP
 * continuam lendo 001, 002… sem saber de reordenação. Perguntas e notas acompanham o slide.
 */
export async function reorderSlidesAction(sessionId: string, raw: unknown): Promise<ActionResult> {
  const [t, tSession, tr] = await Promise.all([
    getTranslations("session.slides.errors"),
    getTranslations("session.errors"),
    getMessageTranslator(),
  ]);
  if (!isUuid(sessionId)) return fail(tSession("invalidSession"));
  const parsed = slideOrderSchema.safeParse(raw);
  if (!parsed.success) return fail(tr.message("errors.invalidData"));
  const order = parsed.data;

  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return fail(tSession("sessionNotFound"));
  if (session.status !== "draft") return fail(t("reorderOnlyDraft"));
  if (!session.slides_batch || !isSlideFormat(session.slides_format) || !isSlideOrder(order, session.slide_count)) {
    return fail(t("reorderInvalid"));
  }
  if (isIdentityOrder(order)) return ok(null);

  const { data: rows, error: readError } = await supabase
    .from("interactions")
    .select("id, after_slide")
    .eq("session_id", sessionId)
    .order("position", { ascending: true });
  if (readError) return fail(t("reorderFailed"));

  // 1. Copia para o lote novo (nada muda para quem usa a sessão até o passo 3).
  const batch = randomUUID();
  const from = slidePaths(session);
  const to = slidePaths({ ...session, slides_batch: batch });
  const bucket = supabase.storage.from(SLIDES_BUCKET);
  const folder = `${session.speaker_id}/${sessionId}`;
  const queue = order.map((slide, index) => ({ from: from[slide - 1]!, to: to[index]! }));
  let copyFailed = false;
  const worker = async () => {
    for (let next = queue.shift(); next && !copyFailed; next = queue.shift()) {
      const { error } = await bucket.copy(next.from, next.to);
      if (error) copyFailed = true;
    }
  };
  await Promise.all(Array.from({ length: COPY_CONCURRENCY }, worker));
  if (copyFailed) {
    await bucket.remove(to);
    return fail(t("reorderFailed"));
  }

  // 2. Perguntas seguem o seu slide.
  const before = { ids: rows.map((r) => r.id), afterSlides: rows.map((r) => r.after_slide) };
  const arrangement = reorderInteractions(
    rows.map((r) => ({ id: r.id, afterSlide: r.after_slide })),
    order,
  );
  if (rows.length > 0 && !(await saveArrangement(supabase, sessionId, arrangement))) {
    await bucket.remove(to);
    return fail(t("reorderFailed"));
  }

  // 3. Troca o deck e as notas de uma vez.
  const { error } = await supabase
    .from("sessions")
    .update({ slides_batch: batch, slide_notes: reorderSlideNotes(session.slide_notes, order) })
    .eq("id", sessionId);
  if (error) {
    if (rows.length > 0) await saveArrangement(supabase, sessionId, before);
    await bucket.remove(to);
    return fail(t("reorderFailed"));
  }

  await removeSlideFiles(supabase, folder, batch);
  revalidateSession(sessionId);
  return ok(null);
}

/**
 * Nota do palestrante de um slide (só ele vê, na sala ao vivo). Texto vazio apaga a nota.
 * Vale também durante a sessão ao vivo; depois de encerrada, não muda mais.
 */
export async function saveSlideNoteAction(
  sessionId: string,
  raw: unknown,
): Promise<ActionResult<{ notes: Record<string, string> }>> {
  const [t, tSession, tr] = await Promise.all([
    getTranslations("session.slides.errors"),
    getTranslations("session.errors"),
    getMessageTranslator(),
  ]);
  if (!isUuid(sessionId)) return fail(tSession("invalidSession"));
  const parsed = slideNoteInputSchema.safeParse(raw);
  if (!parsed.success) return fail(tr.issue(parsed.error));
  const { slide, text } = parsed.data;

  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return fail(tSession("sessionNotFound"));
  if (!isEditable(session.status)) return fail(tSession("sessionEnded"));
  if (slide > session.slide_count) return fail(t("slideNotFound"));

  const notes = withSlideNote(session.slide_notes, slide, text);
  const { error } = await supabase.from("sessions").update({ slide_notes: notes }).eq("id", sessionId);
  if (error) return fail(tr.message("session.slides.errors.noteSaveFailed"));

  revalidateSession(sessionId);
  return ok({ notes });
}

/** Mostra um slide no telão (encerrando a pergunta ativa) ou, com `slide` null, o QR Code. */
export async function showSlideAction(sessionId: string, slide: number | null): Promise<ActionResult> {
  const t = await getTranslations("session.slides.errors");
  const parsed = z.number().int().min(0).max(MAX_SLIDES).nullable().safeParse(slide);
  if (!isUuid(sessionId) || !parsed.success) return fail((await getTranslations("errors"))("invalidData"));

  const supabase = await createClient();
  const { error } = await supabase.rpc("show_slide", {
    p_session_id: sessionId,
    ...(parsed.data === null ? {} : { p_slide: parsed.data }),
  });
  if (error) {
    if (hasDbErrorCode(error, "session_not_live")) return fail(t("notLive"));
    if (hasDbErrorCode(error, "slide_not_found")) return fail(t("slideNotFound"));
    return fail(t("changeFailed"));
  }
  return ok(null);
}
