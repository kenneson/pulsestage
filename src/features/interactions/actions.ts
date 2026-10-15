"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnedSession } from "@/lib/data/sessions";
import { hasDbErrorCode } from "@/lib/supabase/errors";
import { interactionInputSchema, type ParsedInteractionInput } from "@/lib/domain/interactions";
import { insertAfterItem, MAX_SLIDES } from "@/lib/domain/deck";
import { optionImagesOf, removeUnusedOptionImages } from "@/lib/data/option-images";
import { createInteraction, foreignImage, updateInteraction } from "./core";
import { getAIProvider, suggestInteractions } from "@/lib/ai";
import { localeOrDefault } from "@/lib/domain/locale";
import { fail, isUuid, ok, type ActionResult } from "@/lib/action-result";
import { getMessageTranslator } from "@/i18n/server";

function revalidateSession(sessionId: string) {
  revalidatePath(`/dashboard/sessions/${sessionId}`, "layout");
}

export async function saveInteractionAction(
  sessionId: string,
  interactionId: string | null,
  rawInput: unknown,
): Promise<ActionResult<{ id: string }>> {
  const [tr, t] = await Promise.all([getMessageTranslator(), getTranslations("builder.errors")]);
  if (!isUuid(sessionId) || (interactionId !== null && !isUuid(interactionId))) return fail(tr.message("errors.invalidData"));

  const parsed = interactionInputSchema.safeParse(rawInput);
  if (!parsed.success) return fail(tr.issue(parsed.error));
  const input = parsed.data;

  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return fail(t("sessionNotFound"));
  if (session.status === "completed") return fail(t("sessionEnded"));
  if (foreignImage(input, session.speaker_id)) return fail(tr.message("validation.invalidImage"));

  const saved =
    interactionId === null
      ? await createInteraction(supabase, sessionId, input)
      : await updateInteraction(supabase, sessionId, interactionId, input);
  if (!saved.ok) return fail(tr.message(saved.error), saved.code);
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
  const [tr, t] = await Promise.all([getMessageTranslator(), getTranslations("builder.errors")]);
  const avoid = avoidSchema.safeParse(rawAvoid);
  if (!isUuid(sessionId) || !avoid.success) return fail(tr.message("errors.invalidData"));

  // O detalhe de aiConfigProblem() é em português (fica para a análise); aqui vai a mensagem traduzida.
  const provider = getAIProvider();
  if (!provider) return fail(t("aiNotConfigured"), "not_configured");

  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return fail(t("sessionNotFound"));
  if (session.status === "completed") return fail(t("sessionEnded"));

  const last = lastSuggestion.get(session.speaker_id) ?? 0;
  if (Date.now() - last < SUGGEST_INTERVAL_MS) return fail(t("tooSoon"));
  lastSuggestion.set(session.speaker_id, Date.now());

  const { data: existing, error } = await supabase.from("interactions").select("title").eq("session_id", sessionId);
  if (error) return fail(t("lineupLoadFailed"));

  try {
    const suggestions = await suggestInteractions(
      provider,
      {
        title: session.title,
        description: session.description,
        durationMinutes: session.estimated_duration_minutes,
        existing: existing.map((i) => i.title),
        avoid: avoid.data,
      },
      localeOrDefault(session.locale),
    );
    return ok({ suggestions });
  } catch {
    // AIProviderError traz texto em português: mostra a mensagem genérica no idioma do painel.
    return fail(t("suggestFailed"));
  }
}

export async function deleteInteractionAction(sessionId: string, interactionId: string): Promise<ActionResult> {
  const [tr, t] = await Promise.all([getMessageTranslator(), getTranslations("builder.errors")]);
  if (!isUuid(sessionId) || !isUuid(interactionId)) return fail(tr.message("errors.invalidData"));
  const supabase = await createClient();

  const { data: interaction } = await supabase
    .from("interactions")
    .select("id, is_active")
    .eq("id", interactionId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!interaction) return fail(tr.message("core.interactionNotFound"));
  if (interaction.is_active) return fail(t("endBeforeDelete"));

  const images = await optionImagesOf(supabase, { interactionId });
  const { error } = await supabase.from("interactions").delete().eq("id", interactionId);
  if (error) return fail(t("deleteFailed"));
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
  const [tr, t] = await Promise.all([getMessageTranslator(), getTranslations("builder.errors")]);
  const parsed = arrangementSchema.safeParse(raw);
  if (!isUuid(sessionId) || !parsed.success) return fail(tr.message("errors.invalidData"));

  const supabase = await createClient();
  const { error } = await supabase.rpc("arrange_interactions", {
    p_session_id: sessionId,
    p_ids: parsed.data.ids,
    // O gerador de tipos não expressa elementos nulos em int[]; null = "no fim".
    p_after_slides: parsed.data.afterSlides as number[],
  });
  if (error) return fail(t("reorderFailed"));

  revalidateSession(sessionId);
  return ok(null);
}

export async function setActiveInteractionAction(
  sessionId: string,
  interactionId: string | null,
): Promise<ActionResult> {
  const [tr, t] = await Promise.all([getMessageTranslator(), getTranslations("builder.errors")]);
  if (!isUuid(sessionId) || (interactionId !== null && !isUuid(interactionId))) return fail(tr.message("errors.invalidData"));

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_active_interaction", {
    p_session_id: sessionId,
    ...(interactionId ? { p_interaction_id: interactionId } : {}),
  });

  if (error) {
    if (hasDbErrorCode(error, "session_not_live")) return fail(t("startToActivate"));
    if (hasDbErrorCode(error, "interaction_not_found")) return fail(tr.message("core.interactionNotFound"));
    return fail(t("activeChangeFailed"));
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
  const [tr, t] = await Promise.all([getMessageTranslator(), getTranslations("builder.errors")]);
  const parsed = interactionInputSchema.safeParse(rawInput);
  const placement = livePlacementSchema.safeParse(rawPlacement);
  if (!isUuid(sessionId) || !placement.success) return fail(tr.message("errors.invalidData"));
  if (!parsed.success) return fail(tr.issue(parsed.error));

  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return fail(t("sessionNotFound"));
  if (session.status === "completed") return fail(t("sessionEnded"));
  if (placement.data.launch && session.status !== "live") return fail(t("resumeToLaunch"));
  if (foreignImage(parsed.data, session.speaker_id)) return fail(tr.message("validation.invalidImage"));

  const created = await createInteraction(supabase, sessionId, parsed.data);
  if (!created.ok) return fail(tr.message(created.error), created.code);
  const id = created.data.id;
  revalidateSession(sessionId);

  const { data: rows, error: rowsError } = await supabase
    .from("interactions")
    .select("id, after_slide")
    .eq("session_id", sessionId)
    .order("position");
  if (rowsError) return fail(t("createdNotPlaced"), "created");
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
  if (arrangeError) return fail(t("createdNotPlaced"), "created");

  if (placement.data.launch) {
    const { error } = await supabase.rpc("set_active_interaction", { p_session_id: sessionId, p_interaction_id: id });
    if (error) return fail(t("createdNotLaunched"), "created");
  }
  return ok({ id });
}
