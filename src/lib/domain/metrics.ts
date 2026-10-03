import { z } from "zod";
import type { InteractionRow, ParticipantRow, ResponseRow, SessionRow } from "@/lib/supabase/types";
import {
  dimensionScores,
  headlineScore,
  scaleAverage,
  type AnswerLike,
  type DimensionScore,
  type SurveyQuestion,
} from "./survey.ts";

// Métricas baseadas em participação. Não medem atenção, aprendizado ou qualidade objetiva.

export function average(values: readonly (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function ts(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const value = Date.parse(iso);
  return Number.isNaN(value) ? null : value;
}

/** Pesquisa pós-evento de uma sessão: perguntas copiadas do modelo e respostas. */
export type SessionSurveyData = {
  name: string | null;
  questions: SurveyQuestion[];
  responseCount: number;
  answers: AnswerLike[];
};

export const EMPTY_SURVEY: SessionSurveyData = { name: null, questions: [], responseCount: 0, answers: [] };

export type AnalyticsData = {
  session: SessionRow;
  interactions: InteractionRow[];
  participants: ParticipantRow[];
  responses: ResponseRow[];
  survey: SessionSurveyData;
};

// ---------------------------------------------------------------------------
// Pesquisa pós-evento
// ---------------------------------------------------------------------------

export type SurveySummary = {
  count: number;
  dimensions: DimensionScore[];
  /** nota geral 0–10 (utilidade/satisfação/recomendação), quando o modelo tiver */
  headline: number | null;
  /** média das dimensões em 1–5 */
  scaleAverage: number | null;
};

export function summarizeSurvey(survey: SessionSurveyData): SurveySummary {
  const dimensions = dimensionScores(survey.questions, survey.answers);
  return {
    count: survey.responseCount,
    dimensions,
    headline: headlineScore(dimensions),
    scaleAverage: scaleAverage(dimensions),
  };
}

// ---------------------------------------------------------------------------
// Sinal de participação ao longo da sessão
// ---------------------------------------------------------------------------

export type PulsePoint = {
  interactionId: string;
  title: string;
  minute: number | null;
  responses: number;
  eligible: number;
  rate: number | null;
};

function eligibleParticipants(participants: readonly ParticipantRow[], cutoff: number | null): number {
  if (cutoff === null) return participants.length;
  return participants.filter((p) => (ts(p.created_at) ?? 0) <= cutoff).length;
}

/** Para cada interaction ativada: respostas / participantes que já tinham entrado. */
export function computePulse(data: AnalyticsData): PulsePoint[] {
  const start = ts(data.session.started_at);
  const sessionEnd = ts(data.session.ended_at);
  const responsesByInteraction = new Map<string, number>();
  for (const r of data.responses) {
    responsesByInteraction.set(r.interaction_id, (responsesByInteraction.get(r.interaction_id) ?? 0) + 1);
  }

  return data.interactions
    .filter((i) => i.activated_at !== null)
    .sort((a, b) => (ts(a.activated_at) ?? 0) - (ts(b.activated_at) ?? 0))
    .map((i) => {
      const activated = ts(i.activated_at);
      const cutoff = ts(i.closed_at) ?? sessionEnd;
      const eligible = eligibleParticipants(data.participants, cutoff);
      const responses = responsesByInteraction.get(i.id) ?? 0;
      return {
        interactionId: i.id,
        title: i.title,
        minute: start !== null && activated !== null ? Math.max(0, Math.round((activated - start) / 60000)) : null,
        responses,
        eligible,
        rate: ratio(responses, eligible),
      };
    });
}

// ---------------------------------------------------------------------------
// Visão geral
// ---------------------------------------------------------------------------

export type SessionOverview = {
  participants: number;
  uniqueResponders: number;
  totalResponses: number;
  responseOpportunities: number;
  /** respostas / oportunidades de resposta */
  responseRate: number | null;
  /** participantes que responderam algo / participantes que entraram */
  participationRate: number | null;
  /** pesquisas respondidas / participantes que entraram */
  surveyResponseRate: number | null;
  survey: SurveySummary;
};

export function computeOverview(data: AnalyticsData, pulse = computePulse(data)): SessionOverview {
  const uniqueResponders = new Set(data.responses.map((r) => r.participant_id)).size;
  const opportunities = pulse.reduce((sum, p) => sum + p.eligible, 0);
  return {
    participants: data.participants.length,
    uniqueResponders,
    totalResponses: data.responses.length,
    responseOpportunities: opportunities,
    responseRate: ratio(data.responses.length, opportunities),
    participationRate: ratio(uniqueResponders, data.participants.length),
    surveyResponseRate: ratio(data.survey.responseCount, data.participants.length),
    survey: summarizeSurvey(data.survey),
  };
}

export type Confidence = "low" | "medium" | "high";

export function confidenceFromSample(sampleSize: number): Confidence {
  if (sampleSize < 10) return "low";
  if (sampleSize < 30) return "medium";
  return "high";
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

const quizValueSchema = z.object({
  optionId: z.string(),
  isCorrect: z.boolean(),
  points: z.number(),
  responseTimeMs: z.number(),
});

export type QuizValue = z.infer<typeof quizValueSchema>;

export function parseQuizValue(value: unknown): QuizValue | null {
  const parsed = quizValueSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export type QuizStats = { answered: number; correctRate: number | null; avgResponseMs: number | null };

export function quizStats(responses: readonly ResponseRow[]): QuizStats {
  const values = responses.map((r) => parseQuizValue(r.value)).filter((v): v is QuizValue => v !== null);
  return {
    answered: values.length,
    correctRate: ratio(values.filter((v) => v.isCorrect).length, values.length),
    avgResponseMs: average(values.map((v) => v.responseTimeMs)),
  };
}

export type RankingEntry = { participantId: string; name: string; points: number; correct: number };

export function participantLabel(p: Pick<ParticipantRow, "id" | "display_name"> | undefined, id: string): string {
  return p?.display_name || `Participante ${id.slice(0, 4).toUpperCase()}`;
}

export function quizRanking(
  quizResponses: readonly ResponseRow[],
  participants: readonly ParticipantRow[],
  limit = 10,
): RankingEntry[] {
  const byId = new Map(participants.map((p) => [p.id, p]));
  const totals = new Map<string, RankingEntry>();
  for (const r of quizResponses) {
    const value = parseQuizValue(r.value);
    if (!value) continue;
    const entry = totals.get(r.participant_id) ?? {
      participantId: r.participant_id,
      name: participantLabel(byId.get(r.participant_id), r.participant_id),
      points: 0,
      correct: 0,
    };
    entry.points += value.points;
    entry.correct += value.isCorrect ? 1 : 0;
    totals.set(r.participant_id, entry);
  }
  return [...totals.values()].sort((a, b) => b.points - a.points || b.correct - a.correct).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Histórico entre sessões
// ---------------------------------------------------------------------------

export type HistoryRow = {
  sessionId: string;
  title: string;
  date: string | null;
  participants: number;
  participationRate: number | null;
  survey: SurveySummary;
};

export function computeHistory(
  sessions: readonly SessionRow[],
  surveys: ReadonlyMap<string, SessionSurveyData>,
  participants: readonly Pick<ParticipantRow, "id" | "session_id">[],
  responders: readonly Pick<ResponseRow, "participant_id" | "session_id">[],
): HistoryRow[] {
  return [...sessions]
    .sort((a, b) => (a.started_at ?? a.created_at).localeCompare(b.started_at ?? b.created_at))
    .map((s) => {
      const sessionParticipants = participants.filter((p) => p.session_id === s.id).length;
      const sessionResponders = new Set(responders.filter((r) => r.session_id === s.id).map((r) => r.participant_id))
        .size;
      return {
        sessionId: s.id,
        title: s.title,
        date: s.started_at ?? s.scheduled_at ?? s.created_at,
        participants: sessionParticipants,
        participationRate: ratio(sessionResponders, sessionParticipants),
        survey: summarizeSurvey(surveys.get(s.id) ?? EMPTY_SURVEY),
      };
    });
}
