import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findSegment,
  parseSlideNotes,
  segmentGroups,
  selfPaceProgress,
  share,
} from "../src/lib/domain/live-room.ts";

test("comparar grupos: só enquetes de perfil entram no seletor", () => {
  const groups = segmentGroups([
    { id: "i1", type: "multiple_choice", title: "Área", settings: { isSegment: true }, options: [{ id: "a", label: "TI" }] },
    { id: "i2", type: "multiple_choice", title: "Outra", settings: { isSegment: false }, options: [{ id: "b", label: "X" }] },
    { id: "i3", type: "quiz", title: "Quiz", settings: { isSegment: true }, options: [{ id: "c", label: "Y" }] },
  ]);
  assert.deepEqual(groups.map((g) => g.interactionId), ["i1"]);
  assert.equal(findSegment(groups, "a")?.option.label, "TI");
  assert.equal(findSegment(groups, "b"), null);
  assert.equal(findSegment(groups, null), null);
});

test("ritmo próprio: começou e terminou tudo", () => {
  const rows = [
    { participant_id: "p1", interaction_id: "q1" },
    { participant_id: "p1", interaction_id: "q2" },
    { participant_id: "p2", interaction_id: "q1" },
    { participant_id: "p2", interaction_id: "q1" },
    { participant_id: "p3", interaction_id: "content" },
  ];
  assert.deepEqual(selfPaceProgress(rows, ["q1", "q2"]), { started: 2, finished: 1 });
  assert.deepEqual(selfPaceProgress(rows, []), { started: 0, finished: 0 });
  assert.equal(share(3, 4), 0.75);
  assert.equal(share(5, 4), 1);
  assert.equal(share(1, 0), 0);
});

test("notas dos slides: número do slide (1) vira índice do deck (0)", () => {
  assert.deepEqual(parseSlideNotes({ "1": " Abrir com história ", "3": "", x: "nada", "0": "fora" }), { 0: "Abrir com história" });
  assert.deepEqual(parseSlideNotes(null), {});
});
