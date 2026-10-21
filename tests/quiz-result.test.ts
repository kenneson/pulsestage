import { test } from "node:test";
import assert from "node:assert/strict";
import { quizResultKind, quizResultSchema, quizReveal, quizRevealDelayMs } from "../src/lib/domain/quiz-result.ts";
import { rankQuiz, standingIn } from "../src/lib/domain/leaderboard.ts";
import { QUIZ_GRACE_MS } from "../src/lib/domain/interactions.ts";

const opened = "2026-10-21T12:00:00.000Z";
const at = (ms: number) => Date.parse(opened) + ms;

test("quiz que nunca foi ao ar não revela (a plateia não viu)", () => {
  assert.deepEqual(quizReveal({ isActive: false, activatedAt: null, timerSeconds: 30, now: at(0) }), {
    revealed: false,
    retryInMs: null,
  });
});

test("encerrado ou trocado: revela na hora", () => {
  assert.deepEqual(quizReveal({ isActive: false, activatedAt: opened, timerSeconds: null, now: at(1000) }), { revealed: true });
});

test("com tempo: só depois do tempo e da folga; antes, diz quando tentar", () => {
  const before = quizReveal({ isActive: true, activatedAt: opened, timerSeconds: 20, now: at(10_000) });
  assert.equal(before.revealed, false);
  assert.ok(!before.revealed && before.retryInMs !== null && before.retryInMs >= 10_000 + QUIZ_GRACE_MS);
  // No limite exato da folga ainda dá para responder.
  assert.equal(quizReveal({ isActive: true, activatedAt: opened, timerSeconds: 20, now: at(20_000 + QUIZ_GRACE_MS) }).revealed, false);
  assert.deepEqual(quizReveal({ isActive: true, activatedAt: opened, timerSeconds: 20, now: at(20_001 + QUIZ_GRACE_MS) }), {
    revealed: true,
  });
});

test("sem tempo e aberto: espera o palestrante encerrar", () => {
  assert.deepEqual(quizReveal({ isActive: true, activatedAt: opened, timerSeconds: null, now: at(60_000) }), {
    revealed: false,
    retryInMs: null,
  });
});

test("celular: pergunta já fora do ar busca agora; sem tempo e aberta, espera", () => {
  assert.equal(quizRevealDelayMs({ stillActive: false, activatedAt: opened, timerSeconds: 30, now: at(0) }), 0);
  assert.equal(quizRevealDelayMs({ stillActive: true, activatedAt: opened, timerSeconds: null, now: at(0) }), null);
  const delay = quizRevealDelayMs({ stillActive: true, activatedAt: opened, timerSeconds: 30, now: at(5000) });
  assert.ok(delay !== null && delay > 25_000 + QUIZ_GRACE_MS);
});

test("tom do resultado: acertou, errou ou sem resposta", () => {
  const base = { status: "revealed" as const, points: 0, correctLabel: null, standing: null };
  assert.equal(quizResultKind({ ...base, answered: true, correct: true, points: 900 }), "correct");
  assert.equal(quizResultKind({ ...base, answered: true, correct: false }), "wrong");
  assert.equal(quizResultKind({ ...base, answered: false, correct: false }), "missed");
  assert.equal(quizResultSchema.safeParse({ status: "pending", retryInMs: null }).success, true);
  assert.equal(quizResultSchema.safeParse({ status: "revealed", answered: true }).success, false);
});

test("posição de cada um no quiz da sessão", () => {
  const quiz = (points: number, isCorrect = points > 0) => ({ optionId: "o", isCorrect, points, responseTimeMs: 1000 });
  const ranking = rankQuiz([
    { participantId: "ana", interactionId: "q1", value: quiz(900) },
    { participantId: "bia", interactionId: "q1", value: quiz(0) },
    { participantId: "caio", interactionId: "q1", value: quiz(700) },
    { participantId: "ana", interactionId: "q2", value: quiz(0) },
    { participantId: "caio", interactionId: "q2", value: quiz(800) },
  ]);
  assert.deepEqual(standingIn(ranking, "caio"), { points: 1500, correct: 2, rank: 1, of: 3 });
  assert.deepEqual(standingIn(ranking, "ana"), { points: 900, correct: 1, rank: 2, of: 3 });
  assert.deepEqual(standingIn(ranking, "bia"), { points: 0, correct: 0, rank: 3, of: 3 });
  assert.equal(standingIn(ranking, "davi"), null);
});
