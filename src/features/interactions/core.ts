import "server-only";
import { randomUUID } from "node:crypto";
import type { ServerSupabase } from "@/lib/supabase/server";
import { answerKeyOf, hasOptions, type ParsedInteractionInput } from "@/lib/domain/interactions";
import type { Json } from "@/lib/supabase/database.types";
import type { Arrangement } from "@/lib/domain/deck";
import { droppedImages, imageOwner } from "@/lib/domain/gamification";
import { optionImagesOf, removeUnusedOptionImages } from "@/lib/data/option-images";
import { fail, ok, type ActionResult } from "@/lib/action-result";

// Escrita de interações compartilhada pelas Server Actions do painel e pelo MCP.
// Recebe o cliente já autenticado (cookie do painel ou token OAuth): o RLS garante o dono.
// Erros saem como chaves da área "errors" (core.*): quem chama traduz com getMessageTranslator().

async function responseCount(supabase: ServerSupabase, interactionId: string): Promise<number> {
  const { count, error } = await supabase
    .from("responses")
    .select("id", { count: "exact", head: true })
    .eq("interaction_id", interactionId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Imagem de alternativa só da pasta do próprio speaker (as de outros poderiam sumir sem aviso). */
export function foreignImage(input: ParsedInteractionInput, speakerId: string): boolean {
  const optionImages = "options" in input ? input.options.map((o) => o.imagePath) : [];
  // Imagem da própria pergunta: "Marcar na imagem" e slide de conteúdo.
  const settingsImage = "imagePath" in input.settings ? input.settings.imagePath : null;
  return [...optionImages, settingsImage].some((path) => path && imageOwner(path) !== speakerId);
}

/** Colunas que vêm da entrada além de tipo e texto: gabarito privado e notas do palestrante. */
function extraColumns(input: ParsedInteractionInput) {
  const answerKey = answerKeyOf(input);
  return {
    answer_key: answerKey ? (answerKey as Json) : null,
    speaker_notes: input.notes || null,
  };
}

function optionRows(interactionId: string, input: ParsedInteractionInput) {
  if (!("options" in input)) return [];
  return input.options.map((o, index) => ({
    id: o.id ?? randomUUID(),
    interaction_id: interactionId,
    label: o.label,
    position: index,
    is_correct: input.type === "quiz" ? o.isCorrect : false,
    points: input.type === "quiz" && o.isCorrect ? o.points : 0,
    image_path: o.imagePath ?? null,
  }));
}

/** Cria a interação no fim do roteiro, com as alternativas. */
export async function createInteraction(
  supabase: ServerSupabase,
  sessionId: string,
  input: ParsedInteractionInput,
): Promise<ActionResult<{ id: string }>> {
  const { data: last, error: lastError } = await supabase
    .from("interactions")
    .select("position")
    .eq("session_id", sessionId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) return fail("core.interactionCreateFailed");

  const created = await supabase
    .from("interactions")
    .insert({
      type: input.type,
      title: input.title,
      description: input.description || null,
      settings: input.settings,
      ...extraColumns(input),
      session_id: sessionId,
      position: last ? last.position + 1 : 0,
    })
    .select("id")
    .single();
  if (created.error) return fail("core.interactionCreateFailed");

  const rows = optionRows(created.data.id, input);
  if (rows.length > 0) {
    const { error } = await supabase.from("interaction_options").insert(rows);
    if (error) {
      await supabase.from("interactions").delete().eq("id", created.data.id);
      return fail("core.optionsSaveFailed");
    }
  }
  return ok({ id: created.data.id });
}

/** Edita a interação. Com respostas já gravadas, tipo, alternativas e acerto ficam travados. */
export async function updateInteraction(
  supabase: ServerSupabase,
  sessionId: string,
  interactionId: string,
  input: ParsedInteractionInput,
): Promise<ActionResult<{ id: string }>> {
  const { data: existing, error: existingError } = await supabase
    .from("interactions")
    .select("*")
    .eq("id", interactionId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (existingError || !existing) return fail("core.interactionNotFound");

  const { data: currentOptions, error: optionsError } = await supabase
    .from("interaction_options")
    .select("*")
    .eq("interaction_id", interactionId);
  if (optionsError) return fail("core.optionsLoadFailed");

  const answered = (await responseCount(supabase, interactionId)) > 0;
  const rows = optionRows(interactionId, input);

  if (answered) {
    // Respostas guardam o id da opção e o acerto: estrutura precisa ficar estável.
    if (existing.type !== input.type) return fail("core.typeLocked");
    const currentIds = new Set(currentOptions.map((o) => o.id));
    const sameSet = rows.length === currentOptions.length && rows.every((r) => currentIds.has(r.id));
    if (!sameSet) return fail("core.optionsLocked");
    if (input.type === "quiz") {
      const before = currentOptions.find((o) => o.is_correct)?.id;
      const after = rows.find((r) => r.is_correct)?.id;
      if (before !== after) return fail("core.correctLocked");
    }
  }

  const { error: updateError } = await supabase
    .from("interactions")
    .update({
      type: input.type,
      title: input.title,
      description: input.description || null,
      settings: input.settings,
      ...extraColumns(input),
    })
    .eq("id", interactionId);
  if (updateError) return fail("core.interactionSaveFailed");

  const keepIds = new Set(rows.map((r) => r.id));
  const toDelete = currentOptions.filter((o) => !keepIds.has(o.id)).map((o) => o.id);
  if (toDelete.length > 0) {
    const { error } = await supabase.from("interaction_options").delete().in("id", toDelete);
    if (error) return fail("core.optionsUpdateFailed");
  }
  if (hasOptions(input.type) && rows.length > 0) {
    // Upsert numa única requisição: a constraint de posição é verificada no commit.
    const { error } = await supabase.from("interaction_options").upsert(rows, { onConflict: "id" });
    if (error) return fail("core.optionsUpdateFailed");
  }

  await removeUnusedOptionImages(
    supabase,
    droppedImages(
      currentOptions.map((o) => o.image_path),
      rows.map((r) => r.image_path),
    ),
  );
  return ok({ id: interactionId });
}

/** Grava a ordem do roteiro e o ponto do deck (depois de quantos slides) de cada interação. */
export async function saveArrangement(
  supabase: ServerSupabase,
  sessionId: string,
  arrangement: Arrangement,
): Promise<boolean> {
  const { error } = await supabase.rpc("arrange_interactions", {
    p_session_id: sessionId,
    p_ids: arrangement.ids,
    // O gerador de tipos não expressa elementos nulos em int[]; null = "no fim".
    p_after_slides: arrangement.afterSlides as number[],
  });
  return !error;
}

/**
 * Exclui uma interação (e as respostas dela). Só em sessão do próprio speaker que não foi encerrada:
 * apagar respostas de uma sessão encerrada mudaria analytics, ranking e os números públicos do perfil.
 */
export async function deleteInteraction(
  supabase: ServerSupabase,
  sessionId: string,
  interactionId: string,
): Promise<ActionResult> {
  const { data: session } = await supabase.from("sessions").select("status").eq("id", sessionId).maybeSingle();
  if (!session) return fail("core.interactionNotFound");
  if (session.status === "completed") return fail("core.sessionEnded");

  const { data: interaction } = await supabase
    .from("interactions")
    .select("id, is_active")
    .eq("id", interactionId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!interaction) return fail("core.interactionNotFound");
  if (interaction.is_active) return fail("core.interactionActive");

  const images = await optionImagesOf(supabase, { interactionId });
  const { error } = await supabase.from("interactions").delete().eq("id", interactionId);
  if (error) return fail("core.interactionDeleteFailed");
  await removeUnusedOptionImages(supabase, images);
  return ok(null);
}
