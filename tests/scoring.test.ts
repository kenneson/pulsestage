import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isFilteredText,
  isRatingInRange,
  moderationFor,
  quizAnswerOutcome,
  quizTimedOut,
  responseTimeMs,
} from "../src/lib/domain/scoring.ts";
import { QUIZ_GRACE_MS } from "../src/lib/domain/interactions.ts";

const OPENED = "2026-10-16T12:00:00.000Z";
const T0 = Date.parse(OPENED);

test("moderação: palavrão oculta, aprovação deixa pendente, senão visível", () => {
  assert.equal(moderationFor({ filtered: true, moderated: true }), "hidden");
  assert.equal(moderationFor({ filtered: true, moderated: false }), "hidden");
  assert.equal(moderationFor({ filtered: false, moderated: true }), "pending");
  assert.equal(moderationFor({ filtered: false, moderated: false }), "visible");
});

test("filtro de palavrões só barra com o filtro ligado", () => {
  assert.equal(isFilteredText("que merda", { profanityFilter: true, locale: "pt-BR" }), true);
  assert.equal(isFilteredText("que merda", { profanityFilter: false, locale: "pt-BR" }), false);
  assert.equal(isFilteredText("ótima palestra", { profanityFilter: true, locale: "pt-BR" }), false);
});

test("tempo de resposta conta da abertura e nunca é negativo", () => {
  assert.equal(responseTimeMs(OPENED, T0 + 4200), 4200);
  assert.equal(responseTimeMs(OPENED, T0 - 1000), 0);
  assert.equal(responseTimeMs(null, T0), 0);
});

test("prazo do quiz inclui a folga de rede", () => {
  assert.equal(quizTimedOut(10_000 + QUIZ_GRACE_MS, 10), false);
  assert.equal(quizTimedOut(10_000 + QUIZ_GRACE_MS + 1, 10), true);
  assert.equal(quizTimedOut(10 * 60_000, null), false);
});

test("quiz: certa vale os pontos, errada vale 0", () => {
  const base = { activatedAt: OPENED, now: T0 + 3000, timerSeconds: null, speedBonus: false };
  assert.deepEqual(quizAnswerOutcome({ ...base, option: { isCorrect: true, points: 100 } }), {
    ok: true,
    isCorrect: true,
    points: 100,
    responseTimeMs: 3000,
  });
  assert.deepEqual(quizAnswerOutcome({ ...base, option: { isCorrect: false, points: 100 } }), {
    ok: true,
    isCorrect: false,
    points: 0,
    responseTimeMs: 3000,
  });
});

test("quiz: bônus de velocidade reduz até a metade dos pontos", () => {
  const option = { isCorrect: true, points: 100 };
  const fast = quizAnswerOutcome({ option, activatedAt: OPENED, now: T0, timerSeconds: 20, speedBonus: true });
  const half = quizAnswerOutcome({ option, activatedAt: OPENED, now: T0 + 10_000, timerSeconds: 20, speedBonus: true });
  const late = quizAnswerOutcome({ option, activatedAt: OPENED, now: T0 + 21_000, timerSeconds: 20, speedBonus: true });
  assert.ok(fast.ok && fast.points === 100);
  assert.ok(half.ok && half.points === 75);
  // Dentro da folga, depois do tempo: aceita com o mínimo.
  assert.ok(late.ok && late.points === 50);
});

test("quiz: depois do prazo e da folga, recusa com timeout", () => {
  const outcome = quizAnswerOutcome({
    option: { isCorrect: true, points: 100 },
    activatedAt: OPENED,
    now: T0 + 20_000 + QUIZ_GRACE_MS + 1,
    timerSeconds: 20,
    speedBonus: false,
  });
  assert.deepEqual(outcome, { ok: false, error: "participant.errors.timeUp", code: "timeout" });
});

test("escala: aceita as pontas e recusa fora da faixa", () => {
  const range = { min: 1, max: 5 };
  assert.ok(isRatingInRange(1, range));
  assert.ok(isRatingInRange(5, range));
  assert.ok(!isRatingInRange(0, range));
  assert.ok(!isRatingInRange(6, range));
});
