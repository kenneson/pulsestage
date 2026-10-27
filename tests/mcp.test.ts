import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultSettings as defaults } from "../src/lib/domain/interactions.ts";
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
    timer_seconds: null,
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
  assert.equal(r.input.settings.timerSeconds, null);
  assert.equal(r.afterSlide, 4);

  const timed = toInteractionInput({ type: "quiz", question: "Q", options: ["a", "b"], correct_option: 1, timer_seconds: 20, speed_bonus: true });
  assert.ok(timed.ok && timed.input.type === "quiz" && timed.input.settings.speedBonus && timed.input.settings.timerSeconds === 20);
});

test("quiz sem ajustes usa os padrões do painel (tempo, formas e bônus)", () => {
  const r = toInteractionInput({ type: "quiz", question: "Q", options: ["a", "b"], correct_option: 1 });
  assert.ok(r.ok && r.input.type === "quiz");
  assert.deepEqual(r.input.settings, { timerSeconds: 30, hideResults: false, showResultsOnPhone: false, optionStyle: "shapes", speedBonus: true });
  assert.deepEqual(
    r.input.options.map((o) => o.points),
    [100, 100],
  );

  const plain = toInteractionInput({ type: "quiz", question: "Q", options: ["a", "b"], correct_option: 1, shapes: false, speed_bonus: false });
  assert.ok(plain.ok && plain.input.type === "quiz");
  assert.deepEqual(plain.input.settings, { timerSeconds: 30, hideResults: false, showResultsOnPhone: false, optionStyle: "text", speedBonus: false });
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

test("ranking pelo MCP vira alternativas sem resposta certa", () => {
  const r = toInteractionInput({ type: "ranking", question: "Ordene as prioridades", options: ["A", "B", "C"], after_slide: 3 });
  assert.ok(r.ok && r.input.type === "ranking" && r.input.options.length === 3 && r.afterSlide === 3);
  assert.equal(toInteractionInput({ type: "ranking", question: "Só uma", options: ["A"] }).ok, false);
});

test("na edição, o que o assistente omite continua como está", async () => {
  const { normalizeSettings } = await import("../src/lib/domain/interactions.ts");
  const current = normalizeSettings("quiz", { timerSeconds: null, optionStyle: "text" });
  const r = toInteractionInput({ type: "quiz", question: "Nova", options: ["a", "b"], correct_option: 2 }, undefined, { settings: current });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.input.settings.timerSeconds ?? null, null);
  assert.equal(r.input.settings.optionStyle ?? "text", "text");
});

test("tipos novos: 100 pontos, matriz com eixos e enquete de perfil com várias escolhas", () => {
  const points = toInteractionInput({ type: "points_100", question: "Onde investir?", options: ["A", "B", "C"], hide_results: true });
  assert.ok(points.ok && points.input.type === "points_100");
  assert.equal(points.input.settings.hideResults, true);
  assert.equal(toInteractionInput({ type: "points_100", question: "Só uma", options: ["A"] }).ok, false);

  const matrix = toInteractionInput({
    type: "matrix_2x2",
    question: "Priorize",
    options: ["Item"],
    x_label: "Esforço",
    x_low: "Baixo",
    x_high: "Alto",
    y_label: "Impacto",
  });
  assert.ok(matrix.ok && matrix.input.type === "matrix_2x2");
  assert.equal(matrix.input.options.length, 1);
  assert.deepEqual(
    [matrix.input.settings.xLabel, matrix.input.settings.xLow, matrix.input.settings.xHigh, matrix.input.settings.yLabel],
    ["Esforço", "Baixo", "Alto", "Impacto"],
  );

  const poll = toInteractionInput({
    type: "multiple_choice",
    question: "Sua área?",
    options: ["TI", "RH", "Vendas"],
    max_choices: 2,
    is_segment: true,
    show_results_on_phone: true,
    timer_seconds: 20,
    notes: "Comentar a divisão",
  });
  assert.ok(poll.ok && poll.input.type === "multiple_choice");
  assert.deepEqual(
    [poll.input.settings.maxChoices, poll.input.settings.isSegment, poll.input.settings.showResultsOnPhone, poll.input.settings.timerSeconds],
    [2, true, true, 20],
  );
  assert.equal(poll.input.notes, "Comentar a divisão");
  assert.equal(toInteractionInput({ type: "multiple_choice", question: "P", options: ["a", "b"], max_choices: 3 }).ok, false);
});

test("adivinhe o número: faixa, unidade e número certo obrigatório e dentro da faixa", () => {
  const ok = toInteractionInput({
    type: "guess_number",
    question: "Quantos % usam IA?",
    number_min: 0,
    number_max: 100,
    unit: "%",
    correct_number: 42,
    max_points: 500,
    show_results_on_phone: true,
  });
  assert.ok(ok.ok && ok.input.type === "guess_number");
  assert.deepEqual(ok.input.answerKey, { value: 42 });
  assert.equal(ok.input.settings.unit, "%");
  assert.equal(ok.input.settings.maxPoints, 500);
  // Tipo que pontua não mostra gráfico no celular.
  assert.equal(ok.input.settings.showResultsOnPhone, false);

  const missing = toInteractionInput({ type: "guess_number", question: "Q" });
  assert.match(missing.ok ? "" : missing.error, /correct_number/);
  assert.equal(toInteractionInput({ type: "guess_number", question: "Q", correct_number: 200 }).ok, false);
  assert.equal(toInteractionInput({ type: "guess_number", question: "Q", number_min: 5, number_max: 1, correct_number: 3 }).ok, false);
});

test("quiz de digitar: respostas aceitas, padrões de jogo e edição mantém o gabarito", () => {
  const r = toInteractionInput({ type: "quiz_text", question: "Capital do Brasil?", accepted_answers: ["Brasília", "DF"] });
  assert.ok(r.ok && r.input.type === "quiz_text");
  assert.deepEqual(r.input.answerKey, { accepted: ["Brasília", "DF"] });
  assert.equal(r.input.settings.timerSeconds, 30);
  assert.equal(r.input.settings.speedBonus, true);
  assert.equal(r.input.settings.maxLength, 60);

  const missing = toInteractionInput({ type: "quiz_text", question: "Q" });
  assert.match(missing.ok ? "" : missing.error, /accepted_answers/);

  // Na edição, sem accepted_answers nem notes, continuam os atuais; notes vazio remove.
  const current = { settings: { ...defaults("quiz_text"), maxPoints: 300 }, answerKey: { accepted: ["Brasília"] }, notes: "Lembrar do DF" };
  const edited = toInteractionInput({ type: "quiz_text", question: "Capital?" }, undefined, current);
  assert.ok(edited.ok && edited.input.type === "quiz_text");
  assert.deepEqual(edited.input.answerKey, { accepted: ["Brasília"] });
  assert.equal(edited.input.settings.maxPoints, 300);
  assert.equal(edited.input.notes, "Lembrar do DF");
  const cleared = toInteractionInput({ type: "quiz_text", question: "Capital?", notes: "" }, undefined, {
    ...current,
    settings: defaults("quiz_text"),
  });
  assert.ok(cleared.ok && cleared.input.notes === undefined);
});

test("slide de conteúdo com texto e vídeo; pin_image só com imagem já enviada", () => {
  const content = toInteractionInput({
    type: "content",
    question: "Intervalo",
    body: "Voltamos em 10 minutos.\n\n- Café\n- Água",
    video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  });
  assert.ok(content.ok && content.input.type === "content");
  assert.equal(content.input.settings.body, "Voltamos em 10 minutos.\n\n- Café\n- Água");
  assert.equal(toInteractionInput({ type: "content", question: "X", video_url: "https://exemplo.com/video" }).ok, false);

  const pin = toInteractionInput({ type: "pin_image", question: "Onde fica?" });
  assert.match(pin.ok ? "" : pin.error, /painel/);
  const speaker = "11111111-1111-4111-8111-111111111111";
  const withImage = toInteractionInput({ type: "pin_image", question: "Onde fica?", hide_results: true }, undefined, {
    settings: { ...defaults("pin_image"), imagePath: `${speaker}/22222222-2222-4222-8222-222222222222.webp` },
  });
  assert.ok(withImage.ok && withImage.input.type === "pin_image");
  assert.equal(withImage.input.settings.hideResults, true);
});

test("toInteractionView mostra gabarito e notas ao dono", () => {
  const guess = toInteractionView(
    { id: "g", type: "guess_number", title: "Q", description: null, after_slide: null, settings: {}, answer_key: { value: 7 }, speaker_notes: "nota", options: [] },
    0,
  );
  assert.equal(guess.correct_number, 7);
  assert.equal(guess.notes, "nota");
  const text = toInteractionView(
    { id: "t", type: "quiz_text", title: "Q", description: null, after_slide: null, settings: {}, answer_key: { accepted: ["a"] }, options: [] },
    0,
  );
  assert.deepEqual(text.accepted_answers, ["a"]);
  assert.equal(text.notes, undefined);
});
