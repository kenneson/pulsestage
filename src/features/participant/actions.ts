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
import { ANONYMOUS_SURVEY_LIMIT_PER_IP, parseSurveyAnswers } from "@/lib/domain/survey";
import { requesterIpHash } from "@/lib/request-ip";
import { hitWindow, pruneOldest } from "@/lib/domain/rate-limit";
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

// ponytail: limite em memória, por instância do servidor.
const codeMisses = new Map<string, number[]>();
const CODE_MISS_WINDOW_MS = 10 * 60 * 1000;
const CODE_MISS_MAX = 30;

export async function joinSessionAction(code: string, _prev: JoinFormState, formData: FormData): Promise<JoinFormState> {
  const values = formValues(formData, ["name", "avatar", "email", "phone"] as const);
  const parsed = joinSchema.safeParse({ ...values, consent: formData.get("consent") === "on" });

  const admin = createAdminClient();
  // Contra tentativa de adivinhar códigos: poucos erros de código por IP (acertos não contam, então uma
  // turma inteira saindo pelo mesmo IP da escola entra normalmente).
  const ip = await requesterIpHash("join");
  if (ip && (codeMisses.get(ip) ?? []).filter((t) => Date.now() - t < CODE_MISS_WINDOW_MS).length >= CODE_MISS_MAX) {
    return { error: (await texts()).tr.message("errors.tooManyRequests") };
  }
  const session = await findSessionByCode(admin, normalizeJoinCode(code));
  const { tr, t } = await texts(session?.locale);
  if (!parsed.success) return { error: tr.issue(parsed.error) };
  if (!session) {
    if (ip) hitWindow(codeMisses, ip, Date.now(), CODE_MISS_WINDOW_MS, CODE_MISS_MAX);
    return { error: t("sessionNotFoundCheckCode") };
  }
  if (session.status === "completed") redirect(`/feedback/${session.id}`);
  // Rascunho também: quem escaneia o QR antes do início espera na tela "Você está dentro!".

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
      // Registro do consentimento no idioma em que a pessoa leu o pedido (o da sessão).
      consent_purpose: t("consentPurpose"),
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
  if (!isUuid(sessionId) || !isUuid(interactionId)) return fail((await texts()).tr.message("errors.invalidData"));

  const admin = createAdminClient();
  const participantId = await getParticipantIdFromCookie(sessionId);
  if (!participantId) return fail((await texts(await sessionLocale(admin, sessionId))).t("rejoin"), "no_participant");

  const payload = answerPayloadSchema.safeParse(rawPayload);
  if (!payload.success) return fail((await texts(await sessionLocale(admin, sessionId))).tr.issue(payload.error));

  // Interação e regras da sessão em paralelo: o idioma vem junto, sem leitura a mais.
  const [{ data: interaction }, { data: session }] = await Promise.all([
    admin.from("interactions").select("*").eq("id", interactionId).eq("session_id", sessionId).maybeSingle(),
    admin.from("sessions").select("profanity_filter, moderate_open_text, locale").eq("id", sessionId).maybeSingle(),
  ]);
  const { tr, t } = await texts(session ? localeOrDefault(session.locale) : null);
  if (!interaction) return fail(tr.message("core.interactionNotFound"), "not_found");
  if (!interaction.is_active) return fail(t("interactionClosed"), "closed");

  const built = await buildResponse(admin, interaction, payload.data, {
    profanityFilter: session?.profanity_filter ?? true,
    moderateOpenText: session?.moderate_open_text ?? false,
    locale: localeOrDefault(session?.locale),
  });
  if (!built.ok) return fail(tr.message(built.error), built.code);

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
    if (isUniqueViolation(error)) return fail(t("alreadyAnswered"), "duplicate");
    if (hasDbErrorCode(error, "interaction_not_open")) return fail(t("interactionClosed"), "closed");
    if (hasDbErrorCode(error, "participant_not_in_session") || isForeignKeyViolation(error)) {
      return fail(t("rejoin"), "no_participant");
    }
    return fail(t("sendFailed"));
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
  if (!isUuid(sessionId)) return { error: (await texts()).t("invalidSession") };

  const participantId = await getParticipantIdFromCookie(sessionId);
  if (!participantId && (await hasSentFeedback(sessionId))) return { done: true };

  const admin = createAdminClient();
  const { data: session } = await admin.from("sessions").select("status, locale").eq("id", sessionId).maybeSingle();
  const { tr, t } = await texts(session ? localeOrDefault(session.locale) : null);
  if (!session) return { error: t("sessionNotFound") };
  if (session.status !== "completed") return { error: t("surveyNotOpen") };

  const survey = await getSessionSurvey(admin, sessionId);
  if (!survey || survey.questions.length === 0) return { error: t("surveyUnavailable") };

  const parsed = parseSurveyAnswers(survey.questions, (field) => {
    const value = formData.get(field);
    return typeof value === "string" ? value : undefined;
  });
  if (!parsed.ok) return { error: tr.message(parsed.error) };

  // Sem ter entrado na sessão, vale um limite por IP (contra envio em massa por robô).
  const ipHash = participantId ? null : await requesterIpHash("survey");
  if (ipHash) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("survey_responses")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .is("participant_id", null)
      .eq("ip_hash", ipHash)
      .gte("created_at", since);
    if ((count ?? 0) >= ANONYMOUS_SURVEY_LIMIT_PER_IP) return { error: t("surveyTooMany") };
  }

  const created = await admin
    .from("survey_responses")
    .insert({ session_id: sessionId, participant_id: participantId, ip_hash: ipHash })
    .select("id")
    .single();
  if (created.error) {
    if (isUniqueViolation(created.error)) {
      await markFeedbackSent(sessionId);
      return { done: true };
    }
    return { error: t("sendFailed") };
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
    return { error: t("sendFailed") };
  }

  await markFeedbackSent(sessionId);
  return { done: true };
}

// ---------------------------------------------------------------------------
// Perguntas da plateia
// ---------------------------------------------------------------------------

/**
 * Sessão em andamento (ao vivo ou pausada) com perguntas ligadas (`open`, senão null) e o idioma da sessão
 * (null se ela não existe), para as mensagens.
 */
async function openForQuestions(admin: AdminSupabase, sessionId: string) {
  const { data } = await admin
    .from("sessions")
    .select("status, qa_enabled, qa_moderated, profanity_filter, locale")
    .eq("id", sessionId)
    .maybeSingle();
  const open = data && data.qa_enabled && (data.status === "live" || data.status === "paused") ? data : null;
  return { open, locale: data ? localeOrDefault(data.locale) : null };
}

export async function askQuestionAction(sessionId: string, raw: unknown): Promise<ActionResult<{ pending: boolean }>> {
  if (!isUuid(sessionId)) return fail((await texts()).tr.message("errors.invalidData"));
  const admin = createAdminClient();
  const { open: session, locale } = await openForQuestions(admin, sessionId);
  const { tr, t } = await texts(locale);

  const parsed = askQuestionSchema.safeParse(raw);
  if (!parsed.success) return fail(tr.issue(parsed.error));

  const participantId = await getParticipantIdFromCookie(sessionId);
  if (!participantId) return fail(t("rejoin"), "no_participant");

  if (!session) return fail(t("questionsClosed"), "closed");

  const since = new Date(Date.now() - QUESTION_WINDOW_MS).toISOString();
  const { count } = await admin
    .from("audience_questions")
    .select("id", { count: "exact", head: true })
    .eq("participant_id", participantId)
    .gte("created_at", since);
  if ((count ?? 0) >= QUESTION_LIMIT) return fail(t("tooManyQuestions"));

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
    if (isForeignKeyViolation(error)) return fail(t("rejoin"), "no_participant");
    return fail(t("questionSendFailed"));
  }
  return ok({ pending: status !== "visible" });
}

export async function voteQuestionAction(sessionId: string, questionId: string, vote: boolean): Promise<ActionResult> {
  if (!isUuid(sessionId) || !isUuid(questionId) || typeof vote !== "boolean") {
    return fail((await texts()).tr.message("errors.invalidData"));
  }
  const admin = createAdminClient();
  const participantId = await getParticipantIdFromCookie(sessionId);
  if (!participantId) return fail((await texts(await sessionLocale(admin, sessionId))).t("rejoin"), "no_participant");

  const { open, locale } = await openForQuestions(admin, sessionId);
  const { t } = await texts(locale);
  if (!open) return fail(t("questionsClosed"), "closed");
  const { data: question } = await admin
    .from("audience_questions")
    .select("id, participant_id, status")
    .eq("id", questionId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!question || question.status !== "visible") return fail(t("questionNotOpen"));
  if (question.participant_id === participantId) return fail(t("ownQuestion"));

  const { error } = vote
    ? await admin.from("audience_question_votes").insert({ question_id: questionId, participant_id: participantId })
    : await admin.from("audience_question_votes").delete().eq("question_id", questionId).eq("participant_id", participantId);
  if (error && !isUniqueViolation(error)) return fail(t("voteFailed"));
  return ok(null);
}

// ---------------------------------------------------------------------------
// Reações ao vivo
// ---------------------------------------------------------------------------

// ponytail: limite em memória, por instância do servidor; mover para o banco se houver abuso.
const reactionTimes = new Map<string, number[]>();

export async function sendReactionAction(sessionId: string, kind: unknown): Promise<ActionResult> {
  const parsed = reactionKindSchema.safeParse(kind);
  if (!isUuid(sessionId) || !parsed.success) return fail((await texts()).tr.message("errors.invalidData"));
  const admin = createAdminClient();
  const participantId = await getParticipantIdFromCookie(sessionId);
  if (!participantId) return fail((await texts(await sessionLocale(admin, sessionId))).t("rejoin"), "no_participant");

  const allowed = allowReaction(reactionTimes.get(participantId) ?? [], Date.now());
  // Idioma da requisição de propósito: o limite existe para poupar o banco, e o celular não mostra esta mensagem.
  if (!allowed) return fail((await texts()).t("tooManyReactions"), "rate_limited");
  reactionTimes.delete(participantId);
  reactionTimes.set(participantId, allowed);
  pruneOldest(reactionTimes);

  const { data: session } = await admin
    .from("sessions")
    .select("status, reactions_enabled, locale")
    .eq("id", sessionId)
    .maybeSingle();
  const { t } = await texts(session ? localeOrDefault(session.locale) : null);
  if (!session || session.status !== "live" || !session.reactions_enabled) return fail(t("reactionsOff"), "closed");

  const { error } = await admin.from("reactions").insert({ session_id: sessionId, participant_id: participantId, kind: parsed.data });
  if (error) return fail(t("reactionFailed"));
  return ok(null);
}
