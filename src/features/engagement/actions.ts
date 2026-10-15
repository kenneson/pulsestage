"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hasDbErrorCode } from "@/lib/supabase/errors";
import { fail, isUuid, ok, type ActionResult } from "@/lib/action-result";
import { getModerationQueue, listSessionQuestions, type ModerationQueue, type SpeakerQuestion } from "@/lib/data/engagement";
import { tallyReactions, type ReactionTally } from "@/lib/domain/reactions";

// Perguntas da plateia, moderação e reações: ações do palestrante (cliente dele, RLS e funções do banco
// que conferem o dono da sessão).

export async function listQuestionsAction(sessionId: string): Promise<ActionResult<SpeakerQuestion[]>> {
  if (!isUuid(sessionId)) return fail("Dados inválidos.");
  const supabase = await createClient();
  try {
    return ok(await listSessionQuestions(supabase, sessionId));
  } catch {
    return fail("Não foi possível carregar as perguntas.");
  }
}

const moderationStatusSchema = z.enum(["visible", "answered", "hidden"]);

export async function moderateQuestionAction(questionId: string, status: string): Promise<ActionResult> {
  const parsed = moderationStatusSchema.safeParse(status);
  if (!isUuid(questionId) || !parsed.success) return fail("Dados inválidos.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_question", { p_question_id: questionId, p_status: parsed.data });
  if (error) return fail("Não foi possível atualizar a pergunta.");
  return ok(null);
}

/** Lista das mais curtidas (questionId null) ou uma pergunta em destaque no telão; show false tira. */
export async function showQuestionsAction(sessionId: string, show: boolean, questionId: string | null): Promise<ActionResult> {
  if (!isUuid(sessionId) || typeof show !== "boolean" || (questionId !== null && !isUuid(questionId))) {
    return fail("Dados inválidos.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("show_questions", {
    p_session_id: sessionId,
    p_show: show,
    ...(questionId ? { p_question_id: questionId } : {}),
  });
  if (error) {
    if (hasDbErrorCode(error, "session_not_live")) return fail("Inicie ou retome a sessão para usar o telão.");
    if (hasDbErrorCode(error, "question_not_found")) return fail("Essa pergunta não está aberta.");
    return fail("Não foi possível mudar o telão.");
  }
  return ok(null);
}

export async function moderationQueueAction(interactionId: string): Promise<ActionResult<ModerationQueue>> {
  if (!isUuid(interactionId)) return fail("Dados inválidos.");
  const supabase = await createClient();
  try {
    return ok(await getModerationQueue(supabase, interactionId));
  } catch {
    return fail("Não foi possível carregar a moderação.");
  }
}

export async function moderateResponseAction(responseId: string, visible: boolean): Promise<ActionResult> {
  if (!isUuid(responseId) || typeof visible !== "boolean") return fail("Dados inválidos.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_response", { p_response_id: responseId, p_visible: visible });
  if (error) return fail("Não foi possível atualizar a resposta.");
  return ok(null);
}

const termSchema = z.string().trim().min(1).max(100);

export async function setTermVisibilityAction(interactionId: string, term: string, visible: boolean): Promise<ActionResult> {
  const parsed = termSchema.safeParse(term);
  if (!isUuid(interactionId) || !parsed.success || typeof visible !== "boolean") return fail("Dados inválidos.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_term_visibility", {
    p_interaction_id: interactionId,
    p_term: parsed.data,
    p_visible: visible,
  });
  if (error) return fail("Não foi possível atualizar a palavra.");
  return ok(null);
}

export async function reactionTotalsAction(sessionId: string): Promise<ActionResult<ReactionTally>> {
  if (!isUuid(sessionId)) return fail("Dados inválidos.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("reactions").select("kind").eq("session_id", sessionId).limit(50_000);
  if (error) return fail("Não foi possível carregar as reações.");
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
  if (!isUuid(sessionId) || !parsed.success) return fail("Dados inválidos.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("sessions").update(parsed.data).eq("id", sessionId).select("id").maybeSingle();
  if (error || !data) return fail("Não foi possível salvar.");
  revalidatePath(`/dashboard/sessions/${sessionId}`, "layout");
  return ok(null);
}
