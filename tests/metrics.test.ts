import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  FeedbackRow,
  InteractionRow,
  ParticipantRow,
  ResponseRow,
  SessionRow,
} from "../src/lib/supabase/types.ts";
import {
  average,
  computeHistory,
  computeOverview,
  computePulse,
  confidenceFromSample,
  quizRanking,
  quizStats,
  type AnalyticsData,
} from "../src/lib/domain/metrics.ts";

// Fixtures só com os campos que as métricas leem.
const row = <T>(value: Partial<T>): T => value as T;
const at = (minute: number) => new Date(Date.UTC(2026, 0, 1, 10, minute)).toISOString();

const session = row<SessionRow>({ id: "s1", title: "Palestra", started_at: at(0), ended_at: at(60), created_at: at(0) });
const participant = (id: string, joinedAt: number, display_name: string | null = null) =>
  row<ParticipantRow>({ id, session_id: "s1", display_name, created_at: at(joinedAt) });
const response = (participant_id: string, interaction_id: string, value: unknown = {}) =>
  row<ResponseRow>({ participant_id, interaction_id, session_id: "s1", value: value as ResponseRow["value"] });
const quiz = (participant_id: string, isCorrect: boolean, points: number, responseTimeMs = 1000) =>
  response(participant_id, "q", { optionId: "o", isCorrect, points, responseTimeMs });

test("average ignora nulos e não numéricos", () => {
  assert.equal(average([4, null, undefined, Number.NaN, 2]), 3);
  assert.equal(average([]), null);
});

test("pulse: só conta como presente quem entrou antes de a interação fechar", () => {
  const data: AnalyticsData = {
    session,
    interactions: [
      // fora de ordem de propósito: o pulse ordena por activated_at
      row<InteractionRow>({ id: "i2", title: "Segunda", activated_at: at(30), closed_at: at(35) }),
      row<InteractionRow>({ id: "i1", title: "Primeira", activated_at: at(10), closed_at: at(15) }),
      row<InteractionRow>({ id: "nunca", title: "Não ativada", activated_at: null, closed_at: null }),
    ],
    participants: [participant("a", 1), participant("b", 2), participant("c", 20)],
    responses: [response("a", "i1"), response("a", "i2"), response("b", "i2"), response("c", "i2")],
    feedback: [],
  };
  const pulse = computePulse(data);
  assert.deepEqual(
    pulse.map((p) => [p.interactionId, p.minute, p.responses, p.eligible]),
    [
      ["i1", 10, 1, 2], // "c" entrou no minuto 20, depois de i1 fechar
      ["i2", 30, 3, 3],
    ],
  );
  assert.equal(pulse[0]?.rate, 0.5);

  const overview = computeOverview(data, pulse);
  assert.equal(overview.participants, 3);
  assert.equal(overview.uniqueResponders, 3);
  assert.equal(overview.responseOpportunities, 5);
  assert.equal(overview.responseRate, 4 / 5);
  assert.equal(overview.participationRate, 1);
  assert.equal(overview.feedbackResponseRate, 0);
});

test("overview sem participantes devolve taxas nulas, não NaN", () => {
  const overview = computeOverview({ session, interactions: [], participants: [], responses: [], feedback: [] });
  assert.equal(overview.participationRate, null);
  assert.equal(overview.responseRate, null);
});

test("quizStats ignora valores malformados", () => {
  const stats = quizStats([quiz("a", true, 100, 1000), quiz("b", false, 0, 3000), response("c", "q", { lixo: 1 })]);
  assert.deepEqual(stats, { answered: 2, correctRate: 0.5, avgResponseMs: 2000 });
});

test("ranking soma pontos, desempata por acertos e usa rótulo para anônimos", () => {
  const participants = [participant("ana", 0, "Ana"), participant("bbbb-anon", 0)];
  const ranking = quizRanking(
    [quiz("ana", true, 50), quiz("ana", false, 0), quiz("bbbb-anon", true, 25), quiz("bbbb-anon", true, 25)],
    participants,
  );
  // empate em 50 pontos: quem acertou mais vem primeiro
  assert.deepEqual(
    ranking.map((r) => [r.name, r.points, r.correct]),
    [
      ["Participante BBBB", 50, 2],
      ["Ana", 50, 1],
    ],
  );
});

test("confiança pelo tamanho da amostra", () => {
  assert.equal(confidenceFromSample(9), "low");
  assert.equal(confidenceFromSample(10), "medium");
  assert.equal(confidenceFromSample(29), "medium");
  assert.equal(confidenceFromSample(30), "high");
});

test("histórico em ordem cronológica, com participação e notas por sessão", () => {
  const older = row<SessionRow>({ id: "old", title: "Antiga", started_at: at(0), created_at: at(0) });
  const newer = row<SessionRow>({ id: "new", title: "Nova", started_at: at(50), created_at: at(0) });
  const history = computeHistory(
    [newer, older],
    [row<FeedbackRow>({ session_id: "new", overall_rating: 8, clarity_rating: 4 })],
    [
      { id: "p1", session_id: "new" },
      { id: "p2", session_id: "new" },
      { id: "p3", session_id: "old" },
    ],
    [
      { participant_id: "p1", session_id: "new" },
      { participant_id: "p1", session_id: "new" },
    ],
  );
  assert.deepEqual(
    history.map((h) => [h.title, h.participants, h.participationRate, h.scores.overall]),
    [
      ["Antiga", 1, 0, null],
      ["Nova", 2, 0.5, 8],
    ],
  );
});
