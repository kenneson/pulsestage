"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import { getOwnedSession } from "@/lib/data/sessions";
import { generateJoinCode } from "@/lib/domain/session";
import { isUniqueViolation } from "@/lib/supabase/errors";
import { fail, firstIssue, isUuid, ok, type ActionResult } from "@/lib/action-result";
import { removeSlideFiles, slidePaths, SLIDES_BUCKET } from "@/lib/data/slides";
import { isSlideFormat } from "@/lib/domain/deck";
import type { SessionRow } from "@/lib/supabase/types";

const MAX_COPY = 50;

/**
 * Copia interações (com alternativas, acerto e pontos do quiz) para o fim do roteiro de outra sessão.
 * O RLS garante que origem e destino são do speaker logado.
 * `keepDeckPosition`: ao duplicar a sessão, cada pergunta continua no mesmo ponto dos slides.
 */
async function copyInteractions(
  supabase: ServerSupabase,
  sourceIds: string[],
  targetSessionId: string,
  keepDeckPosition = false,
): Promise<number> {
  const { data: sources, error } = await supabase
    .from("interactions")
    .select("type, title, description, settings, position, after_slide, id, interaction_options(label, position, is_correct, points)")
    .in("id", sourceIds);
  if (error) throw new Error(error.message);
  if (sources.length === 0) return 0;

  // Mantém a ordem pedida (a da tela), não a do banco.
  const ordered = sourceIds.map((id) => sources.find((s) => s.id === id)).filter((s) => s !== undefined);

  const { data: last } = await supabase
    .from("interactions")
    .select("position")
    .eq("session_id", targetSessionId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const start = last ? last.position + 1 : 0;

  const rows = ordered.map((s, index) => ({
    id: randomUUID(),
    session_id: targetSessionId,
    type: s.type,
    title: s.title,
    description: s.description,
    settings: s.settings,
    position: start + index,
    after_slide: keepDeckPosition ? s.after_slide : null,
  }));
  const inserted = await supabase.from("interactions").insert(rows);
  if (inserted.error) throw new Error(inserted.error.message);

  const options = ordered.flatMap((s, index) =>
    s.interaction_options.map((o) => ({
      interaction_id: rows[index]!.id,
      label: o.label,
      position: o.position,
      is_correct: o.is_correct,
      points: o.points,
    })),
  );
  if (options.length > 0) {
    const insertedOptions = await supabase.from("interaction_options").insert(options);
    if (insertedOptions.error) {
      await supabase.from("interactions").delete().in("id", rows.map((r) => r.id));
      throw new Error(insertedOptions.error.message);
    }
  }
  return rows.length;
}

const copySchema = z.object({
  targetSessionId: z.uuid({ error: "Sessão inválida." }),
  interactionIds: z.array(z.uuid()).min(1, "Escolha pelo menos uma pergunta.").max(MAX_COPY, `No máximo ${MAX_COPY} por vez.`),
});

/** "Usar em uma sessão" / "Da biblioteca": copia perguntas para o fim do roteiro. */
export async function copyToSessionAction(raw: unknown): Promise<ActionResult<{ copied: number }>> {
  const parsed = copySchema.safeParse(raw);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { targetSessionId, interactionIds } = parsed.data;

  const supabase = await createClient();
  const target = await getOwnedSession(supabase, targetSessionId);
  if (!target) return fail("Sessão não encontrada.");
  if (target.status === "completed") return fail("Essa sessão já foi encerrada.");

  try {
    const copied = await copyInteractions(supabase, [...new Set(interactionIds)], targetSessionId);
    if (copied === 0) return fail("Perguntas não encontradas.");
    revalidatePath(`/dashboard/sessions/${targetSessionId}`, "layout");
    return ok({ copied });
  } catch {
    return fail("Não foi possível copiar as perguntas.");
  }
}

/** Copia os arquivos dos slides para um lote novo da sessão de destino e liga o deck a ela. */
async function copySlides(supabase: ServerSupabase, source: SessionRow, targetSessionId: string): Promise<void> {
  const from = slidePaths(source);
  if (from.length === 0 || !isSlideFormat(source.slides_format)) return;
  const batch = randomUUID();
  const target = { ...source, id: targetSessionId, slides_batch: batch };
  const to = slidePaths(target);
  const bucket = supabase.storage.from(SLIDES_BUCKET);
  for (let i = 0; i < from.length; i++) {
    const { error } = await bucket.copy(from[i]!, to[i]!);
    if (error) throw new Error(error.message);
  }
  const { error } = await supabase
    .from("sessions")
    .update({ slides_batch: batch, slide_count: source.slide_count, slides_format: source.slides_format })
    .eq("id", targetSessionId);
  if (error) throw new Error(error.message);
}

/** Nova sessão em rascunho com as mesmas informações, perguntas, slides e pesquisa. */
export async function duplicateSessionAction(sessionId: string): Promise<ActionResult> {
  if (!isUuid(sessionId)) return fail("Sessão inválida.");
  const supabase = await createClient();
  const source = await getOwnedSession(supabase, sessionId);
  if (!source) return fail("Sessão não encontrada.");

  let createdId: string | null = null;
  for (let attempt = 0; attempt < 4 && !createdId; attempt++) {
    const created = await supabase
      .from("sessions")
      .insert({
        speaker_id: source.speaker_id,
        title: `${source.title} (cópia)`.slice(0, 200),
        description: source.description,
        estimated_duration_minutes: source.estimated_duration_minutes,
        survey_template_id: source.survey_template_id,
        join_code: generateJoinCode(),
      })
      .select("id")
      .single();
    if (!created.error) createdId = created.data.id;
    else if (!isUniqueViolation(created.error)) return fail("Não foi possível duplicar a sessão.");
  }
  if (!createdId) return fail("Não foi possível gerar um código único. Tente novamente.");

  const { data: interactions } = await supabase
    .from("interactions")
    .select("id")
    .eq("session_id", sessionId)
    .order("position");
  try {
    if (interactions && interactions.length > 0) {
      await copyInteractions(supabase, interactions.map((i) => i.id), createdId, true);
    }
  } catch {
    await supabase.from("sessions").delete().eq("id", createdId);
    return fail("Não foi possível copiar as perguntas da sessão.");
  }
  try {
    await copySlides(supabase, source, createdId);
  } catch {
    await removeSlideFiles(supabase, `${source.speaker_id}/${createdId}`);
    await supabase.from("sessions").delete().eq("id", createdId);
    return fail("Não foi possível copiar os slides da sessão.");
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/sessions/${createdId}`);
}
