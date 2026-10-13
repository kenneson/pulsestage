import { test } from "node:test";
import assert from "node:assert/strict";
import {
  convertBatch,
  mergeArrangement,
  positionLabel,
  relocate,
  toInteractionInput,
  toInteractionView,
} from "../src/lib/domain/mcp.ts";

test("quiz: alternativa correta pelo número, pontos e bônus só com tempo", () => {
  const r = toInteractionInput({
    type: "quiz",
    question: "Qual é a capital?",
    options: ["Rio", "Brasília", "São Paulo"],
    correct_option: 2,
    points: 200,
    speed_bonus: true,
    after_slide: 4,
  });
  assert.equal(r.ok, true);
  if (!r.ok || r.input.type !== "quiz") return;
  assert.deepEqual(
    r.input.options.map((o) => [o.label, o.isCorrect, o.points]),
    [
      ["Rio", false, 200],
      ["Brasília", true, 200],
      ["São Paulo", false, 200],
    ],
  );
  assert.equal(r.input.settings.speedBonus, false);
  assert.equal(r.afterSlide, 4);

  const timed = toInteractionInput({ type: "quiz", question: "Q", options: ["a", "b"], correct_option: 1, timer_seconds: 20, speed_bonus: true });
  assert.ok(timed.ok && timed.input.type === "quiz" && timed.input.settings.speedBonus && timed.input.settings.timerSeconds === 20);
});

test("quiz sem resposta certa ou com número inexistente falha com mensagem clara", () => {
  const missing = toInteractionInput({ type: "quiz", question: "Q", options: ["a", "b"] });
  assert.equal(missing.ok, false);
  assert.match(missing.ok ? "" : missing.error, /correct_option/);
  const out = toInteractionInput({ type: "quiz", question: "Q", options: ["a", "b"], correct_option: 3 });
  assert.match(out.ok ? "" : out.error, /não existe/);
});

test("enquete, escala, nuvem e aberta usam os padrões do painel", () => {
  const poll = toInteractionInput({ type: "multiple_choice", question: "P", options: ["x", "y"], shapes: true });
  assert.ok(poll.ok && poll.input.type === "multiple_choice" && poll.input.settings.optionStyle === "shapes");
  assert.equal(poll.ok && poll.afterSlide, null);

  const scale = toInteractionInput({ type: "rating", question: "Nota", scale_max: 10, scale_min: 0, max_label: "Muito" });
  assert.ok(scale.ok && scale.input.type === "rating" && scale.input.settings.max === 10 && scale.input.settings.min === 0);

  const cloud = toInteractionInput({ type: "word_cloud", question: "Uma palavra" });
  assert.ok(cloud.ok && cloud.input.type === "word_cloud" && cloud.input.settings.maxLength === 30);

  const open = toInteractionInput({ type: "open_text", question: "Dúvidas?", show_on_display: false });
  assert.ok(open.ok && open.input.type === "open_text" && open.input.settings.showOnDisplay === false);

  const noOptions = toInteractionInput({ type: "multiple_choice", question: "P" });
  assert.equal(noOptions.ok, false);
  const badCloud = toInteractionInput({ type: "word_cloud", question: "P", max_length: 200 });
  assert.equal(badCloud.ok, false);
});

test("convertBatch valida tudo antes e aponta qual pergunta falhou", () => {
  const result = convertBatch([
    { type: "word_cloud", question: "Uma palavra" },
    { type: "quiz", question: "Sem resposta", options: ["a", "b"] },
  ]);
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.error, /^Interação 2/);
  assert.equal(convertBatch([{ type: "word_cloud", question: "Ok" }]).ok, true);
});

test("mergeArrangement encaixa as novas pelo slide, sem limitar ao número de slides enviados", () => {
  const existing = [
    { id: "a", afterSlide: 2 },
    { id: "b", afterSlide: null },
  ];
  const added = [
    { id: "n1", afterSlide: 40 },
    { id: "n2", afterSlide: 0 },
    { id: "n3", afterSlide: 2 },
  ];
  assert.deepEqual(mergeArrangement(existing, added), {
    ids: ["n2", "a", "n3", "n1", "b"],
    afterSlides: [0, 2, 2, 40, null],
  });
});

test("relocate leva a pergunta para o fim do ponto escolhido", () => {
  const items = [
    { id: "a", afterSlide: 1 },
    { id: "b", afterSlide: 3 },
    { id: "c", afterSlide: 3 },
  ];
  assert.deepEqual(relocate(items, "a", 3), { ids: ["b", "c", "a"], afterSlides: [3, 3, 3] });
  assert.deepEqual(relocate(items, "c", null), { ids: ["a", "b", "c"], afterSlides: [1, 3, null] });
  assert.equal(relocate(items, "x", 1), null);
});

test("positionLabel e toInteractionView", () => {
  assert.equal(positionLabel(null, 0), "No fim");
  assert.equal(positionLabel(0, 10), "Antes do 1º slide");
  assert.equal(positionLabel(7, 0), "Depois do slide 7");
  assert.equal(positionLabel(12, 10), "No fim (depois do último slide)");
  const view = toInteractionView(
    {
      id: "i",
      type: "quiz",
      title: "Q",
      description: null,
      after_slide: 3,
      settings: { timerSeconds: 20 },
      options: [
        { label: "B", is_correct: true, points: 100, position: 1 },
        { label: "A", is_correct: false, points: 0, position: 0 },
      ],
    },
    10,
  );
  assert.deepEqual(view.options, [
    { label: "A", correct: false, points: 0 },
    { label: "B", correct: true, points: 100 },
  ]);
  assert.equal(view.type_label, "Quiz");
});
