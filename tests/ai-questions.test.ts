import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQuestionSuggestions } from "../src/lib/ai/questions.ts";

test("converte sugestões válidas e descarta inválidas e repetidas", () => {
  const raw = `\`\`\`json
{ "questions": [
  { "type": "multiple_choice", "title": "Você já usa IA no trabalho?", "options": ["Sim", "Não"] },
  { "type": "quiz", "title": "Qual prática reduz erros?", "options": ["Revisar a resposta", "Confiar no primeiro resultado"], "correct_option": 0 },
  { "type": "quiz", "title": "Quiz sem resposta certa", "options": ["A", "B"], "correct_option": 5 },
  { "type": "rating", "title": "Quanto tempo a IA te economiza?", "min_label": "Nada", "max_label": "Muito" },
  { "type": "word_cloud", "title": "Qual palavra resume IA para você?" },
  { "type": "open_text", "title": "Qual palavra resume IA para você" },
  { "type": "slider", "title": "Tipo que não existe" },
  { "type": "open_text", "title": "Que tarefa você automatizaria primeiro?" }
] }
\`\`\``;

  const result = parseQuestionSuggestions(raw, ["Que tarefa você AUTOMATIZARIA primeiro"]);
  assert.deepEqual(
    result.map((r) => r.type),
    ["multiple_choice", "quiz", "rating", "word_cloud"],
  );

  const quiz = result[1];
  assert.ok(quiz?.type === "quiz");
  assert.deepEqual(
    quiz.options.map((o) => [o.label, o.isCorrect]),
    [
      ["Revisar a resposta", true],
      ["Confiar no primeiro resultado", false],
    ],
  );
  const rating = result[2];
  assert.ok(rating?.type === "rating");
  assert.deepEqual(rating.settings, { min: 1, max: 5, minLabel: "Nada", maxLabel: "Muito" });
});

test("falha quando nada é aproveitável", () => {
  assert.throws(() => parseQuestionSuggestions("sem json", []), /não retornou JSON/);
  assert.throws(() => parseQuestionSuggestions('{"questions":[{"type":"quiz","title":"x","options":["a"]}]}', []), /válidas/);
});
