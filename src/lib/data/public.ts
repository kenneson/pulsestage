import "server-only";
import { localeOrDefault, type Locale } from "@/lib/domain/locale";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { InteractionResultRow, SessionLiveStateRow } from "@/lib/supabase/types";
import {
  toPublicInteraction,
  type CurrentInteractionResponse,
  type PublicInteraction,
} from "@/lib/domain/interactions";
import { toSurveyQuestions, type SurveyQuestion } from "@/lib/domain/survey";
import type { DeckSession } from "@/lib/data/slides";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { leaderboard, type LeaderboardEntry } from "@/lib/domain/leaderboard";
import { SCORED_TYPES } from "@/lib/domain/interactions";
import { avatarOf } from "@/lib/domain/gamification";
import { LOBBY_LIMIT, publicName, toLobby, type Lobby } from "@/lib/domain/lobby";
import { screenContent } from "@/lib/domain/screen";
import { toSessionStatus } from "@/lib/domain/session";

// Leituras públicas feitas no servidor com a secret key.
// Tudo que sai daqui é sanitizado: sem is_correct, points ou dados pessoais.

/** `locale`: idioma da sessão (telão e celular da plateia). */
export type PublicSession = { id: string; title: string; status: string; joinCode: string; locale: Locale };

export async function findSessionByCode(admin: AdminSupabase, code: string): Promise<PublicSession | null> {
  const { data, error } = await admin
    .from("sessions")
    .select("id, title, status, join_code, locale")
    .eq("join_code", code)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw new Error(error.message);
  const match = data.find((s) => s.status !== "completed") ?? data[0];
  return match ? toPublicSession(match) : null;
}

function toPublicSession(row: { id: string; title: string; status: string; join_code: string; locale: string }): PublicSession {
  return { id: row.id, title: row.title, status: row.status, joinCode: row.join_code, locale: localeOrDefault(row.locale) };
}

export async function getPublicSession(admin: AdminSupabase, sessionId: string): Promise<PublicSession | null> {
  const { data, error } = await admin
    .from("sessions")
    .select("id, title, status, join_code, locale")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toPublicSession(data) : null;
}

/** Dados do deck (slides) da sessão, para gerar as URLs assinadas no servidor. */
export async function getSessionDeck(admin: AdminSupabase, sessionId: string): Promise<DeckSession | null> {
  const { data, error } = await admin
    .from("sessions")
    .select("id, speaker_id, slides_batch, slide_count, slides_format")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getPublicInteractions(admin: AdminSupabase, sessionId: string): Promise<PublicInteraction[]> {
  const { data: interactions, error } = await admin
    .from("interactions")
    .select("*")
    .eq("session_id", sessionId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  if (interactions.length === 0) return [];

  const { data: options, error: optionsError } = await admin
    .from("interaction_options")
    .select("*")
    .in(
      "interaction_id",
      interactions.map((i) => i.id),
    );
  if (optionsError) throw new Error(optionsError.message);

  return interactions
    .map((i) => toPublicInteraction(i, options))
    .filter((i): i is PublicInteraction => i !== null);
}

export async function getPublicInteraction(
  admin: AdminSupabase,
  interactionId: string,
): Promise<PublicInteraction | null> {
  const { data: interaction, error } = await admin
    .from("interactions")
    .select("*")
    .eq("id", interactionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!interaction) return null;

  const { data: options, error: optionsError } = await admin
    .from("interaction_options")
    .select("*")
    .eq("interaction_id", interactionId);
  if (optionsError) throw new Error(optionsError.message);

  return toPublicInteraction(interaction, options);
}

export async function getLiveState(admin: AdminSupabase, sessionId: string): Promise<SessionLiveStateRow | null> {
  const { data, error } = await admin.from("session_live_state").select("*").eq("session_id", sessionId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getSessionResults(admin: AdminSupabase, sessionId: string): Promise<InteractionResultRow[]> {
  const { data, error } = await admin.from("interaction_results").select("*").eq("session_id", sessionId);
  if (error) throw new Error(error.message);
  return data;
}

export type ParticipantBadge = { name: string | null; avatar: string | null };

/** Nome e avatar que o próprio participante escolheu, para o celular dele. */
export async function getParticipantBadge(admin: AdminSupabase, participantId: string): Promise<ParticipantBadge> {
  const { data, error } = await admin.from("participants").select("display_name, avatar").eq("id", participantId).maybeSingle();
  if (error) throw new Error(error.message);
  return { name: data?.display_name ?? null, avatar: avatarOf(data?.avatar)?.emoji ?? null };
}

/** Estado que o celular do participante precisa: interaction ativa e se já respondeu. */
export async function getCurrentForParticipant(
  admin: AdminSupabase,
  sessionId: string,
  participantId: string,
): Promise<CurrentInteractionResponse> {
  const [state, flags] = await Promise.all([
    getLiveState(admin, sessionId),
    admin.from("sessions").select("qa_enabled, reactions_enabled, pace").eq("id", sessionId).maybeSingle(),
  ]);
  const features = { questions: Boolean(flags.data?.qa_enabled), reactions: Boolean(flags.data?.reactions_enabled) };
  // Ritmo próprio: o celular percorre o roteiro inteiro (GET /api/participant/[id]/journey).
  const pace = flags.data?.pace === "self" ? "self" : "live";
  if (!state) return { status: "draft", interaction: null, answered: false, features, pace };

  if (state.status !== "live" || !state.active_interaction_id) {
    return { status: state.status, interaction: null, answered: false, features, pace };
  }

  const interaction = await getPublicInteraction(admin, state.active_interaction_id);
  const { count, error } = await admin
    .from("responses")
    .select("id", { count: "exact", head: true })
    .eq("interaction_id", state.active_interaction_id)
    .eq("participant_id", participantId);
  if (error) throw new Error(error.message);

  return { status: state.status, interaction, answered: (count ?? 0) > 0, features, pace };
}

export type PublicSurvey = { name: string; questions: SurveyQuestion[] };

/** Pesquisa pós-evento da sessão (cópia feita ao encerrar). Null antes de encerrar. */
export async function getSessionSurvey(admin: AdminSupabase, sessionId: string): Promise<PublicSurvey | null> {
  const [survey, questions] = await Promise.all([
    admin.from("session_surveys").select("name").eq("session_id", sessionId).maybeSingle(),
    admin.from("session_survey_questions").select("*").eq("session_id", sessionId).order("position"),
  ]);
  if (survey.error) throw new Error(survey.error.message);
  if (questions.error) throw new Error(questions.error.message);
  if (!survey.data) return null;
  return { name: survey.data.name, questions: toSurveyQuestions(questions.data) };
}

/**
 * Ranking do quiz para o telão. Só existe enquanto o palestrante o mostra (show_leaderboard):
 * fora disso, quem tem o link do projetor não consegue ler nomes e pontos.
 * Sai só nome escolhido (ou "Participante XXXX"), pontos, acertos e posições.
 * `anonymous`: palavra de "Participante XXXX" no idioma da sessão (domain.anonymousParticipant).
 */
export async function getPublicLeaderboard(
  admin: AdminSupabase,
  sessionId: string,
  anonymous?: string,
): Promise<LeaderboardEntry[] | null> {
  const [state, rules] = await Promise.all([getLiveState(admin, sessionId), nameRules(admin, sessionId)]);
  // Só durante a sessão: depois de encerrada, o link do telão não expõe mais os nomes.
  if (!state || (state.status !== "live" && state.status !== "paused") || !state.show_leaderboard) return null;

  const { data: quizzes, error } = await admin
    .from("interactions")
    .select("id, activated_at")
    .eq("session_id", sessionId)
    .in("type", [...SCORED_TYPES]);
  if (error) throw new Error(error.message);
  if (quizzes.length === 0) return [];

  const quizIds = quizzes.map((q) => q.id);
  const [responses, participants] = await Promise.all([
    fetchAllRows<{ participant_id: string; interaction_id: string; value: unknown }>((from, to) =>
      admin.from("responses").select("participant_id, interaction_id, value").in("interaction_id", quizIds).range(from, to),
    ),
    fetchAllRows<{ id: string; display_name: string | null; avatar: string | null }>((from, to) =>
      admin.from("participants").select("id, display_name, avatar").eq("session_id", sessionId).range(from, to),
    ),
  ]);

  // "Antes do último quiz": o quiz respondido aberto por último.
  const answered = new Set(responses.map((r) => r.interaction_id));
  const latest = quizzes
    .filter((q) => answered.has(q.id) && q.activated_at)
    .sort((a, b) => (b.activated_at ?? "").localeCompare(a.activated_at ?? ""))[0];

  return leaderboard(
    responses.map((r) => ({ participantId: r.participant_id, interactionId: r.interaction_id, value: r.value })),
    // Nome barrado pelo filtro de palavrões vira "Participante XXXX" no telão.
    participants.map((p) => ({ ...p, display_name: publicName(p.display_name, rules) })),
    latest?.id ?? null,
    undefined,
    anonymous,
  );
}

/** Filtro de palavrões e idioma da sessão: decidem se um nome pode aparecer para a sala. */
async function nameRules(admin: AdminSupabase, sessionId: string): Promise<{ profanityFilter: boolean; locale: Locale }> {
  const { data, error } = await admin.from("sessions").select("profanity_filter, locale").eq("id", sessionId).maybeSingle();
  if (error) throw new Error(error.message);
  return { profanityFilter: data?.profanity_filter ?? true, locale: localeOrDefault(data?.locale) };
}

/**
 * Quem entrou, para a sala de espera do telão. Só enquanto o QR Code de entrada está no telão (rascunho
 * ou ao vivo, sem pergunta, slide ou outra tela por cima): fora disso, o link do projetor não lista nomes.
 * Sai só nome escolhido (filtrado) e avatar, das pessoas mais recentes.
 */
export async function getPublicLobby(admin: AdminSupabase, sessionId: string): Promise<Lobby | null> {
  const [{ data: session, error }, state] = await Promise.all([
    admin.from("sessions").select("status, slide_count, profanity_filter, locale").eq("id", sessionId).maybeSingle(),
    getLiveState(admin, sessionId),
  ]);
  if (error) throw new Error(error.message);
  if (!session) return null;
  const status = toSessionStatus(session.status);
  if (status !== "draft" && status !== "live") return null;
  if (screenContent(state, status, { slideCount: session.slide_count ?? 0 }).kind !== "join") return null;

  const { data, count, error: listError } = await admin
    .from("participants")
    .select("id, display_name, avatar", { count: "exact" })
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(LOBBY_LIMIT);
  if (listError) throw new Error(listError.message);
  return toLobby(data, count ?? data.length, {
    profanityFilter: session.profanity_filter,
    locale: localeOrDefault(session.locale),
  });
}
