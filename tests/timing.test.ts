import { test } from "node:test";
import assert from "node:assert/strict";
import { durationSummary, formatClock, formatDuration, talkSeconds, versusPlanned } from "../src/lib/domain/timing.ts";

const at = (minutes: number, seconds = 0) => new Date(Date.UTC(2026, 9, 10, 19, minutes, seconds)).toISOString();

test("tempo de palestra desconta pausas e para enquanto pausada", () => {
  const clock = { startedAt: at(0), endedAt: null, pausedAt: null, pausedSeconds: 120 };
  assert.equal(talkSeconds(clock, Date.parse(at(10))), 480);
  // Pausada desde 19:12: o relógio não anda.
  const paused = { ...clock, pausedAt: at(12) };
  assert.equal(talkSeconds(paused, Date.parse(at(20))), 600);
  // Encerrada: vale ended_at.
  assert.equal(talkSeconds({ ...clock, endedAt: at(53) }, Date.parse(at(59))), 53 * 60 - 120);
  assert.equal(talkSeconds({ ...clock, startedAt: null }, Date.now()), null);
});

test("formatos do relógio e da duração", () => {
  assert.equal(formatClock(245), "4:05");
  assert.equal(formatClock(2700), "45:00");
  assert.equal(formatClock(3729), "1:02:09");
  assert.equal(formatDuration(51 * 60 + 20), "51 min");
  assert.equal(formatDuration(65 * 60), "1 h 05 min");
  assert.equal(formatDuration(120 * 60), "2 h");
  assert.equal(formatDuration(12), "menos de 1 min");
});

test("comparação com o previsto e resumo para o relatório", () => {
  assert.deepEqual(versusPlanned(51 * 60, 45), { diffMinutes: 6, over: true });
  assert.deepEqual(versusPlanned(40 * 60, 45), { diffMinutes: -5, over: false });
  assert.equal(versusPlanned(100, null), null);

  const done = { startedAt: at(0), endedAt: at(53), pausedAt: null, pausedSeconds: 120 };
  assert.equal(durationSummary(done, 45), "51 min de palestra (previsto 45 min, 6 min a mais)");
  assert.equal(durationSummary(done, 51), "51 min de palestra (previsto 51 min, no tempo)");
  assert.equal(durationSummary(done, null), "51 min de palestra");
  assert.equal(durationSummary({ ...done, endedAt: null }, 45), null);
});
