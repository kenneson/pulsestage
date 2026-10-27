import { test } from "node:test";
import assert from "node:assert/strict";
import { median, readableAnswer, summarizeInteraction, type SummaryResponse } from "../src/lib/domain/interaction-summary.ts";
import { computePulse, EMPTY_SURVEY, scoredResponses, type AnalyticsData } from "../src/lib/domain/metrics.ts";
import type { InteractionRow, ParticipantRow, ResponseRow, SessionRow } from "../src/lib/supabase/types.ts";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const options = [
  { id: B, label: "Bê", position: 1, is_correct: false },
  { id: A, label: "A", position: 0, is_correct: true },
];
let n = 0;
const resp = (value: unknown, aggregate_key: string | null = null, participant = `p${n}`): SummaryResponse => ({
  id: `r${++n}`,
  participant_id: participant,
  aggregate_key,
  value,
  created_at: new Date(Date.UTC(2026, 0, 1, 10, n)).toISOString(),
  moderation: "visible",
});

test("mediana de lista par, ímpar e vazia", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), null);
});

test("100 pontos: média por alternativa, da maior para a menor", () => {
  const s = summarizeInteraction({ id: "i", type: "points_100", title: "T", settings: {} }, options, [
    resp({ allocations: { [A]: 70, [B]: 30 }, tally: { [A]: 70, [B]: 30 } }),
    resp({ allocations: { [B]: 100 }, tally: { [B]: 100 } }),
  ]);
  assert.ok(s?.kind === "points");
  assert.deepEqual(
    s.rows.map((r) => [r.label, r.average]),
    [
      ["Bê", 65],
      ["A", 35],
    ],
  );
});

test("matriz: posição média de cada item posicionado", () => {
  const s = summarizeInteraction({ id: "i", type: "matrix_2x2", title: "T", settings: { xLabel: "Esforço" } }, options, [
    resp({ positions: { [A]: { x: 80, y: 20 } }, tally: { [`${A}:x`]: 80, [`${A}:y`]: 20, [`${A}:n`]: 1 } }),
    resp({ positions: { [A]: { x: 60, y: 40 } }, tally: { [`${A}:x`]: 60, [`${A}:y`]: 40, [`${A}:n`]: 1 } }),
  ]);
  assert.ok(s?.kind === "matrix");
  assert.deepEqual(s.rows, [{ key: A, label: "A", x: 70, y: 30, count: 2 }]);
  assert.equal(s.axes.xLabel, "Esforço");
});

test("adivinhe o número: média, mediana, gabarito, mais perto e quem chegou perto", () => {
  const settings = { numMin: 0, numMax: 100, decimals: 0, unit: "kg", maxPoints: 100 };
  const guess = (value: number, isCorrect: boolean, points: number) =>
    resp({ value, isCorrect, points, responseTimeMs: 1000, tally: { "b:0": 1, _sum: value } });
  const s = summarizeInteraction(
    { id: "i", type: "guess_number", title: "T", settings, answer_key: { value: 42 } },
    [],
    [guess(40, true, 92), guess(10, false, 0), guess(50, false, 68)],
  );
  assert.ok(s?.kind === "guess");
  assert.equal(s.mean, 100 / 3);
  assert.equal(s.median, 40);
  assert.equal(s.answer, 42);
  assert.equal(s.closest, 40);
  assert.equal(s.hitRate, 1 / 3);
  assert.equal(s.unit, "kg");
});

test("quiz de digitar: acertos e respostas mais comuns agrupadas, com a grafia mais usada", () => {
  const typed = (text: string, normalized: string, isCorrect: boolean) =>
    resp({ text, normalized, isCorrect, points: isCorrect ? 100 : 0, responseTimeMs: 2000 }, normalized);
  const s = summarizeInteraction(
    { id: "i", type: "quiz_text", title: "T", settings: {}, answer_key: { accepted: ["Brasília"] } },
    [],
    [typed("Brasília", "brasilia", true), typed("brasilia", "brasilia", true), typed("Brasília", "brasilia", true), typed("Rio", "rio", false)],
  );
  assert.ok(s?.kind === "quizText");
  assert.equal(s.correctRate, 0.75);
  assert.equal(s.avgResponseMs, 2000);
  assert.deepEqual(s.accepted, ["Brasília"]);
  assert.deepEqual(s.answers, [
    { key: "brasilia", text: "Brasília", count: 3, correct: true },
    { key: "rio", text: "Rio", count: 1, correct: false },
  ]);
});

test("enquete com várias escolhas e quiz com a alternativa certa", () => {
  const multi = summarizeInteraction({ id: "i", type: "multiple_choice", title: "T", settings: { maxChoices: 2 } }, options, [
    resp({ optionIds: [A, B], tally: { [A]: 1, [B]: 1 } }),
    resp({ optionIds: [A], tally: { [A]: 1 } }),
  ]);
  assert.ok(multi?.kind === "choice" && multi.multi);
  assert.deepEqual(
    multi.rows.map((r) => [r.label, r.pct]),
    [
      ["A", 1],
      ["Bê", 0.5],
    ],
  );
  const quiz = summarizeInteraction({ id: "i", type: "quiz", title: "T", settings: {} }, options, [
    resp({ optionId: A, isCorrect: true, points: 100, responseTimeMs: 1000 }, A),
    resp({ optionId: B, isCorrect: false, points: 0, responseTimeMs: 3000 }, B),
  ]);
  assert.ok(quiz?.kind === "quiz");
  assert.equal(quiz.correctRate, 0.5);
  assert.equal(quiz.rows.find((r) => r.correct)?.label, "A");
  assert.equal(summarizeInteraction({ id: "i", type: "content", title: "T", settings: {} }, [], [])?.kind, "content");
  assert.equal(summarizeInteraction({ id: "i", type: "inexistente", title: "T", settings: {} }, [], []), null);
});

test("marcar na imagem: total e pontos mais marcados", () => {
  const s = summarizeInteraction({ id: "i", type: "pin_image", title: "T", settings: {} }, [], [
    resp({ x: 0.51, y: 0.52, tally: { "c:10:10": 1 } }),
    resp({ x: 0.52, y: 0.53, tally: { "c:10:10": 1 } }),
    resp({ x: 0.01, y: 0.01, tally: { "c:0:0": 1 } }),
  ]);
  assert.ok(s?.kind === "pin");
  assert.equal(s.total, 3);
  assert.deepEqual(s.hotspots[0], { x: 0.525, y: 0.525, count: 2 });
});

test("resposta legível no CSV para cada tipo", () => {
  const opts = [...options].sort((a, b) => a.position - b.position);
  assert.equal(readableAnswer("multiple_choice", { optionId: B }, opts), "Bê");
  assert.equal(readableAnswer("multiple_choice", { optionIds: [B, A] }, opts), "A · Bê");
  assert.equal(readableAnswer("ranking", { order: [B, A], points: {} }, opts), "Bê > A");
  assert.equal(readableAnswer("points_100", { allocations: { [B]: 30, [A]: 70 } }, opts), "A: 70 · Bê: 30");
  assert.equal(
    readableAnswer("matrix_2x2", { positions: { [B]: { x: 10, y: 90 }, [A]: { x: 80, y: 20 } } }, opts),
    "A (x 80, y 20) · Bê (x 10, y 90)",
  );
  assert.equal(readableAnswer("pin_image", { x: 0.4231, y: 0.18 }, []), "x 42%, y 18%");
  assert.equal(readableAnswer("guess_number", { value: 41.5, isCorrect: true }, []), 41.5);
  assert.equal(readableAnswer("guess_number", { value: 41.5 }, [], { unit: "kg" }), "41,5 kg");
  assert.equal(readableAnswer("guess_number", { value: 41.5 }, [], { unit: "kg" }, "."), "41.5 kg");
  assert.equal(readableAnswer("quiz_text", { text: "Brasília", normalized: "brasilia", isCorrect: true }, []), "Brasília");
  assert.equal(readableAnswer("rating", { value: 4 }, []), 4);
  assert.equal(readableAnswer("open_text", { text: "Oi" }, []), "Oi");
  assert.equal(readableAnswer("points_100", { nada: 1 }, opts), null);
});

const row = <T>(value: Partial<T>): T => value as T;
const at = (minute: number) => new Date(Date.UTC(2026, 0, 1, 10, minute)).toISOString();

test("participação: slide de conteúdo fica fora; ritmo próprio entra tudo, na ordem do roteiro", () => {
  const interactions = [
    row<InteractionRow>({ id: "c", type: "content", title: "Slide", position: 0, activated_at: at(5), closed_at: at(6) }),
    row<InteractionRow>({ id: "q2", type: "quiz_text", title: "Q2", position: 2, activated_at: null, closed_at: null }),
    row<InteractionRow>({ id: "q1", type: "guess_number", title: "Q1", position: 1, activated_at: at(10), closed_at: at(12) }),
  ];
  const base: AnalyticsData = {
    session: row<SessionRow>({ id: "s", started_at: at(0), ended_at: at(60), pace: "live" }),
    interactions,
    participants: [row<ParticipantRow>({ id: "a", created_at: at(1) })],
    responses: [row<ResponseRow>({ participant_id: "a", interaction_id: "q1" })],
    survey: EMPTY_SURVEY,
  };
  assert.deepEqual(
    computePulse(base).map((p) => [p.interactionId, p.minute]),
    [["q1", 10]],
  );
  const self = computePulse({ ...base, session: { ...base.session, pace: "self" } });
  assert.deepEqual(
    self.map((p) => [p.interactionId, p.minute]),
    [
      ["q1", null],
      ["q2", null],
    ],
  );

  const scored = scoredResponses(
    [row<ResponseRow>({ interaction_id: "q1" }), row<ResponseRow>({ interaction_id: "c" }), row<ResponseRow>({ interaction_id: "q2" })],
    [...interactions, row<InteractionRow>({ id: "mc", type: "multiple_choice" })],
  );
  assert.deepEqual(
    scored.map((r) => r.interaction_id),
    ["q1", "q2"],
  );
});
