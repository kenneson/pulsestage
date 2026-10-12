import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatTicket,
  landingSchedule,
  prizeInputSchema,
  prizeProgress,
  RAFFLE_REVEAL_MS,
  RAFFLE_SUSPENSE_MS,
  reelSequence,
  winnerRevealed,
  winnerVisibleToDisplay,
} from "../src/lib/domain/raffle.ts";

test("prizeInputSchema: limpa textos vazios e valida a quantidade", () => {
  const parsed = prizeInputSchema.parse({ name: "  Livro  ", description: " ", kind: "physical", quantity: 2 });
  assert.deepEqual(parsed, { name: "Livro", description: null, kind: "physical", quantity: 2, winnerMessage: null });
  assert.equal(prizeInputSchema.safeParse({ name: "", kind: "digital", quantity: 1 }).success, false);
  assert.equal(prizeInputSchema.safeParse({ name: "Curso", kind: "digital", quantity: 0 }).success, false);
  assert.equal(prizeInputSchema.safeParse({ name: "Curso", kind: "digital", quantity: 1.5 }).success, false);
  assert.equal(prizeInputSchema.safeParse({ name: "Curso", kind: "outro", quantity: 1 }).success, false);
});

test("o ganhador aparece no telão depois do suspense e nos celulares depois da revelação", () => {
  const drawnAt = "2026-10-13T20:00:00.000Z";
  const t0 = Date.parse(drawnAt);
  assert.equal(winnerVisibleToDisplay(drawnAt, t0 + RAFFLE_SUSPENSE_MS - 1), false);
  assert.equal(winnerVisibleToDisplay(drawnAt, t0 + RAFFLE_SUSPENSE_MS), true);
  assert.equal(winnerRevealed(drawnAt, t0 + RAFFLE_SUSPENSE_MS), false);
  assert.equal(winnerRevealed(drawnAt, t0 + RAFFLE_REVEAL_MS), true);
});

test("formatTicket: três dígitos, quatro acima de 999", () => {
  assert.equal(formatTicket(7), "007");
  assert.equal(formatTicket(42), "042");
  assert.equal(formatTicket(42, 9999), "0042");
  assert.equal(formatTicket(1234), "1234");
});

test("prizeProgress nunca fica negativo", () => {
  assert.deepEqual(prizeProgress(3, 1), { drawn: 1, remaining: 2 });
  assert.deepEqual(prizeProgress(1, 2), { drawn: 2, remaining: 0 });
});

test("reelSequence termina no ganhador e não repete o mesmo número em seguida", () => {
  const seq = reelSequence([5, 12, 40, 77, 12], 40, 14, 7);
  assert.equal(seq.length, 14);
  assert.equal(seq.at(-1), 40);
  for (let i = 1; i < seq.length - 1; i++) assert.notEqual(seq[i], seq[i - 1]);
  assert.ok(seq.slice(0, -1).every((n) => [5, 12, 77].includes(n)));
  // Mesma semente, mesma sequência.
  assert.deepEqual(reelSequence([5, 12, 40, 77], 40, 14, 7), reelSequence([5, 12, 40, 77], 40, 14, 7));
});

test("reelSequence com uma pessoa só mostra direto o número dela", () => {
  assert.deepEqual(reelSequence([9], 9, 10), [9]);
  assert.deepEqual(reelSequence([], 9, 10), [9]);
});

test("landingSchedule: intervalos crescentes terminando na duração", () => {
  const times = landingSchedule(10, 2500);
  assert.equal(times.length, 10);
  assert.equal(times.at(-1), 2500);
  const gaps = times.map((t, i) => t - (times[i - 1] ?? 0));
  for (let i = 1; i < gaps.length; i++) assert.ok(gaps[i]! >= gaps[i - 1]!);
  assert.deepEqual(landingSchedule(0, 1000), []);
});

test("eligibleParticipants: pesquisa filtra quem respondeu; todos inclui todo mundo", async () => {
  const { eligibleParticipants } = await import("../src/lib/domain/raffle.ts");
  const respondents = new Set(["b"]);
  assert.deepEqual(eligibleParticipants("survey", ["a", "b", "c"], respondents), ["b"]);
  assert.deepEqual(eligibleParticipants("everyone", ["a", "b", "c"], respondents), ["a", "b", "c"]);
});
