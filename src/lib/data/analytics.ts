import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type {
  FeedbackRow,
  InsightRow,
  ParticipantRow,
  ResponseRow,
  SessionRow,
} from "@/lib/supabase/types";
import { computeHistory, type AnalyticsData, type HistoryRow } from "@/lib/domain/metrics";
import { getOwnedSession, getSessionInteractions, type InteractionWithOptions } from "./sessions";

export type SessionAnalyticsBundle = AnalyticsData & {
  interactionsWithOptions: InteractionWithOptions[];
  latestInsights: InsightRow[];
};

export async function loadSessionAnalytics(
  supabase: ServerSupabase,
  sessionId: string,
): Promise<SessionAnalyticsBundle | null> {
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return null;

  const [interactionsWithOptions, participants, responses, feedback, insights] = await Promise.all([
    getSessionInteractions(supabase, sessionId),
    fetchAllRows<ParticipantRow>((from, to) =>
      supabase.from("participants").select("*").eq("session_id", sessionId).order("created_at").range(from, to),
    ),
    fetchAllRows<ResponseRow>((from, to) =>
      supabase.from("responses").select("*").eq("session_id", sessionId).order("created_at").range(from, to),
    ),
    fetchAllRows<FeedbackRow>((from, to) =>
      supabase.from("feedback").select("*").eq("session_id", sessionId).order("created_at").range(from, to),
    ),
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
    feedback,
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

  const [feedback, participants, responders] = await Promise.all([
    fetchAllRows<FeedbackRow>((from, to) => supabase.from("feedback").select("*").in("session_id", ids).range(from, to)),
    fetchAllRows<Pick<ParticipantRow, "id" | "session_id">>((from, to) =>
      supabase.from("participants").select("id, session_id").in("session_id", ids).range(from, to),
    ),
    fetchAllRows<Pick<ResponseRow, "participant_id" | "session_id">>((from, to) =>
      supabase.from("responses").select("participant_id, session_id").in("session_id", ids).range(from, to),
    ),
  ]);

  return { sessions, history: computeHistory(completed, feedback, participants, responders) };
}
