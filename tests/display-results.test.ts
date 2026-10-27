import { test } from "node:test";
import assert from "node:assert/strict";
import { teamLeaderboard } from "../src/lib/domain/team-leaderboard.ts";
import type { LeaderboardResponse } from "../src/lib/domain/leaderboard.ts";
import {
  answerRevealAllowed,
  isRevealedText,
  revealedAnswerOf,
  revealedAnswerSchema,
  textCorrectShare,
} from "../src/lib/domain/answer-reveal.ts";
import { segmentApplies, segmentMembers, segmentSnapshot } from "../src/lib/domain/segment-results.ts";
import { axisPosition, countdown, pinHotRegion } from "../src/lib/domain/result-display.ts";
import { pinHeat } from "../src/lib/domain/results.ts";

const answer = (participantId: string, interactionId: string, points: number): LeaderboardResponse => ({
  participantId,
  interactionId,
  value: { optionId: "o", isCorrect: points > 0, points, responseTimeMs: 1000 },
});

const teams = [
  { id: "team-red-0000", name: "Vermelha", color: 1, position: 0 },
  { id: "team-blue-000", name: "Azul", color: 2, position: 1 },
  { id: "team-empty-00", name: "Vazia", color: 3, position: 2 },
];
const members = [
  { id: "p1", team_id: "team-red-0000" },
  { id: "p2", team_id: "team-red-0000" },
  { id: "p3", team_id: "team-red-0000" },
  { id: "p4", team_id: "team-blue-000" },
  { id: "p5", team_id: null },
];

test("ranking por equipes: média por pessoa, total desempata, equipe vazia fora", () => {
  const responses = [
    answer("p1", "q1", 100),
    answer("p2", "q1", 100),
    answer("p3", "q1", 100),
    answer("p4", "q1", 50),
    // q2: a equipe azul (1 pessoa) passa à frente pela média
    answer("p4", "q2", 300),
    answer("p5", "q2", 1000), // sem equipe: não conta
  ];
  const board = teamLeaderboard(responses, members, teams, "q2");
  assert.deepEqual(
    board.map((e) => [e.name, e.rank, e.people, e.total, e.average, e.previousRank, e.previousAverage]),
    [
      ["Azul", 1, 1, 350, 350, 2, 50],
      ["Vermelha", 2, 3, 300, 100, 1, 100],
    ],
  );
  assert.equal(board[0]?.key, "team-blue-000");
});

test("ranking por equipes: empate na média vai para o total; primeiro quiz não tem posição anterior", () => {
  const responses = [answer("p1", "q1", 100), answer("p2", "q1", 100), answer("p3", "q1", 100), answer("p4", "q1", 100)];
  const board = teamLeaderboard(responses, members, teams, "q1");
  assert.deepEqual(
    board.map((e) => [e.name, e.average, e.total, e.previousRank]),
    [
      ["Vermelha", 100, 300, null],
      ["Azul", 100, 100, null],
    ],
  );
  assert.deepEqual(teamLeaderboard([], members, teams, null).map((e) => [e.name, e.total]), [
    ["Vermelha", 0],
    ["Azul", 0],
  ]);
});

test("revelar resposta: só com a flag, a sessão em andamento e a pergunta no ar", () => {
  const state = { status: "live", active_interaction_id: "i1", answer_revealed: true };
  assert.equal(answerRevealAllowed(state, "i1"), true);
  assert.equal(answerRevealAllowed({ ...state, answer_revealed: false }, "i1"), false);
  assert.equal(answerRevealAllowed(state, "i2"), false);
  assert.equal(answerRevealAllowed({ ...state, status: "completed" }, "i1"), false);
  assert.equal(answerRevealAllowed(null, "i1"), false);
});

test("revelar resposta: gabarito de cada tipo vira o que o telão pode ver", () => {
  const options = [
    { id: "a", is_correct: false },
    { id: "b", is_correct: true },
  ];
  assert.deepEqual(revealedAnswerOf({ type: "quiz", options, answerKey: null }), { kind: "option", optionId: "b" });
  assert.deepEqual(revealedAnswerOf({ type: "guess_number", options: [], answerKey: { value: 42 } }), { kind: "number", value: 42 });
  assert.deepEqual(revealedAnswerOf({ type: "quiz_text", options: [], answerKey: { accepted: ["Brasília"] } }), {
    kind: "text",
    accepted: ["Brasília"],
  });
  assert.equal(revealedAnswerOf({ type: "guess_number", options: [], answerKey: {} }), null);
  assert.equal(revealedAnswerOf({ type: "multiple_choice", options, answerKey: null }), null);
  assert.equal(revealedAnswerSchema.safeParse({ kind: "number", value: 3 }).success, true);
});

test("quiz de digitar: respostas normalizadas aceitas e parte que acertou", () => {
  const revealed = { kind: "text" as const, accepted: ["Brasília"] };
  assert.equal(isRevealedText("brasilia", revealed), true);
  assert.equal(isRevealedText("brasila", revealed), true); // uma letra de diferença
  assert.equal(isRevealedText("rio de janeiro", revealed), false);
  assert.equal(textCorrectShare({ brasilia: 3, brasila: 1, "sao paulo": 4 }, 8, revealed), 0.5);
  assert.equal(textCorrectShare({ brasilia: 3 }, 3, null), null);
});

test("comparar grupos: quem escolheu a alternativa e snapshot só do grupo", () => {
  const members = segmentMembers(
    [
      { participant_id: "p1", value: { optionId: "dev" } },
      { participant_id: "p2", value: { optionId: "design" } },
      { participant_id: "p3", value: { optionIds: ["design", "dev"], tally: { design: 1, dev: 1 } } },
      { participant_id: "p4", value: { text: "?" } },
    ],
    "dev",
  );
  assert.deepEqual([...members].sort(), ["p1", "p3"]);
  const at = "2026-10-20T10:00:00Z";
  const snapshot = segmentSnapshot(
    [
      { id: "r1", participant_id: "p1", aggregate_key: "x", value: { optionId: "x" }, created_at: at, moderation: "visible" },
      { id: "r2", participant_id: "p2", aggregate_key: "x", value: { optionId: "x" }, created_at: at, moderation: "visible" },
      { id: "r3", participant_id: "p3", aggregate_key: null, value: { allocations: {}, tally: { y: 70, x: 30 } }, created_at: at },
    ],
    members,
  );
  assert.equal(snapshot.total, 2);
  assert.deepEqual(snapshot.counts, { x: 31, y: 70 });
  assert.equal(segmentApplies({ segmentOptionId: "dev", segmentInteractionId: "seg", interactionId: "q" }), true);
  assert.equal(segmentApplies({ segmentOptionId: "dev", segmentInteractionId: "seg", interactionId: "seg" }), false);
  assert.equal(segmentApplies({ segmentOptionId: null, segmentInteractionId: null, interactionId: "q" }), false);
});

test("marcar na imagem: área mais marcada", () => {
  assert.equal(pinHotRegion(pinHeat({ total: 0, counts: {}, recent: [] })), null);
  const heat = pinHeat({ total: 4, counts: { "c:0:0": 1, "c:19:19": 2, "c:10:10": 1 }, recent: [] });
  assert.equal(pinHotRegion(heat), "bottomRight");
  assert.equal(pinHotRegion(pinHeat({ total: 1, counts: { "c:10:2": 1 }, recent: [] })), "top");
});

test("eixo do número e cronômetro", () => {
  assert.equal(axisPosition(50, { numMin: 0, numMax: 200 }), 0.25);
  assert.equal(axisPosition(-5, { numMin: 0, numMax: 10 }), 0);
  assert.equal(axisPosition(99, { numMin: 0, numMax: 10 }), 1);
  const start = "2026-10-20T10:00:00.000Z";
  const t0 = Date.parse(start);
  assert.deepEqual(countdown({ activatedAt: start, seconds: 30, now: t0 + 10_200 }), {
    remaining: 20,
    fraction: (30_000 - 10_200) / 30_000,
    urgent: false,
    ended: false,
  });
  assert.equal(countdown({ activatedAt: start, seconds: 30, now: t0 + 25_500 }).urgent, true);
  assert.equal(countdown({ activatedAt: start, seconds: 30, now: t0 + 31_000 }).ended, true);
  assert.equal(countdown({ activatedAt: null, seconds: 30, now: t0 }).remaining, 30);
});
