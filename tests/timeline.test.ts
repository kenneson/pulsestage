import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, legacyEvents, type TimelineEvent } from "../src/lib/domain/timeline.ts";

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 11, 19, 0, 0) + minutes * 60_000).toISOString();

test("trechos: QR, slides, pergunta por cima do slide, pausa e fim", () => {
  const events: TimelineEvent[] = [
    { at: at(-5), kind: "status", status: "draft" }, // antes do início: ignorado
    { at: at(0), kind: "status", status: "live" },
    { at: at(2), kind: "slide", slide: 0 },
    { at: at(6), kind: "interaction_open", interactionId: "q1" },
    { at: at(8), kind: "interaction_close", interactionId: "q1" },
    { at: at(11), kind: "slide", slide: 1 },
    { at: at(14), kind: "status", status: "paused" },
    { at: at(17), kind: "status", status: "live" },
    { at: at(20), kind: "slide", slide: 0 },
    { at: at(21), kind: "status", status: "completed" },
  ];
  const timeline = buildTimeline(events, null);
  assert.ok(timeline);
  assert.deepEqual(
    timeline.segments.map((s) => [s.kind, s.start / 60, s.end / 60, s.slide ?? s.interactionId ?? null]),
    [
      ["join", 0, 2, null],
      ["slide", 2, 6, 0],
      ["interaction", 6, 8, "q1"],
      ["slide", 8, 11, 0], // fechou a pergunta: o slide de trás volta
      ["slide", 11, 14, 1],
      ["pause", 14, 17, null],
      ["slide", 17, 20, 1],
      ["slide", 20, 21, 0],
    ],
  );
  assert.equal(timeline.span, 21 * 60);
  assert.equal(timeline.totals.pause, 3 * 60);
  assert.equal(timeline.totals.interaction, 2 * 60);
  assert.deepEqual(timeline.slides, [
    { slide: 0, seconds: 8 * 60 },
    { slide: 1, seconds: 6 * 60 },
  ]);
});

test("sessão em andamento vai até agora; sem início não há linha do tempo", () => {
  const events: TimelineEvent[] = [
    { at: at(0), kind: "status", status: "live" },
    { at: at(1), kind: "slide", slide: 0 },
  ];
  assert.equal(buildTimeline(events, at(4))?.span, 4 * 60);
  assert.equal(buildTimeline([{ at: at(0), kind: "slide", slide: 0 }], at(4)), null);
});

test("sessões antigas: perguntas pelos horários de abertura e fechamento", () => {
  const events = legacyEvents({ startedAt: at(0), endedAt: at(30) }, [
    { id: "a", activatedAt: at(5), closedAt: at(9) },
    { id: "b", activatedAt: null, closedAt: null },
  ]);
  const timeline = buildTimeline(events, null);
  assert.deepEqual(
    timeline?.segments.map((s) => [s.kind, s.start / 60, s.end / 60]),
    [
      ["join", 0, 5],
      ["interaction", 5, 9],
      ["join", 9, 30],
    ],
  );
});
