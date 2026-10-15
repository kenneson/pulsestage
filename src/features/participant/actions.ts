"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getLocale, getTranslations } from "next-intl/server";
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
import { avatarKeySchema, quizPoints } from "@/lib/domain/gamification";
import { bordaPoints, isValidRanking } from "@/lib/domain/ranking";
import { containsProfanity } from "@/lib/domain/profanity";
import { localeOrDefault, type Locale } from "@/lib/domain/locale";
import { askQuestionSchema, QUESTION_LIMIT, QUESTION_WINDOW_MS } from "@/lib/domain/questions";
import { allowReaction, reactionKindSchema } from "@/lib/domain/reactions";
import { fail, formValues, isUuid, ok, type ActionResult } from "@/lib/action-result";
import { getMessageTranslator } from "@/i18n/server";

// Mensagens para a plateia: sempre no idioma da sessão (o mesmo dos botões no celular). Sem sessão válida,
// no idioma da requisição.

/** `tr`: chaves que viajam como texto (validation.*, core.*, participant.errors.*); `t`: erros desta área. */
async function texts(locale?: Locale | null) {
  const resolved = locale ?? (await getLocale());
  const [tr, t] = await Promise.all([
    getMessageTranslator(resolved),
    getTranslations({ locale: resolved, namespace: "participant.errors" }),
  ]);
  return { tr, t };
}

/** Idioma da sessão, para erros que acontecem antes de a ação ler a sessão. */
async function sessionLocale(admin: AdminSupabase, sessionId: string): Promise<Locale | null> {
  if (!isUuid(sessionId)) return null;
  const { data } = await admin.from("sessions").select("locale").eq("id", sessionId).maybeSingle();
  return data ? localeOrDefault(data.locale) : null;
}

// ---------------------------------------------------------------------------
// Entrar na sessão
// ---------------------------------------------------------------------------

export type JoinFormState = { error?: string };

const joinSchema = z
  .object({
    name: z.string().trim().max(60, "validation.nameTooLong").optional(),
    avatar: avatarKeySchema.optional(),
    email: z.email({ error: "participant.errors.invalidEmail" }).max(254).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+()\s-]{8,32}$/, "participant.errors.invalidPhone")
      .optional(),
    consent: z.boolean(),
  })
  .refine((v) => (!v.email && !v.phone) || v.consent, {
    error: "participant.errors.consentRequired",
  });

export async function joinSessionAction(code: string, _prev: JoinFormState, formData: FormData): Promise<JoinFormState> {
  const values = formValues(formData, ["name", "avatar", "email", "phone"] as const);
  const parsed = joinSchema.safeParse({ ...values, consent: formData.get("consent") === "on" });

  const admin = createAdminClient();
  const session = await findSessionByCode(admin, normalizeJoinCode(code));
  const { tr, t } = await texts(session?.locale);
  if (!parsed.success) return { error: tr.issue(parsed.error) };
  if (!session) return { error: t("sessionNotFoundCheckCode") };
  if (session.status === "completed") redirect(`/feedback/${session.id}`);
  if (session.status === "draft") return { error: t("notStarted") };

  if (await getParticipantIdFromCookie(session.id)) redirect(`/session/${session.id}/participate`);

  const { count } = await admin
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id);
  if ((count ?? 0) >= MAX_PARTICIPANTS_PER_SESSION) return { error: t("sessionFull") };

  const name = parsed.data.name || null;
  const created = await admin
    .from("participants")
    .insert({ session_id: session.id, display_name: name, anonymous: name === null, avatar: parsed.data.avatar ?? null })
    .select("id")
    .single();
  if (created.error) return { error: t("joinFailed") };

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

type Moderation = "visible" | "pending" | "hidden";

type BuiltResponse =
  | { ok: true; value: Json; aggregateKey: string | null; moderation: Moderation; filtered?: boolean }
  | { ok: false; /** chave de mensagem (traduzida no idioma da sessão) */ error: string; code?: string };

type SessionRules = { profanityFilter: boolean; moderateOpenText: boolean; locale: Locale };

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
  rules: SessionRules,
): Promise<BuiltResponse> {
  if (!isInteractionType(interaction.type) || payload.type !== interaction.type) {
    return { ok: false, error: "participant.errors.invalidAnswerType" };
  }
  const settings = normalizeSettings(interaction.type, interaction.settings);

  switch (payload.type) {
    case "multiple_choice": {
      const option = await loadOption(admin, interaction.id, payload.optionId);
      if (!option) return { ok: false, error: "participant.errors.invalidOption" };
      return { ok: true, value: { optionId: option.id }, aggregateKey: option.id, moderation: "visible" };
    }
    case "quiz": {
      const option = await loadOption(admin, interaction.id, payload.optionId);
      if (!option) return { ok: false, error: "participant.errors.invalidOption" };
      const activatedAt = interaction.activated_at ? Date.parse(interaction.activated_at) : Date.now();
      const responseTimeMs = Math.max(0, Date.now() - activatedAt);
      if (settings.timerSeconds && responseTimeMs > settings.timerSeconds * 1000 + QUIZ_GRACE_MS) {
        return { ok: false, error: "participant.errors.timeUp", code: "timeout" };
      }
      return {
        ok: true,
        value: {
          optionId: option.id,
          isCorrect: option.is_correct,
          points: option.is_correct
            ? quizPoints(option.points, responseTimeMs, settings.timerSeconds, settings.speedBonus)
            : 0,
          responseTimeMs,
        },
        aggregateKey: option.id,
        moderation: "visible",
      };
    }
    case "rating": {
      if (payload.value < settings.min || payload.value > settings.max) {
        return { ok: false, error: "participant.errors.ratingOutOfRange" };
      }
      return { ok: true, value: { value: payload.value }, aggregateKey: String(payload.value), moderation: "visible" };
    }
    case "word_cloud": {
      if (payload.text.length > settings.maxLength) return { ok: false, error: "validation.answerTooLong" };
      const normalized = normalizeTerm(payload.text, rules.locale);
      if (!normalized) return { ok: false, error: "participant.errors.moreSpecificWord" };
      const value = { text: payload.text, normalized };
      // Palavrão: entra oculto (o palestrante vê e pode liberar). Sem aviso, para não ensinar a burlar.
      if (rules.profanityFilter && containsProfanity(payload.text, rules.locale)) {
        return { ok: true, value, aggregateKey: normalized, moderation: "hidden", filtered: true };
      }
      // Palavra que o palestrante ocultou da nuvem continua oculta.
      const { count } = await admin
        .from("responses")
        .select("id", { count: "exact", head: true })
        .eq("interaction_id", interaction.id)
        .eq("aggregate_key", normalized)
        .eq("moderation", "hidden");
      return { ok: true, value, aggregateKey: normalized, moderation: (count ?? 0) > 0 ? "hidden" : "visible" };
    }
    case "open_text": {
      if (payload.text.length > settings.maxLength) return { ok: false, error: "validation.answerTooLong" };
      const value = { text: payload.text };
      if (rules.profanityFilter && containsProfanity(payload.text, rules.locale)) {
        return { ok: true, value, aggregateKey: null, moderation: "hidden", filtered: true };
      }
      return { ok: true, value, aggregateKey: null, moderation: rules.moderateOpenText ? "pending" : "visible" };
    }
    case "ranking": {
      const { data: options } = await admin.from("interaction_options").select("id").eq("interaction_id", interaction.id);
      const ids = (options ?? []).map((o) => o.id);
      if (!isValidRanking(payload.order, ids)) return { ok: false, error: "validation.rankAllOptions" };
      return {
        ok: true,
        value: { order: payload.order, points: bordaPoints(payload.order) },
        aggregateKey: null,
        moderation: "visible",
      };
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

  const { data: session } = await admin
    .from("sessions")
    .select("profanity_filter, moderate_open_text, locale")
    .eq("id", sessionId)
    .maybeSingle();
  const built = await buildResponse(admin, interaction, payload.data, {
    profanityFilter: session?.profanity_filter ?? true,
    moderateOpenText: session?.moderate_open_text ?? false,
    locale: localeOrDefault(session?.locale),
  });
  if (!built.ok) return fail(built.error, built.code);

  const { error } = await admin.from("responses").insert({
    interaction_id: interactionId,
    session_id: sessionId,
    participant_id: participantId,
    value: built.value,
    aggregate_key: built.aggregateKey,
    moderation: built.moderation,
    metadata: built.filtered ? { filtered: true } : {},
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

// ---------------------------------------------------------------------------
// Perguntas da plateia
// ---------------------------------------------------------------------------

/** Sessão em andamento (ao vivo ou pausada) com perguntas ligadas. */
async function openForQuestions(admin: AdminSupabase, sessionId: string) {
  const { data } = await admin
    .from("sessions")
    .select("status, qa_enabled, qa_moderated, profanity_filter, locale")
    .eq("id", sessionId)
    .maybeSingle();
  if (!data || !data.qa_enabled || (data.status !== "live" && data.status !== "paused")) return null;
  return data;
}

export async function askQuestionAction(sessionId: string, raw: unknown): Promise<ActionResult<{ pending: boolean }>> {
  if (!isUuid(sessionId)) return fail("Dados inválidos.");
  const parsed = askQuestionSchema.safeParse(raw);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const participantId = await getParticipantIdFromCookie(sessionId);
  if (!participantId) return fail("Entre na sessão novamente.", "no_participant");

  const admin = createAdminClient();
  const session = await openForQuestions(admin, sessionId);
  if (!session) return fail("As perguntas não estão abertas nesta sessão.", "closed");

  const since = new Date(Date.now() - QUESTION_WINDOW_MS).toISOString();
  const { count } = await admin
    .from("audience_questions")
    .select("id", { count: "exact", head: true })
    .eq("participant_id", participantId)
    .gte("created_at", since);
  if ((count ?? 0) >= QUESTION_LIMIT) return fail("Você enviou várias perguntas seguidas. Espere alguns minutos.");

  let author: string | null = null;
  if (parsed.data.withName) {
    const { data: me } = await admin.from("participants").select("display_name").eq("id", participantId).maybeSingle();
    author = me?.display_name ?? null;
  }

  // Palavrão: fica oculta (o palestrante vê e pode liberar). Para quem perguntou, parece aguardar aprovação.
  const filtered = session.profanity_filter && containsProfanity(parsed.data.body, localeOrDefault(session.locale));
  const status = filtered ? "hidden" : session.qa_moderated ? "pending" : "visible";
  const { error } = await admin.from("audience_questions").insert({
    session_id: sessionId,
    participant_id: participantId,
    body: parsed.data.body,
    author_name: author,
    status,
    filtered,
  });
  if (error) {
    if (isForeignKeyViolation(error)) return fail("Entre na sessão novamente.", "no_participant");
    return fail("Não foi possível enviar a pergunta. Tente de novo.");
  }
  return ok({ pending: status !== "visible" });
}

export async function voteQuestionAction(sessionId: string, questionId: string, vote: boolean): Promise<ActionResult> {
  if (!isUuid(sessionId) || !isUuid(questionId) || typeof vote !== "boolean") return fail("Dados inválidos.");
  const participantId = await getParticipantIdFromCookie(sessionId);
  if (!participantId) return fail("Entre na sessão novamente.", "no_participant");

  const admin = createAdminClient();
  if (!(await openForQuestions(admin, sessionId))) return fail("As perguntas não estão abertas nesta sessão.", "closed");
  const { data: question } = await admin
    .from("audience_questions")
    .select("id, participant_id, status")
    .eq("id", questionId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!question || question.status !== "visible") return fail("Esta pergunta não está aberta.");
  if (question.participant_id === participantId) return fail("Você não pode curtir a própria pergunta.");

  const { error } = vote
    ? await admin.from("audience_question_votes").insert({ question_id: questionId, participant_id: participantId })
    : await admin.from("audience_question_votes").delete().eq("question_id", questionId).eq("participant_id", participantId);
  if (error && !isUniqueViolation(error)) return fail("Não foi possível registrar. Tente de novo.");
  return ok(null);
}

// ---------------------------------------------------------------------------
// Reações ao vivo
// ---------------------------------------------------------------------------

// ponytail: limite em memória, por instância do servidor; mover para o banco se houver abuso.
const reactionTimes = new Map<string, number[]>();

export async function sendReactionAction(sessionId: string, kind: unknown): Promise<ActionResult> {
  const parsed = reactionKindSchema.safeParse(kind);
  if (!isUuid(sessionId) || !parsed.success) return fail("Dados inválidos.");
  const participantId = await getParticipantIdFromCookie(sessionId);
  if (!participantId) return fail("Entre na sessão novamente.", "no_participant");

  const allowed = allowReaction(reactionTimes.get(participantId) ?? [], Date.now());
  if (!allowed) return fail("Calma! Muitas reações seguidas.", "rate_limited");
  reactionTimes.set(participantId, allowed);

  const admin = createAdminClient();
  const { data: session } = await admin.from("sessions").select("status, reactions_enabled").eq("id", sessionId).maybeSingle();
  if (!session || session.status !== "live" || !session.reactions_enabled) return fail("Reações desligadas agora.", "closed");

  const { error } = await admin.from("reactions").insert({ session_id: sessionId, participant_id: participantId, kind: parsed.data });
  if (error) return fail("Não foi possível reagir.");
  return ok(null);
}
