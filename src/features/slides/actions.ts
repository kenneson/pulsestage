"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOwnedSession } from "@/lib/data/sessions";
import { removeSlideFiles, SLIDES_BUCKET } from "@/lib/data/slides";
import { MAX_SLIDES, SLIDE_FORMATS, slidePath } from "@/lib/domain/deck";
import { hasDbErrorCode } from "@/lib/supabase/errors";
import { fail, firstIssue, isUuid, ok, type ActionResult } from "@/lib/action-result";

function revalidateSession(sessionId: string) {
  revalidatePath(`/dashboard/sessions/${sessionId}`, "layout");
}

const deckSchema = z.object({
  batch: z.uuid({ error: "Envio inválido." }),
  count: z.number().int().min(1, "O PDF não tem páginas.").max(MAX_SLIDES, `No máximo ${MAX_SLIDES} slides.`),
  format: z.enum(SLIDE_FORMATS),
});

/**
 * Passa a usar os slides de um envio. O navegador já converteu o PDF e gravou as imagens em
 * {speaker}/{sessão}/{lote}/; aqui conferimos que todas chegaram e trocamos o deck da sessão.
 */
export async function saveSlidesAction(sessionId: string, raw: unknown): Promise<ActionResult<{ count: number }>> {
  const parsed = deckSchema.safeParse(raw);
  if (!isUuid(sessionId)) return fail("Sessão inválida.");
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { batch, count, format } = parsed.data;

  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return fail("Sessão não encontrada.");
  if (session.status === "completed") return fail("A sessão já foi encerrada.");

  const folder = `${session.speaker_id}/${sessionId}`;
  const { data: files, error: listError } = await supabase.storage
    .from(SLIDES_BUCKET)
    .list(`${folder}/${batch}`, { limit: 1000 });
  if (listError) return fail("Não foi possível conferir os slides enviados.");
  const uploaded = new Set(files.map((f) => `${folder}/${batch}/${f.name}`));
  const expected = Array.from({ length: count }, (_, i) => slidePath(session.speaker_id, sessionId, batch, i, format));
  if (!expected.every((path) => uploaded.has(path))) return fail("Alguns slides não terminaram de enviar. Tente de novo.");

  const { error } = await supabase
    .from("sessions")
    .update({ slides_batch: batch, slide_count: count, slides_format: format })
    .eq("id", sessionId);
  if (error) return fail("Não foi possível salvar os slides.");

  // O deck anterior e envios interrompidos deixam de ser usados.
  await removeSlideFiles(supabase, folder, batch);

  revalidateSession(sessionId);
  return ok({ count });
}

export async function removeSlidesAction(sessionId: string): Promise<ActionResult> {
  if (!isUuid(sessionId)) return fail("Sessão inválida.");
  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return fail("Sessão não encontrada.");
  if (session.status === "completed") return fail("A sessão já foi encerrada.");

  // As posições das perguntas (after_slide) ficam guardadas: valem de novo se outro PDF for enviado.
  const { error } = await supabase
    .from("sessions")
    .update({ slides_batch: null, slide_count: 0, slides_format: null })
    .eq("id", sessionId);
  if (error) return fail("Não foi possível remover os slides.");

  await removeSlideFiles(supabase, `${session.speaker_id}/${sessionId}`);
  revalidateSession(sessionId);
  return ok(null);
}

/** Mostra um slide no telão (encerrando a pergunta ativa) ou, com `slide` null, o QR Code. */
export async function showSlideAction(sessionId: string, slide: number | null): Promise<ActionResult> {
  const parsed = z.number().int().min(0).max(MAX_SLIDES).nullable().safeParse(slide);
  if (!isUuid(sessionId) || !parsed.success) return fail("Dados inválidos.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("show_slide", {
    p_session_id: sessionId,
    ...(parsed.data === null ? {} : { p_slide: parsed.data }),
  });
  if (error) {
    if (hasDbErrorCode(error, "session_not_live")) return fail("Inicie ou retome a sessão para mostrar slides.");
    if (hasDbErrorCode(error, "slide_not_found")) return fail("Slide não encontrado.");
    return fail("Não foi possível mudar o slide.");
  }
  return ok(null);
}
