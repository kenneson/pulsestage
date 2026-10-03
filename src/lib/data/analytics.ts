import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type {
  InsightRow,
  ParticipantRow,
  ResponseRow,
  SessionRow,
  SessionSurveyQuestionRow,
} from "@/lib/supabase/types";
import {
  computeHistory,
  EMPTY_SURVEY,
  type AnalyticsData,
  type HistoryRow,
  type SessionSurveyData,
} from "@/lib/domain/metrics";
import { toSurveyQuestions, type AnswerLike } from "@/lib/domain/survey";
import { getOwnedSession, getSessionInteractions, type InteractionWithOptions } from "./sessions";

export type SessionAnalyticsBundle = AnalyticsData & {
  interactionsWithOptions: InteractionWithOptions[];
  latestInsights: InsightRow[];
};

/**
 * Pesquisas pós-evento (perguntas copiadas, contagem e respostas) das sessões dadas.
 * Sem os textos livres quando `withText` é falso (evolução entre sessões não precisa deles).
 */
async function loadSessionSurveys(
  supabase: ServerSupabase,
  sessionIds: string[],
  withText: boolean,
): Promise<Map<string, SessionSurveyData>> {
  const result = new Map<string, SessionSurveyData>();
  if (sessionIds.length === 0) return result;

  const [surveys, questionRows, responses, answers] = await Promise.all([
    supabase.from("session_surveys").select("session_id, name").in("session_id", sessionIds),
    fetchAllRows<SessionSurveyQuestionRow>((from, to) =>
      supabase.from("session_survey_questions").select("*").in("session_id", sessionIds).order("position").range(from, to),
    ),
    fetchAllRows<{ session_id: string }>((from, to) =>
      supabase.from("survey_responses").select("session_id").in("session_id", sessionIds).range(from, to),
    ),
    fetchAllRows<AnswerLike>((from, to) =>
      supabase
        .from("survey_answers")
        .select("question_id, value_int, value_text, survey_responses!inner(session_id)")
        .in("survey_responses.session_id", sessionIds)
        .range(from, to)
        .then(({ data, error }) => ({
          data: (data ?? []).map((a) => ({
            question_id: a.question_id,
            value_int: a.value_int,
            value_text: withText ? a.value_text : null,
          })),
          error,
        })),
    ),
  ]);
  if (surveys.error) throw new Error(surveys.error.message);

  const questionSession = new Map(questionRows.map((q) => [q.id, q.session_id]));
  for (const s of surveys.data) {
    result.set(s.session_id, {
      name: s.name,
      questions: toSurveyQuestions(questionRows.filter((q) => q.session_id === s.session_id)),
      responseCount: responses.filter((r) => r.session_id === s.session_id).length,
      answers: answers.filter((a) => questionSession.get(a.question_id) === s.session_id),
    });
  }
  return result;
}

export async function loadSessionAnalytics(
  supabase: ServerSupabase,
  sessionId: string,
): Promise<SessionAnalyticsBundle | null> {
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return null;

  const [interactionsWithOptions, participants, responses, surveys, insights] = await Promise.all([
    getSessionInteractions(supabase, sessionId),
    fetchAllRows<ParticipantRow>((from, to) =>
      supabase.from("participants").select("*").eq("session_id", sessionId).order("created_at").range(from, to),
    ),
    fetchAllRows<ResponseRow>((from, to) =>
      supabase.from("responses").select("*").eq("session_id", sessionId).order("created_at").range(from, to),
    ),
    loadSessionSurveys(supabase, [sessionId], true),
    supabase.from("insights").select("*").eq("session_id", sessionId).order("created_at", { ascending: false }).limit(50),
  ]);

  if (insights.error) throw new Error(insights.error.message);
  const latestGeneration = insights.data[0]?.generation_id;
  const latestInsights = latestGeneration ? insights.data.filter((i) => i.generation_id === latestGeneration) : [];

  return {
    session,
    interactions: interactionsWithOptions,
    interactionsWithOptions,
    participants,
    responses,
    survey: surveys.get(sessionId) ?? EMPTY_SURVEY,
    latestInsights,
  };
}

export type SpeakerHistory = { sessions: SessionRow[]; history: HistoryRow[] };

/** Evolução entre sessões encerradas do speaker logado. */
export async function loadSpeakerHistory(supabase: ServerSupabase): Promise<SpeakerHistory> {
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const completed = sessions.filter((s) => s.status === "completed");
  const ids = completed.map((s) => s.id);
  if (ids.length === 0) return { sessions, history: [] };

  const [surveys, participants, responders] = await Promise.all([
    loadSessionSurveys(supabase, ids, false),
    fetchAllRows<Pick<ParticipantRow, "id" | "session_id">>((from, to) =>
      supabase.from("participants").select("id, session_id").in("session_id", ids).range(from, to),
    ),
    fetchAllRows<Pick<ResponseRow, "participant_id" | "session_id">>((from, to) =>
      supabase.from("responses").select("participant_id, session_id").in("session_id", ids).range(from, to),
    ),
  ]);

  return { sessions, history: computeHistory(completed, surveys, participants, responders) };
}
