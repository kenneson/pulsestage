import "server-only";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { getLiveState } from "@/lib/data/public";
import {
  isQuestionStatus,
  sortQuestions,
  topQuestions,
  type ParticipantQuestions,
  type PublicQuestion,
  type QuestionStatus,
} from "@/lib/domain/questions";
import { emptyTally, tallyReactions, type ReactionTally } from "@/lib/domain/reactions";

// Perguntas da plateia e reações ao vivo. Para o celular e o telão (secret key), só o que cada
// tela mostra: nada de ids de participante. Para o palestrante, leitura pelo RLS.

const MAX_QUESTIONS = 300;

/** Perguntas que o celular vê: abertas e respondidas de todos, e as próprias aguardando aprovação. */
export async function getParticipantQuestions(
  admin: AdminSupabase,
  sessionId: string,
  participantId: string,
): Promise<ParticipantQuestions> {
  const { data: session } = await admin.from("sessions").select("qa_enabled, qa_moderated").eq("id", sessionId).maybeSingle();
  if (!session?.qa_enabled) return { enabled: false, moderated: false, questions: [] };

  const [questions, votes] = await Promise.all([
    admin
      .from("audience_questions")
      .select("id, body, author_name, upvotes, status, participant_id, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(MAX_QUESTIONS),
    admin.from("audience_question_votes").select("question_id").eq("participant_id", participantId),
  ]);
  if (questions.error) throw new Error(questions.error.message);
  const voted = new Set((votes.data ?? []).map((v) => v.question_id));

  const list: PublicQuestion[] = [];
  for (const q of questions.data) {
    const mine = q.participant_id === participantId;
    // A própria pergunta oculta (moderada ou filtrada) continua "aguardando" para quem perguntou.
    const status = q.status === "visible" || q.status === "answered" ? q.status : mine ? "pending" : null;
    if (!status) continue;
    list.push({
      id: q.id,
      body: q.body,
      author: q.author_name,
      upvotes: q.upvotes,
      status,
      mine,
      voted: voted.has(q.id),
      createdAt: q.created_at,
    });
  }
  return { enabled: true, moderated: session.qa_moderated, questions: sortQuestions(list) };
}

export type DisplayQuestion = { id: string; body: string; author: string | null; upvotes: number; answered: boolean };
export type DisplayQuestions = { highlight: DisplayQuestion | null; questions: DisplayQuestion[]; total: number };

/** Para o telão, só enquanto o palestrante mostra as perguntas. */
export async function getDisplayQuestions(admin: AdminSupabase, sessionId: string): Promise<DisplayQuestions | null> {
  const state = await getLiveState(admin, sessionId);
  if (!state || state.status !== "live" || !state.show_questions) return null;

  const { data, error } = await admin
    .from("audience_questions")
    .select("id, body, author_name, upvotes, status, created_at")
    .eq("session_id", sessionId)
    .in("status", ["visible", "answered"])
    .order("created_at", { ascending: false })
    .limit(MAX_QUESTIONS);
  if (error) throw new Error(error.message);

  const toDisplay = (q: (typeof data)[number]): DisplayQuestion => ({
    id: q.id,
    body: q.body,
    author: q.author_name,
    upvotes: q.upvotes,
    answered: q.status === "answered",
  });
  const sortable = data.map((q) => ({ ...q, createdAt: q.created_at }));
  const highlight = state.question_id ? sortable.find((q) => q.id === state.question_id) : undefined;
  return {
    highlight: highlight ? toDisplay(highlight) : null,
    questions: topQuestions(sortable).map(toDisplay),
    total: data.filter((q) => q.status === "visible").length,
  };
}

/** Reações desde `after` (id), só com a sessão ao vivo. Sem `after`, devolve só o ponto de partida. */
export async function getReactionsSince(
  admin: AdminSupabase,
  sessionId: string,
  after: number | null,
): Promise<{ last: number; tally: ReactionTally } | null> {
  const { data: session } = await admin.from("sessions").select("status, reactions_enabled").eq("id", sessionId).maybeSingle();
  if (!session || session.status !== "live" || !session.reactions_enabled) return null;

  if (after === null) {
    const { data } = await admin
      .from("reactions")
      .select("id")
      .eq("session_id", sessionId)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { last: data?.id ?? 0, tally: emptyTally() };
  }

  const { data, error } = await admin
    .from("reactions")
    .select("id, kind")
    .eq("session_id", sessionId)
    .gt("id", after)
    .order("id", { ascending: true })
    .limit(2000);
  if (error) throw new Error(error.message);
  return { last: data.at(-1)?.id ?? after, tally: tallyReactions(data) };
}

// ---------------------------------------------------------------------------
// Palestrante (RLS)
// ---------------------------------------------------------------------------

export type SpeakerQuestion = {
  id: string;
  body: string;
  author: string | null;
  upvotes: number;
  status: QuestionStatus;
  filtered: boolean;
  createdAt: string;
  answeredAt: string | null;
};

export async function listSessionQuestions(supabase: ServerSupabase, sessionId: string): Promise<SpeakerQuestion[]> {
  const { data, error } = await supabase
    .from("audience_questions")
    .select("id, body, author_name, upvotes, status, filtered, created_at, answered_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return sortQuestions(
    data
      .filter((q) => isQuestionStatus(q.status))
      .map((q) => ({
        id: q.id,
        body: q.body,
        author: q.author_name,
        upvotes: q.upvotes,
        status: q.status as QuestionStatus,
        filtered: q.filtered,
        createdAt: q.created_at,
        answeredAt: q.answered_at,
      })),
  );
}

export async function loadReactions(supabase: ServerSupabase, sessionId: string): Promise<{ kind: string; created_at: string }[]> {
  return fetchAllRows((from, to) =>
    supabase.from("reactions").select("kind, created_at").eq("session_id", sessionId).order("id").range(from, to),
  );
}

export type ModerationItem = {
  id: string;
  text: string;
  moderation: "pending" | "hidden";
  filtered: boolean;
  createdAt: string;
};

export type ModerationQueue = {
  /** respostas abertas aguardando aprovação ou ocultas */
  responses: ModerationItem[];
  /** palavras ocultas da nuvem, com quantas vezes foram enviadas */
  hiddenTerms: { term: string; count: number; filtered: boolean }[];
};

/** O que está fora do telão numa interação de texto (nuvem ou aberta). */
export async function getModerationQueue(supabase: ServerSupabase, interactionId: string): Promise<ModerationQueue> {
  const { data, error } = await supabase
    .from("responses")
    .select("id, value, aggregate_key, moderation, metadata, created_at")
    .eq("interaction_id", interactionId)
    .in("moderation", ["pending", "hidden"])
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  const textOf = (value: unknown) =>
    typeof value === "object" && value !== null && "text" in value && typeof value.text === "string" ? value.text : "";
  const filteredOf = (metadata: unknown) =>
    typeof metadata === "object" && metadata !== null && "filtered" in metadata && metadata.filtered === true;

  const terms = new Map<string, { term: string; count: number; filtered: boolean }>();
  const responses: ModerationItem[] = [];
  for (const r of data) {
    if (r.aggregate_key) {
      const item = terms.get(r.aggregate_key) ?? { term: r.aggregate_key, count: 0, filtered: false };
      item.count += 1;
      item.filtered ||= filteredOf(r.metadata);
      terms.set(r.aggregate_key, item);
    } else {
      responses.push({
        id: r.id,
        text: textOf(r.value),
        moderation: r.moderation === "pending" ? "pending" : "hidden",
        filtered: filteredOf(r.metadata),
        createdAt: r.created_at,
      });
    }
  }
  return { responses, hiddenTerms: [...terms.values()].sort((a, b) => b.count - a.count) };
}
