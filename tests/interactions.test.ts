import { test } from "node:test";
import assert from "node:assert/strict";
import type { InteractionOptionRow, InteractionRow } from "../src/lib/supabase/types.ts";
import {
  answerPayloadSchema,
  interactionInputSchema,
  normalizeSettings,
  toPublicInteraction,
} from "../src/lib/domain/interactions.ts";

const ID = "11111111-2222-4333-8444-555555555555";
const OPT_A = "aaaaaaaa-bbbb-4ccc-8ddd-000000000001";
const OPT_B = "aaaaaaaa-bbbb-4ccc-8ddd-000000000002";

function interaction(overrides: Partial<InteractionRow> = {}): InteractionRow {
  return {
    activated_at: null,
    after_slide: null,
    closed_at: null,
    created_at: "2026-10-16T12:00:00.000Z",
    description: null,
    id: ID,
    is_active: false,
    position: 0,
    session_id: "99999999-2222-4333-8444-555555555555",
    settings: {},
    title: "Qual a capital?",
    type: "quiz",
    updated_at: "2026-10-16T12:00:00.000Z",
    ...overrides,
  };
}

function option(id: string, position: number, overrides: Partial<InteractionOptionRow> = {}): InteractionOptionRow {
  return {
    created_at: "2026-10-16T12:00:00.000Z",
    id,
    image_path: null,
    interaction_id: ID,
    is_correct: false,
    label: `Opção ${position}`,
    points: 100,
    position,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Visão pública
// ---------------------------------------------------------------------------

test("visão pública nunca leva acerto nem pontos", () => {
  const view = toPublicInteraction(interaction(), [
    option(OPT_A, 0, { is_correct: true, points: 500 }),
    option(OPT_B, 1),
  ]);
  assert.ok(view);
  for (const o of view.options) {
    assert.deepEqual(Object.keys(o).sort(), ["id", "imagePath", "label"]);
  }
  const json = JSON.stringify(view);
  assert.doesNotMatch(json, /is_correct|isCorrect|"points"/);
});

test("visão pública: só as alternativas da interação, na ordem de position", () => {
  const view = toPublicInteraction(interaction(), [
    option(OPT_B, 1),
    option("outra", 0, { interaction_id: "outra-interacao" }),
    option(OPT_A, 0),
  ]);
  assert.deepEqual(view?.options.map((o) => o.id), [OPT_A, OPT_B]);
});

test("visão pública: tipo desconhecido vira null", () => {
  assert.equal(toPublicInteraction(interaction({ type: "desconhecido" }), []), null);
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

test("normalizeSettings preenche os padrões de cada tipo", () => {
  assert.equal(normalizeSettings("word_cloud", null).maxLength, 30);
  assert.equal(normalizeSettings("open_text", {}).maxLength, 280);
  assert.equal(normalizeSettings("open_text", {}).showOnDisplay, true);
  const quiz = normalizeSettings("quiz", { timerSeconds: 20, speedBonus: true });
  assert.equal(quiz.timerSeconds, 20);
  assert.equal(quiz.speedBonus, true);
  assert.equal(quiz.optionStyle, "text");
  const rating = normalizeSettings("rating", { min: 0, max: 10, minLabel: "", maxLabel: "Ótimo" });
  assert.deepEqual([rating.min, rating.max, rating.minLabel, rating.maxLabel], [0, 10, null, "Ótimo"]);
});

test("normalizeSettings ignora settings inválidos", () => {
  const rating = normalizeSettings("rating", { min: 1, max: 1 });
  assert.deepEqual([rating.min, rating.max], [1, 5]);
  assert.equal(normalizeSettings("quiz", { timerSeconds: 1 }).timerSeconds, null);
  assert.equal(normalizeSettings("word_cloud", { maxLength: 999 }).maxLength, 30);
  assert.equal(normalizeSettings("multiple_choice", { optionStyle: "neon" }).optionStyle, "text");
});

// ---------------------------------------------------------------------------
// Entrada do builder
// ---------------------------------------------------------------------------

test("interactionInputSchema aceita enquete e quiz válidos", () => {
  const poll = interactionInputSchema.safeParse({
    type: "multiple_choice",
    title: "  Qual linguagem?  ",
    settings: {},
    options: [{ label: "TS" }, { label: "Go" }],
  });
  assert.ok(poll.success);
  assert.equal(poll.data.title, "Qual linguagem?");

  const quiz = interactionInputSchema.safeParse({
    type: "quiz",
    title: "2 + 2",
    settings: { timerSeconds: 15 },
    options: [{ label: "4", isCorrect: true }, { label: "5" }],
  });
  assert.ok(quiz.success);
});

test("interactionInputSchema recusa título vazio, poucas alternativas e quiz sem uma correta", () => {
  const issue = (input: unknown) => {
    const parsed = interactionInputSchema.safeParse(input);
    assert.ok(!parsed.success);
    return parsed.error.issues[0]?.message;
  };
  assert.equal(issue({ type: "rating", title: "  ", settings: {} }), "validation.questionRequired");
  assert.equal(
    issue({ type: "multiple_choice", title: "x", settings: {}, options: [{ label: "só uma" }] }),
    "validation.atLeastTwoOptions",
  );
  assert.equal(
    issue({ type: "quiz", title: "x", settings: {}, options: [{ label: "a", isCorrect: true }, { label: "b", isCorrect: true }] }),
    "validation.exactlyOneCorrect",
  );
  // Escala fora dos limites (máximo de 2 a 10).
  assert.ok(issue({ type: "rating", title: "x", settings: { min: 1, max: 11 } }));
  assert.equal(interactionInputSchema.safeParse({ type: "outro", title: "x", settings: {} }).success, false);
});

// ---------------------------------------------------------------------------
// Resposta do participante
// ---------------------------------------------------------------------------

test("answerPayloadSchema aceita respostas válidas de cada tipo", () => {
  const valid: unknown[] = [
    { type: "multiple_choice", optionId: OPT_A },
    { type: "quiz", optionId: OPT_B },
    { type: "rating", value: 4 },
    { type: "word_cloud", text: " inovação " },
    { type: "open_text", text: "Gostei muito" },
    { type: "ranking", order: [OPT_A, OPT_B] },
  ];
  for (const payload of valid) assert.ok(answerPayloadSchema.safeParse(payload).success, JSON.stringify(payload));
  const word = answerPayloadSchema.parse({ type: "word_cloud", text: " inovação " });
  assert.ok(word.type === "word_cloud" && word.text === "inovação");
});

test("answerPayloadSchema recusa respostas inválidas", () => {
  const invalid: unknown[] = [
    { type: "multiple_choice", optionId: "não-é-uuid" },
    { type: "quiz" },
    { type: "rating", value: 3.5 },
    { type: "word_cloud", text: "   " },
    { type: "word_cloud", text: "x".repeat(51) },
    { type: "open_text", text: "x".repeat(501) },
    { type: "ranking", order: [OPT_A] },
    { type: "desconhecido" },
    null,
  ];
  for (const payload of invalid) assert.ok(!answerPayloadSchema.safeParse(payload).success, JSON.stringify(payload));
});

test("answerPayloadSchema não aceita acerto ou pontos vindos do cliente", () => {
  const parsed = answerPayloadSchema.parse({ type: "quiz", optionId: OPT_A, isCorrect: true, points: 9999 });
  assert.deepEqual(parsed, { type: "quiz", optionId: OPT_A });
});
