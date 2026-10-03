"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient, type AdminSupabase } from "@/lib/supabase/admin";
import { findSessionByCode, getSessionSurvey } from "@/lib/data/public";
import {
  getParticipantIdFromCookie,
  hasSentFeedback,
  markFeedbackSent,
  setParticipantCookie,
} from "@/lib/participant/token";
import { hasDbErrorCode, isForeignKeyViolation, isUniqueViolation } from "@/lib/supabase/errors";
import type { Json } from "@/lib/supabase/database.types";
import type { InteractionRow } from "@/lib/supabase/types";
import {
  answerPayloadSchema,
  isInteractionType,
  normalizeSettings,
  QUIZ_GRACE_MS,
  type AnswerPayload,
} from "@/lib/domain/interactions";
import { MAX_PARTICIPANTS_PER_SESSION, normalizeJoinCode } from "@/lib/domain/session";
import { normalizeTerm } from "@/lib/domain/words";
import { parseSurveyAnswers } from "@/lib/domain/survey";
import { fail, firstIssue, formValues, isUuid, ok, type ActionResult } from "@/lib/action-result";

// ---------------------------------------------------------------------------
// Entrar na sessão
// ---------------------------------------------------------------------------

export type JoinFormState = { error?: string };

const joinSchema = z
  .object({
    name: z.string().trim().max(60, "Nome muito longo.").optional(),
    email: z.email({ error: "E-mail inválido." }).max(254).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+()\s-]{8,32}$/, "Telefone inválido.")
      .optional(),
    consent: z.boolean(),
  })
  .refine((v) => (!v.email && !v.phone) || v.consent, {
    error: "Para guardar seu contato, marque a autorização.",
  });

export async function joinSessionAction(code: string, _prev: JoinFormState, formData: FormData): Promise<JoinFormState> {
  const values = formValues(formData, ["name", "email", "phone"] as const);
  const parsed = joinSchema.safeParse({ ...values, consent: formData.get("consent") === "on" });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const admin = createAdminClient();
  const session = await findSessionByCode(admin, normalizeJoinCode(code));
  if (!session) return { error: "Sessão não encontrada. Confira o código." };
  if (session.status === "completed") redirect(`/feedback/${session.id}`);
  if (session.status === "draft") return { error: "Essa sessão ainda não começou." };

  if (await getParticipantIdFromCookie(session.id)) redirect(`/session/${session.id}/participate`);

  const { count } = await admin
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id);
  if ((count ?? 0) >= MAX_PARTICIPANTS_PER_SESSION) return { error: "Essa sessão atingiu o limite de participantes." };

  const name = parsed.data.name || null;
  const created = await admin
    .from("participants")
    .insert({ session_id: session.id, display_name: name, anonymous: name === null })
    .select("id")
    .single();
  if (created.error) return { error: "Não foi possível entrar agora. Tente de novo." };

  if (parsed.data.email || parsed.data.phone) {
    // LGPD: contato separado das respostas, com consentimento registrado.
    await admin.from("participant_contacts").insert({
      participant_id: created.data.id,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      consent_given_at: new Date().toISOString(),
      consent_purpose: "Receber materiais e comunicações sobre esta sessão",
    });
  }

  await setParticipantCookie(session.id, created.data.id);
  redirect(`/session/${session.id}/participate`);
}

// ---------------------------------------------------------------------------
// Responder
// ---------------------------------------------------------------------------

export type AnswerResult = ActionResult<{ status: "recorded" }>;

type BuiltResponse = { ok: true; value: Json; aggregateKey: string | null } | { ok: false; error: string; code?: string };

async function loadOption(admin: AdminSupabase, interactionId: string, optionId: string) {
  const { data } = await admin
    .from("interaction_options")
    .select("*")
    .eq("id", optionId)
    .eq("interaction_id", interactionId)
    .maybeSingle();
  return data;
}

/** Constrói value/aggregate_key no servidor. Nada de acerto, pontos ou tempo vem do cliente. */
async function buildResponse(
  admin: AdminSupabase,
  interaction: InteractionRow,
  payload: AnswerPayload,
): Promise<BuiltResponse> {
  if (!isInteractionType(interaction.type) || payload.type !== interaction.type) {
    return { ok: false, error: "Tipo de resposta inválido." };
  }
  const settings = normalizeSettings(interaction.type, interaction.settings);

  switch (payload.type) {
    case "multiple_choice": {
      const option = await loadOption(admin, interaction.id, payload.optionId);
      if (!option) return { ok: false, error: "Alternativa inválida." };
      return { ok: true, value: { optionId: option.id }, aggregateKey: option.id };
    }
    case "quiz": {
      const option = await loadOption(admin, interaction.id, payload.optionId);
      if (!option) return { ok: false, error: "Alternativa inválida." };
      const activatedAt = interaction.activated_at ? Date.parse(interaction.activated_at) : Date.now();
      const responseTimeMs = Math.max(0, Date.now() - activatedAt);
      if (settings.timerSeconds && responseTimeMs > settings.timerSeconds * 1000 + QUIZ_GRACE_MS) {
        return { ok: false, error: "O tempo acabou.", code: "timeout" };
      }
      return {
        ok: true,
        value: {
          optionId: option.id,
          isCorrect: option.is_correct,
          points: option.is_correct ? option.points : 0,
          responseTimeMs,
        },
        aggregateKey: option.id,
      };
    }
    case "rating": {
      if (payload.value < settings.min || payload.value > settings.max) {
        return { ok: false, error: "Nota fora da escala." };
      }
      return { ok: true, value: { value: payload.value }, aggregateKey: String(payload.value) };
    }
    case "word_cloud": {
      if (payload.text.length > settings.maxLength) return { ok: false, error: "Resposta muito longa." };
      const normalized = normalizeTerm(payload.text);
      if (!normalized) return { ok: false, error: "Tente uma palavra mais específica." };
      return { ok: true, value: { text: payload.text, normalized }, aggregateKey: normalized };
    }
    case "open_text": {
      if (payload.text.length > settings.maxLength) return { ok: false, error: "Resposta muito longa." };
      return { ok: true, value: { text: payload.text }, aggregateKey: null };
    }
  }
}

export async function submitAnswerAction(
  sessionId: string,
  interactionId: string,
  rawPayload: unknown,
): Promise<AnswerResult> {
  if (!isUuid(sessionId) || !isUuid(interactionId)) return fail("Dados inválidos.");

  const participantId = await getParticipantIdFromCookie(sessionId);
  if (!participantId) return fail("Entre na sessão novamente.", "no_participant");

  const payload = answerPayloadSchema.safeParse(rawPayload);
  if (!payload.success) return fail(firstIssue(payload.error));

  const admin = createAdminClient();
  const { data: interaction } = await admin
    .from("interactions")
    .select("*")
    .eq("id", interactionId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!interaction) return fail("Interação não encontrada.", "not_found");
  if (!interaction.is_active) return fail("Esta interação foi encerrada.", "closed");

  const built = await buildResponse(admin, interaction, payload.data);
  if (!built.ok) return fail(built.error, built.code);

  const { error } = await admin.from("responses").insert({
    interaction_id: interactionId,
    session_id: sessionId,
    participant_id: participantId,
    value: built.value,
    aggregate_key: built.aggregateKey,
    metadata: {},
  });

  if (error) {
    if (isUniqueViolation(error)) return fail("Você já respondeu esta interação.", "duplicate");
    if (hasDbErrorCode(error, "interaction_not_open")) return fail("Esta interação foi encerrada.", "closed");
    if (hasDbErrorCode(error, "participant_not_in_session") || isForeignKeyViolation(error)) {
      return fail("Entre na sessão novamente.", "no_participant");
    }
    return fail("Não foi possível enviar. Tente de novo.");
  }

  return ok({ status: "recorded" });
}

// ---------------------------------------------------------------------------
// Pesquisa pós-evento
// ---------------------------------------------------------------------------

export type SurveyFormState = { error?: string; done?: boolean };

export async function submitSurveyAction(
  sessionId: string,
  _prev: SurveyFormState,
  formData: FormData,
): Promise<SurveyFormState> {
  if (!isUuid(sessionId)) return { error: "Sessão inválida." };

  const participantId = await getParticipantIdFromCookie(sessionId);
  if (!participantId && (await hasSentFeedback(sessionId))) return { done: true };

  const admin = createAdminClient();
  const { data: session } = await admin.from("sessions").select("status").eq("id", sessionId).maybeSingle();
  if (!session) return { error: "Sessão não encontrada." };
  if (session.status !== "completed") return { error: "A pesquisa abre quando a sessão terminar." };

  const survey = await getSessionSurvey(admin, sessionId);
  if (!survey || survey.questions.length === 0) return { error: "A pesquisa desta sessão não está disponível." };

  const parsed = parseSurveyAnswers(survey.questions, (field) => {
    const value = formData.get(field);
    return typeof value === "string" ? value : undefined;
  });
  if (!parsed.ok) return { error: parsed.error };

  const created = await admin
    .from("survey_responses")
    .insert({ session_id: sessionId, participant_id: participantId })
    .select("id")
    .single();
  if (created.error) {
    if (isUniqueViolation(created.error)) {
      await markFeedbackSent(sessionId);
      return { done: true };
    }
    return { error: "Não foi possível enviar. Tente de novo." };
  }

  const { error } = await admin.from("survey_answers").insert(
    parsed.answers.map((a) => ({
      response_id: created.data.id,
      question_id: a.questionId,
      value_int: a.valueInt,
      value_text: a.valueText,
    })),
  );
  if (error) {
    // Sem transação no cliente: desfaz a resposta para não deixar uma pesquisa vazia contada.
    await admin.from("survey_responses").delete().eq("id", created.data.id);
    return { error: "Não foi possível enviar. Tente de novo." };
  }

  await markFeedbackSent(sessionId);
  return { done: true };
}
