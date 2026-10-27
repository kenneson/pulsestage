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
  assert.deepEqual(rating.settings, { timerSeconds: null, hideResults: false, showResultsOnPhone: false, min: 1, max: 5, minLabel: "Nada", maxLabel: "Muito" });
});

test("falha quando nada é aproveitável", () => {
  assert.throws(() => parseQuestionSuggestions("sem json", []), /não retornou JSON/);
  assert.throws(() => parseQuestionSuggestions('{"questions":[{"type":"quiz","title":"x","options":["a"]}]}', []), /válidas/);
});

test("tipos novos: 100 pontos, matriz, adivinhe o número e quiz de digitar passam pelo schema do builder", () => {
  const raw = JSON.stringify({
    questions: [
      { type: "points_100", title: "Onde investir o próximo trimestre?", options: ["Produto", "Marketing", "Suporte"] },
      {
        type: "matrix_2x2",
        title: "Posicione as iniciativas",
        options: ["Chatbot", "Treinamento"],
        x_label: "Esforço",
        x_low: "Baixo",
        x_high: "Alto",
        y_label: "Impacto",
      },
      { type: "guess_number", title: "Em que ano foi lançada a web?", number_min: 1980, number_max: 2000, correct_number: 1991 },
      { type: "guess_number", title: "Fora da faixa", number_min: 0, number_max: 10, correct_number: 50 },
      { type: "guess_number", title: "Sem número certo", number_min: 0, number_max: 10 },
      { type: "quiz_text", title: "Qual linguagem roda no navegador?", accepted_answers: ["JavaScript", "JS"] },
      { type: "quiz_text", title: "Sem respostas aceitas" },
      { type: "pin_image", title: "Marque no mapa" },
      { type: "content", title: "Slide" },
      { type: "guess_number", title: "Percentual com casas", number_min: 0, number_max: 1, correct_number: 0.25, unit: "%" },
    ],
  });
  const result = parseQuestionSuggestions(raw, []);
  assert.deepEqual(
    result.map((r) => r.type),
    ["points_100", "matrix_2x2", "guess_number", "quiz_text", "guess_number"],
  );
  const matrix = result[1];
  assert.ok(matrix?.type === "matrix_2x2");
  assert.equal(matrix.settings.xLabel, "Esforço");
  assert.equal(matrix.settings.yLabel, "Impacto");
  const guess = result[2];
  assert.ok(guess?.type === "guess_number");
  assert.deepEqual(guess.answerKey, { value: 1991 });
  assert.equal(guess.settings.numMin, 1980);
  assert.equal(guess.settings.decimals, 0);
  const text = result[3];
  assert.ok(text?.type === "quiz_text");
  assert.deepEqual(text.answerKey, { accepted: ["JavaScript", "JS"] });
  assert.equal(text.settings.timerSeconds, 30);
  const decimal = result[4];
  assert.ok(decimal?.type === "guess_number" && decimal.settings.decimals === 2 && decimal.settings.unit === "%");
});
