"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnedSession } from "@/lib/data/sessions";
import { removeSlideFiles, SLIDES_BUCKET } from "@/lib/data/slides";
import { MAX_SLIDES, SLIDE_FORMATS, slidePath } from "@/lib/domain/deck";
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
  if (session.status === "completed") return fail(tSession("sessionEnded"));

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
  if (session.status === "completed") return fail(tSession("sessionEnded"));

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
