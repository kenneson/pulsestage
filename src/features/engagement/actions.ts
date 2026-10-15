"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { hasDbErrorCode } from "@/lib/supabase/errors";
import { fail, isUuid, ok, type ActionResult } from "@/lib/action-result";
import { getModerationQueue, listSessionQuestions, type ModerationQueue, type SpeakerQuestion } from "@/lib/data/engagement";
import { tallyReactions, type ReactionTally } from "@/lib/domain/reactions";
import type { Messages } from "../../../messages/pt-BR";

// Perguntas da plateia, moderação e reações: ações do palestrante (cliente dele, RLS e funções do banco
// que conferem o dono da sessão).

/** Mensagem de erro no idioma do painel: chave de "live.errors" ou, sem chave, "Dados inválidos.". */
async function failWith(key?: keyof Messages["live"]["errors"]) {
  if (!key) return fail((await getTranslations("errors"))("invalidData"));
  return fail((await getTranslations("live.errors"))(key));
}

export async function listQuestionsAction(sessionId: string): Promise<ActionResult<SpeakerQuestion[]>> {
  if (!isUuid(sessionId)) return failWith();
  const supabase = await createClient();
  try {
    return ok(await listSessionQuestions(supabase, sessionId));
  } catch {
    return failWith("questionsLoadFailed");
  }
}

const moderationStatusSchema = z.enum(["visible", "answered", "hidden"]);

export async function moderateQuestionAction(questionId: string, status: string): Promise<ActionResult> {
  const parsed = moderationStatusSchema.safeParse(status);
  if (!isUuid(questionId) || !parsed.success) return failWith();
  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_question", { p_question_id: questionId, p_status: parsed.data });
  if (error) return failWith("questionUpdateFailed");
  return ok(null);
}

/** Lista das mais curtidas (questionId null) ou uma pergunta em destaque no telão; show false tira. */
export async function showQuestionsAction(sessionId: string, show: boolean, questionId: string | null): Promise<ActionResult> {
  if (!isUuid(sessionId) || typeof show !== "boolean" || (questionId !== null && !isUuid(questionId))) {
    return failWith();
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("show_questions", {
    p_session_id: sessionId,
    p_show: show,
    ...(questionId ? { p_question_id: questionId } : {}),
  });
  if (error) {
    if (hasDbErrorCode(error, "session_not_live")) return failWith("screenNotLive");
    if (hasDbErrorCode(error, "question_not_found")) return failWith("questionNotOpen");
    return failWith("screenFailed");
  }
  return ok(null);
}

export async function moderationQueueAction(interactionId: string): Promise<ActionResult<ModerationQueue>> {
  if (!isUuid(interactionId)) return failWith();
  const supabase = await createClient();
  try {
    return ok(await getModerationQueue(supabase, interactionId));
  } catch {
    return failWith("moderationLoadFailed");
  }
}

export async function moderateResponseAction(responseId: string, visible: boolean): Promise<ActionResult> {
  if (!isUuid(responseId) || typeof visible !== "boolean") return failWith();
  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_response", { p_response_id: responseId, p_visible: visible });
  if (error) return failWith("responseUpdateFailed");
  return ok(null);
}

const termSchema = z.string().trim().min(1).max(100);

export async function setTermVisibilityAction(interactionId: string, term: string, visible: boolean): Promise<ActionResult> {
  const parsed = termSchema.safeParse(term);
  if (!isUuid(interactionId) || !parsed.success || typeof visible !== "boolean") return failWith();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_term_visibility", {
    p_interaction_id: interactionId,
    p_term: parsed.data,
    p_visible: visible,
  });
  if (error) return failWith("wordUpdateFailed");
  return ok(null);
}

export async function reactionTotalsAction(sessionId: string): Promise<ActionResult<ReactionTally>> {
  if (!isUuid(sessionId)) return failWith();
  const supabase = await createClient();
  const { data, error } = await supabase.from("reactions").select("kind").eq("session_id", sessionId).limit(50_000);
  if (error) return failWith("reactionsLoadFailed");
  return ok(tallyReactions(data));
}

const engagementSchema = z
  .object({
    qa_enabled: z.boolean(),
    qa_moderated: z.boolean(),
    reactions_enabled: z.boolean(),
    profanity_filter: z.boolean(),
    moderate_open_text: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0);

export type EngagementSettings = z.infer<typeof engagementSchema>;

/** Liga ou desliga perguntas, aprovação, reações, filtro e moderação (também durante a sessão). */
export async function updateEngagementAction(sessionId: string, raw: EngagementSettings): Promise<ActionResult> {
  const parsed = engagementSchema.safeParse(raw);
  if (!isUuid(sessionId) || !parsed.success) return failWith();
  const supabase = await createClient();
  const { data, error } = await supabase.from("sessions").update(parsed.data).eq("id", sessionId).select("id").maybeSingle();
  if (error || !data) return fail((await getTranslations("errors"))("saveFailed"));
  revalidatePath(`/dashboard/sessions/${sessionId}`, "layout");
  return ok(null);
}
