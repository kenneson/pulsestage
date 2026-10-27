import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allocatedTotal,
  clampGuess,
  fractionInBox,
  guessMidpoint,
  matrixPosition,
  nudgeMatrix,
  parseGuessInput,
  pointsLeft,
  pointsPayload,
  scoredResultTone,
  secondsLeft,
  setAllocation,
  showsResultsOnPhone,
  smallestTeam,
  teamColor,
} from "../src/lib/domain/participant-answers.ts";
import {
  firstUnanswered,
  journeyResponseSchema,
  resumeIndex,
  stepTo,
  unansweredCount,
} from "../src/lib/domain/participant-journey.ts";

test("100 pontos: o saldo limita cada alternativa e o envio só sai com 100", () => {
  let a = setAllocation({}, "a", 70);
  a = setAllocation(a, "b", 50); // só restavam 30
  assert.deepEqual(a, { a: 70, b: 30 });
  assert.equal(pointsLeft(a), 0);
  assert.equal(allocatedTotal(a), 100);
  assert.deepEqual(pointsPayload({ ...a, c: 0 }), { a: 70, b: 30 });
  a = setAllocation(a, "a", -5);
  assert.equal(a.a, 0);
  assert.equal(pointsLeft(a), 70);
  assert.equal(pointsPayload(a), null);
  assert.equal(setAllocation({}, "x", 12.6).x, 13);
});

test("toque na área: frações de 0 a 1 e matriz com y crescendo para cima", () => {
  const box = { left: 10, top: 20, width: 200, height: 100 };
  assert.deepEqual(fractionInBox(110, 70, box), { x: 0.5, y: 0.5 });
  assert.deepEqual(fractionInBox(-50, 500, box), { x: 0, y: 1 });
  assert.deepEqual(matrixPosition(210, 20, box), { x: 100, y: 100 });
  assert.deepEqual(matrixPosition(10, 120, box), { x: 0, y: 0 });
  assert.deepEqual(nudgeMatrix({ x: 98, y: 3 }, 5, -5), { x: 100, y: 0 });
});

test("adivinhe o número: vírgula decimal, faixa e casas", () => {
  assert.equal(parseGuessInput("3,14"), 3.14);
  assert.equal(parseGuessInput(" -12 "), -12);
  assert.equal(parseGuessInput(""), null);
  assert.equal(parseGuessInput("abc"), null);
  assert.equal(parseGuessInput("1.2.3"), null);
  const range = { numMin: 0, numMax: 10, decimals: 1 };
  assert.equal(clampGuess(3.14159, range), 3.1);
  assert.equal(clampGuess(42, range), 10);
  assert.equal(guessMidpoint({ numMin: 0, numMax: 7, decimals: 0 }), 4);
});

test("cronômetro conta a partir da abertura", () => {
  const opened = "2026-10-21T12:00:00.000Z";
  const t0 = Date.parse(opened);
  assert.equal(secondsLeft(opened, 30, t0 + 100), 30);
  assert.equal(secondsLeft(opened, 30, t0 + 29_100), 1);
  assert.equal(secondsLeft(opened, 30, t0 + 31_000), 0);
  assert.equal(secondsLeft(null, 10, 5000, 1000), 6);
});

test("resultado no celular: só com a opção, nunca em tipo que pontua, e respeitando o oculto", () => {
  const s = (showResultsOnPhone: boolean, hideResults = false) => ({ showResultsOnPhone, hideResults });
  assert.equal(showsResultsOnPhone({ type: "multiple_choice", settings: s(true) }, false), true);
  assert.equal(showsResultsOnPhone({ type: "multiple_choice", settings: s(false) }, false), false);
  assert.equal(showsResultsOnPhone({ type: "points_100", settings: s(true, true) }, false), false);
  assert.equal(showsResultsOnPhone({ type: "points_100", settings: s(true, true) }, true), true);
  assert.equal(showsResultsOnPhone({ type: "quiz", settings: s(true) }, true), false);
  assert.equal(showsResultsOnPhone({ type: "guess_number", settings: s(true) }, true), false);
  assert.equal(showsResultsOnPhone({ type: "content", settings: s(true) }, true), false);
});

test("tom do resultado: chegou perto só no adivinhe o número com pontos", () => {
  assert.equal(scoredResultTone("guess_number", { answered: true, correct: false, points: 40 }), "close");
  assert.equal(scoredResultTone("guess_number", { answered: true, correct: false, points: 0 }), "wrong");
  assert.equal(scoredResultTone("quiz_text", { answered: true, correct: false, points: 10 }), "wrong");
  assert.equal(scoredResultTone("quiz", { answered: true, correct: true, points: 100 }), "correct");
  assert.equal(scoredResultTone("quiz", { answered: false, correct: false, points: 0 }), "missed");
});

test("equipe automática: a menor; empate fica com a primeira", () => {
  assert.equal(smallestTeam([]), null);
  assert.equal(
    smallestTeam([
      { id: "b", position: 1, members: 3 },
      { id: "a", position: 0, members: 3 },
      { id: "c", position: 2, members: 4 },
    ]),
    "a",
  );
  assert.equal(
    smallestTeam([
      { id: "a", position: 0, members: 5 },
      { id: "b", position: 1, members: 2 },
    ]),
    "b",
  );
  assert.equal(teamColor(9), 1);
  assert.equal(teamColor(4), 4);
});

test("jornada: retoma depois da última respondida, conta o que falta e limita os passos", () => {
  const items = [
    { id: "c1", type: "content" as const },
    { id: "q1", type: "multiple_choice" as const },
    { id: "c2", type: "content" as const },
    { id: "q2", type: "rating" as const },
    { id: "q3", type: "quiz_text" as const },
  ];
  assert.equal(resumeIndex(items, new Set()), 0);
  assert.equal(resumeIndex(items, new Set(["q1"])), 2);
  assert.equal(resumeIndex(items, new Set(["q3"])), 5);
  assert.equal(firstUnanswered(items, new Set(["q1", "q3"])), 3);
  assert.equal(firstUnanswered(items, new Set(["q1", "q2", "q3"])), -1);
  assert.equal(unansweredCount(items, new Set(["q2"])), 2);
  assert.equal(stepTo(-1, 5), 0);
  assert.equal(stepTo(9, 5), 5);
  assert.equal(journeyResponseSchema.safeParse({ status: "live", items: [], answered: [] }).success, true);
});
