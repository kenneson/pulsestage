import "server-only";
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

// Leituras públicas feitas no servidor com a secret key.
// Tudo que sai daqui é sanitizado: sem is_correct, points ou dados pessoais.

export type PublicSession = { id: string; title: string; status: string; joinCode: string };

export async function findSessionByCode(admin: AdminSupabase, code: string): Promise<PublicSession | null> {
  const { data, error } = await admin
    .from("sessions")
    .select("id, title, status, join_code")
    .eq("join_code", code)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw new Error(error.message);
  const match = data.find((s) => s.status !== "completed") ?? data[0];
  return match ? { id: match.id, title: match.title, status: match.status, joinCode: match.join_code } : null;
}

export async function getPublicSession(admin: AdminSupabase, sessionId: string): Promise<PublicSession | null> {
  const { data, error } = await admin
    .from("sessions")
    .select("id, title, status, join_code")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { id: data.id, title: data.title, status: data.status, joinCode: data.join_code } : null;
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

/** Estado que o celular do participante precisa: interaction ativa e se já respondeu. */
export async function getCurrentForParticipant(
  admin: AdminSupabase,
  sessionId: string,
  participantId: string,
): Promise<CurrentInteractionResponse> {
  const state = await getLiveState(admin, sessionId);
  if (!state) return { status: "draft", interaction: null, answered: false };

  if (state.status !== "live" || !state.active_interaction_id) {
    return { status: state.status, interaction: null, answered: false };
  }

  const interaction = await getPublicInteraction(admin, state.active_interaction_id);
  const { count, error } = await admin
    .from("responses")
    .select("id", { count: "exact", head: true })
    .eq("interaction_id", state.active_interaction_id)
    .eq("participant_id", participantId);
  if (error) throw new Error(error.message);

  return { status: state.status, interaction, answered: (count ?? 0) > 0 };
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
 */
export async function getPublicLeaderboard(admin: AdminSupabase, sessionId: string): Promise<LeaderboardEntry[] | null> {
  const state = await getLiveState(admin, sessionId);
  if (!state || state.status === "draft" || !state.show_leaderboard) return null;

  const { data: quizzes, error } = await admin
    .from("interactions")
    .select("id, activated_at")
    .eq("session_id", sessionId)
    .eq("type", "quiz");
  if (error) throw new Error(error.message);
  if (quizzes.length === 0) return [];

  const quizIds = quizzes.map((q) => q.id);
  const [responses, participants] = await Promise.all([
    fetchAllRows<{ participant_id: string; interaction_id: string; value: unknown }>((from, to) =>
      admin.from("responses").select("participant_id, interaction_id, value").in("interaction_id", quizIds).range(from, to),
    ),
    fetchAllRows<{ id: string; display_name: string | null }>((from, to) =>
      admin.from("participants").select("id, display_name").eq("session_id", sessionId).range(from, to),
    ),
  ]);

  // "Antes do último quiz": o quiz respondido aberto por último.
  const answered = new Set(responses.map((r) => r.interaction_id));
  const latest = quizzes
    .filter((q) => answered.has(q.id) && q.activated_at)
    .sort((a, b) => (b.activated_at ?? "").localeCompare(a.activated_at ?? ""))[0];

  return leaderboard(
    responses.map((r) => ({ participantId: r.participant_id, interactionId: r.interaction_id, value: r.value })),
    participants,
    latest?.id ?? null,
  );
}
