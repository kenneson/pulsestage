import "server-only";
import { randomUUID } from "node:crypto";
import type { ServerSupabase } from "@/lib/supabase/server";
import { generateJoinCode } from "@/lib/domain/session";
import { isUniqueViolation } from "@/lib/supabase/errors";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { removeSlideFiles, slidePaths, SLIDES_BUCKET } from "@/lib/data/slides";
import { isSlideFormat } from "@/lib/domain/deck";
import type { SessionRow } from "@/lib/supabase/types";

// Cópia de sessões e perguntas, usada por "Duplicar", "Usar em uma sessão" e pelo ensaio ("Testar").
// Erros saem como chaves completas (builder.library.errors.*, core.*): quem chama traduz.

/**
 * Copia interações (com alternativas, acerto e pontos do quiz) para o fim do roteiro de outra sessão.
 * O RLS garante que origem e destino são do speaker logado.
 * `keepDeckPosition`: ao duplicar a sessão, cada pergunta continua no mesmo ponto dos slides.
 */
export async function copyInteractions(
  supabase: ServerSupabase,
  sourceIds: string[],
  targetSessionId: string,
  keepDeckPosition = false,
): Promise<number> {
  const { data: sources, error } = await supabase
    .from("interactions")
    .select("type, title, description, settings, position, after_slide, id, interaction_options(label, position, is_correct, points, image_path)")
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
      // Mesmo arquivo: só é apagado quando nenhuma alternativa usa mais.
      image_path: o.image_path,
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

export type CloneOptions = {
  title: string;
  scheduledAt: string | null;
  /** Ensaio: sessão de teste ligada à original (fora de listas, estatísticas e perfil público). */
  rehearsalOf?: string;
};

/**
 * Nova sessão em rascunho com as mesmas informações, perguntas, slides, pesquisa e prêmios do sorteio
 * (sem respostas, números nem ganhadores).
 */
export async function cloneSession(
  supabase: ServerSupabase,
  source: SessionRow,
  options: CloneOptions,
): Promise<ActionResult<{ id: string }>> {
  let createdId: string | null = null;
  for (let attempt = 0; attempt < 4 && !createdId; attempt++) {
    const created = await supabase
      .from("sessions")
      .insert({
        speaker_id: source.speaker_id,
        title: options.title,
        scheduled_at: options.scheduledAt,
        description: source.description,
        estimated_duration_minutes: source.estimated_duration_minutes,
        survey_template_id: source.survey_template_id,
        raffle_eligibility: source.raffle_eligibility,
        qa_enabled: source.qa_enabled,
        qa_moderated: source.qa_moderated,
        reactions_enabled: source.reactions_enabled,
        profanity_filter: source.profanity_filter,
        moderate_open_text: source.moderate_open_text,
        locale: source.locale,
        is_test: Boolean(options.rehearsalOf),
        rehearsal_of: options.rehearsalOf ?? null,
        join_code: generateJoinCode(),
      })
      .select("id")
      .single();
    if (!created.error) createdId = created.data.id;
    else if (!isUniqueViolation(created.error)) return fail("builder.library.errors.duplicateFailed");
  }
  if (!createdId) return fail("core.joinCodeExhausted");

  const { data: interactions } = await supabase
    .from("interactions")
    .select("id")
    .eq("session_id", source.id)
    .order("position");
  try {
    if (interactions && interactions.length > 0) {
      await copyInteractions(supabase, interactions.map((i) => i.id), createdId, true);
    }
  } catch {
    await supabase.from("sessions").delete().eq("id", createdId);
    return fail("builder.library.errors.copyQuestionsFailed");
  }
  const { data: prizes } = await supabase
    .from("raffle_prizes")
    .select("position, name, description, kind, quantity, winner_message")
    .eq("session_id", source.id);
  if (prizes && prizes.length > 0) {
    const copied = await supabase.from("raffle_prizes").insert(prizes.map((p) => ({ ...p, session_id: createdId })));
    if (copied.error) {
      await supabase.from("sessions").delete().eq("id", createdId);
      return fail("builder.library.errors.copyPrizesFailed");
    }
  }
  try {
    await copySlides(supabase, source, createdId);
  } catch {
    await removeSlideFiles(supabase, `${source.speaker_id}/${createdId}`);
    await supabase.from("sessions").delete().eq("id", createdId);
    return fail("builder.library.errors.copySlidesFailed");
  }
  return ok({ id: createdId });
}
