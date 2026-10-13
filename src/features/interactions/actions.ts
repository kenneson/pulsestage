"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOwnedSession } from "@/lib/data/sessions";
import { hasDbErrorCode } from "@/lib/supabase/errors";
import { interactionInputSchema, type ParsedInteractionInput } from "@/lib/domain/interactions";
import { insertAfterItem, MAX_SLIDES } from "@/lib/domain/deck";
import { optionImagesOf, removeUnusedOptionImages } from "@/lib/data/option-images";
import { createInteraction, foreignImage, updateInteraction } from "./core";
import { aiConfigProblem, getAIProvider, suggestInteractions } from "@/lib/ai";
import { AIProviderError } from "@/lib/ai/types";
import { fail, firstIssue, isUuid, ok, type ActionResult } from "@/lib/action-result";

function revalidateSession(sessionId: string) {
  revalidatePath(`/dashboard/sessions/${sessionId}`, "layout");
}

export async function saveInteractionAction(
  sessionId: string,
  interactionId: string | null,
  rawInput: unknown,
): Promise<ActionResult<{ id: string }>> {
  if (!isUuid(sessionId) || (interactionId !== null && !isUuid(interactionId))) return fail("Dados inválidos.");

  const parsed = interactionInputSchema.safeParse(rawInput);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const input = parsed.data;

  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return fail("Sessão não encontrada.");
  if (session.status === "completed") return fail("A sessão já foi encerrada.");
  if (foreignImage(input, session.speaker_id)) return fail("Imagem inválida.");

  const saved =
    interactionId === null
      ? await createInteraction(supabase, sessionId, input)
      : await updateInteraction(supabase, sessionId, interactionId, input);
  if (!saved.ok) return saved;
  revalidateSession(sessionId);
  return saved;
}

// ponytail: limite em memória, por instância do servidor; mover para o banco se o custo da IA pesar.
const SUGGEST_INTERVAL_MS = 8_000;
const lastSuggestion = new Map<string, number>();
const avoidSchema = z.array(z.string().max(300)).max(40);

export async function suggestInteractionsAction(
  sessionId: string,
  rawAvoid: unknown,
): Promise<ActionResult<{ suggestions: ParsedInteractionInput[] }>> {
  const avoid = avoidSchema.safeParse(rawAvoid);
  if (!isUuid(sessionId) || !avoid.success) return fail("Dados inválidos.");

  const provider = getAIProvider();
  if (!provider) return fail(`A IA não está configurada. ${aiConfigProblem() ?? ""}`.trim(), "not_configured");

  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return fail("Sessão não encontrada.");
  if (session.status === "completed") return fail("A sessão já foi encerrada.");

  const last = lastSuggestion.get(session.speaker_id) ?? 0;
  if (Date.now() - last < SUGGEST_INTERVAL_MS) return fail("Aguarde alguns segundos antes de gerar de novo.");
  lastSuggestion.set(session.speaker_id, Date.now());

  const { data: existing, error } = await supabase.from("interactions").select("title").eq("session_id", sessionId);
  if (error) return fail("Não foi possível carregar o roteiro.");

  try {
    const suggestions = await suggestInteractions(provider, {
      title: session.title,
      description: session.description,
      durationMinutes: session.estimated_duration_minutes,
      existing: existing.map((i) => i.title),
      avoid: avoid.data,
    });
    return ok({ suggestions });
  } catch (e) {
    return fail(e instanceof AIProviderError ? e.message : "Falha ao gerar sugestões.");
  }
}

export async function deleteInteractionAction(sessionId: string, interactionId: string): Promise<ActionResult> {
  if (!isUuid(sessionId) || !isUuid(interactionId)) return fail("Dados inválidos.");
  const supabase = await createClient();

  const { data: interaction } = await supabase
    .from("interactions")
    .select("id, is_active")
    .eq("id", interactionId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!interaction) return fail("Interação não encontrada.");
  if (interaction.is_active) return fail("Encerre a interação antes de excluí-la.");

  const images = await optionImagesOf(supabase, { interactionId });
  const { error } = await supabase.from("interactions").delete().eq("id", interactionId);
  if (error) return fail("Não foi possível excluir a interação.");
  await removeUnusedOptionImages(supabase, images);

  revalidateSession(sessionId);
  return ok(null);
}

const arrangementSchema = z
  .object({
    ids: z.array(z.uuid()).max(200),
    afterSlides: z.array(z.number().int().min(0).nullable()).max(200),
  })
  .refine((a) => a.ids.length === a.afterSlides.length);

/** Nova ordem do roteiro e o ponto do deck (depois de quantos slides) de cada interação. */
export async function arrangeInteractionsAction(sessionId: string, raw: unknown): Promise<ActionResult> {
  const parsed = arrangementSchema.safeParse(raw);
  if (!isUuid(sessionId) || !parsed.success) return fail("Dados inválidos.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("arrange_interactions", {
    p_session_id: sessionId,
    p_ids: parsed.data.ids,
    // O gerador de tipos não expressa elementos nulos em int[]; null = "no fim".
    p_after_slides: parsed.data.afterSlides as number[],
  });
  if (error) return fail("Não foi possível reordenar.");

  revalidateSession(sessionId);
  return ok(null);
}

export async function setActiveInteractionAction(
  sessionId: string,
  interactionId: string | null,
): Promise<ActionResult> {
  if (!isUuid(sessionId) || (interactionId !== null && !isUuid(interactionId))) return fail("Dados inválidos.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_active_interaction", {
    p_session_id: sessionId,
    ...(interactionId ? { p_interaction_id: interactionId } : {}),
  });

  if (error) {
    if (hasDbErrorCode(error, "session_not_live")) return fail("Inicie ou retome a sessão para ativar interações.");
    if (hasDbErrorCode(error, "interaction_not_found")) return fail("Interação não encontrada.");
    return fail("Não foi possível alterar a interação ativa.");
  }
  return ok(null);
}

const deckItemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("slide"), index: z.number().int().min(0).max(MAX_SLIDES) }),
  z.object({ kind: z.literal("interaction"), id: z.uuid() }),
]);

const livePlacementSchema = z.object({
  /** o que está (ou esteve por último) no telão; a pergunta nova entra logo depois */
  after: deckItemSchema.nullable(),
  launch: z.boolean(),
});

/**
 * "Nova pergunta" na sala ao vivo: cria, coloca logo depois do ponto atual da apresentação
 * (vira a próxima) e, com `launch`, já abre para a plateia.
 * Falha com código "created" quando a pergunta já existe mas um passo seguinte falhou (não criar de novo).
 */
export async function addLiveInteractionAction(
  sessionId: string,
  rawInput: unknown,
  rawPlacement: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = interactionInputSchema.safeParse(rawInput);
  const placement = livePlacementSchema.safeParse(rawPlacement);
  if (!isUuid(sessionId) || !placement.success) return fail("Dados inválidos.");
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return fail("Sessão não encontrada.");
  if (session.status === "completed") return fail("A sessão já foi encerrada.");
  if (placement.data.launch && session.status !== "live") return fail("Retome a sessão para lançar a pergunta.");
  if (foreignImage(parsed.data, session.speaker_id)) return fail("Imagem inválida.");

  const created = await createInteraction(supabase, sessionId, parsed.data);
  if (!created.ok) return created;
  const id = created.data.id;
  revalidateSession(sessionId);

  const { data: rows, error: rowsError } = await supabase
    .from("interactions")
    .select("id, after_slide")
    .eq("session_id", sessionId)
    .order("position");
  if (rowsError) return fail("A pergunta foi criada no fim do roteiro, mas não foi possível posicioná-la.", "created");
  const arrangement = insertAfterItem(
    rows.map((r) => ({ id: r.id, afterSlide: r.after_slide })),
    id,
    placement.data.after,
    session.slide_count,
  );
  const { error: arrangeError } = await supabase.rpc("arrange_interactions", {
    p_session_id: sessionId,
    p_ids: arrangement.ids,
    // O gerador de tipos não expressa elementos nulos em int[]; null = "no fim".
    p_after_slides: arrangement.afterSlides as number[],
  });
  if (arrangeError) return fail("A pergunta foi criada no fim do roteiro, mas não foi possível posicioná-la.", "created");

  if (placement.data.launch) {
    const { error } = await supabase.rpc("set_active_interaction", { p_session_id: sessionId, p_interaction_id: id });
    if (error) return fail("A pergunta foi criada como a próxima, mas não foi possível lançá-la.", "created");
  }
  return ok({ id });
}
