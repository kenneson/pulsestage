import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSlideNotes, slideNoteAt, slideNoteInputSchema, visibleSlideNotes, withSlideNote } from "../src/lib/domain/slide-notes.ts";

test("notas por slide: lê só números de slide e textos preenchidos", () => {
  assert.deepEqual(parseSlideNotes({ "1": " Abrir com a história ", "2": "", x: "nada", "0": "zero", "03": "zero à esquerda", "4": 5 }), {
    1: "Abrir com a história",
  });
  assert.deepEqual(parseSlideNotes(null), {});
  assert.deepEqual(parseSlideNotes(["a"]), {});
});

test("notas por slide: índice do deck é base 0", () => {
  const notes = parseSlideNotes({ "1": "primeiro", "3": "terceiro" });
  assert.equal(slideNoteAt(notes, 0), "primeiro");
  assert.equal(slideNoteAt(notes, 1), null);
  assert.equal(slideNoteAt(notes, 2), "terceiro");
});

test("notas por slide: gravar, apagar com texto vazio e manter as outras", () => {
  const saved = withSlideNote({ "2": "b" }, 1, "  a  ");
  assert.deepEqual(saved, { "1": "a", "2": "b" });
  assert.deepEqual(withSlideNote(saved, 2, "   "), { "1": "a" });
});

test("notas por slide: deck menor esconde notas de slides que sumiram", () => {
  assert.deepEqual(visibleSlideNotes({ 1: "a", 5: "e" }, 3), { 1: "a" });
});

test("notas por slide: entrada validada", () => {
  assert.equal(slideNoteInputSchema.safeParse({ slide: 0, text: "x" }).success, false);
  assert.equal(slideNoteInputSchema.safeParse({ slide: 1, text: "x".repeat(2001) }).success, false);
  assert.equal(slideNoteInputSchema.safeParse({ slide: 1, text: "" }).success, true);
});
