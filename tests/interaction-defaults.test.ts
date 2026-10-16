import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildInteractionInput,
  defaultInteractionInput,
  defaultSettings,
  INTERACTION_TYPES,
  interactionInputSchema,
  optionsFromLabels,
} from "../src/lib/domain/interactions.ts";
import { parseQuestionSuggestions } from "../src/lib/ai/questions.ts";
import { toInteractionInput } from "../src/lib/domain/mcp.ts";

test("pergunta nova de cada tipo: só falta o texto para passar na validação", () => {
  for (const type of INTERACTION_TYPES) {
    const input = defaultInteractionInput(type);
    assert.equal(input.type, type);
    assert.equal(input.title, "");
    const filled = {
      ...input,
      title: "Pergunta",
      ...("options" in input ? { options: input.options.map((o, i) => ({ ...o, label: `Alternativa ${i + 1}` })) } : {}),
    };
    assert.equal(interactionInputSchema.safeParse(filled).success, true, type);
  }
});

test("quiz novo: formas, 30 s, bônus de velocidade e a primeira alternativa correta", () => {
  const quiz = defaultInteractionInput("quiz");
  assert.ok(quiz.type === "quiz");
  assert.deepEqual(quiz.settings, { timerSeconds: 30, optionStyle: "shapes", speedBonus: true });
  assert.deepEqual(
    quiz.options.map((o) => [o.isCorrect, o.points]),
    [
      [true, 100],
      [false, 100],
    ],
  );
});

test("enquete em texto; nuvem e aberta com os limites de tamanho", () => {
  const poll = defaultInteractionInput("multiple_choice");
  assert.ok(poll.type === "multiple_choice" && poll.settings.optionStyle === "text" && poll.options.length === 2);
  assert.ok(poll.options.every((o) => !o.isCorrect));
  const cloud = defaultInteractionInput("word_cloud");
  assert.ok(cloud.type === "word_cloud" && cloud.settings.maxLength === 30);
  const open = defaultInteractionInput("open_text");
  assert.ok(open.type === "open_text" && open.settings.maxLength === 280 && open.settings.showOnDisplay === true);
  const rating = defaultInteractionInput("rating");
  assert.ok(rating.type === "rating" && rating.settings.min === 1 && rating.settings.max === 5);
});

test("bônus de velocidade some sem tempo para responder", () => {
  const input = buildInteractionInput({
    type: "quiz",
    title: "Q",
    settings: { ...defaultSettings("quiz"), timerSeconds: null },
    options: optionsFromLabels("quiz", ["a", "b"], 1),
  });
  assert.ok(input.type === "quiz" && input.settings.speedBonus === false);
  assert.deepEqual(
    input.options.map((o) => o.isCorrect),
    [false, true],
  );
});

test("painel, IA e MCP criam o mesmo quiz", () => {
  const panel = defaultInteractionInput("quiz");
  const [ai] = parseQuestionSuggestions(
    '{"questions":[{"type":"quiz","title":"Q","options":["a","b"],"correct_option":0}]}',
    [],
  );
  const mcp = toInteractionInput({ type: "quiz", question: "Q", options: ["a", "b"], correct_option: 1 });
  assert.ok(panel.type === "quiz" && ai?.type === "quiz" && mcp.ok && mcp.input.type === "quiz");
  assert.deepEqual(ai.settings, panel.settings);
  assert.deepEqual(mcp.input.settings, panel.settings);
});
