import { test } from "node:test";
import assert from "node:assert/strict";
import {
  answerPayloadSchema,
  buildInteractionInput,
  defaultSettings,
  interactionInputSchema,
  isScoredType,
  normalizeSettings,
} from "../src/lib/domain/interactions.ts";
import { guessBucket, matrixAnswer, multiChoiceAnswer, pinAnswer, pinCell, pointsAnswer } from "../src/lib/domain/answers.ts";
import { guessCloseness, guessOutcome, isAcceptedAnswer, normalizeAnswerText, quizTextOutcome } from "../src/lib/domain/scoring.ts";
import { guessStats, matrixPoints, pinHeat, pointsBars, snapshotFromResponses } from "../src/lib/domain/results.ts";
import { contentBlocks, toEmbedUrl } from "../src/lib/domain/content.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

test("múltipla escolha com limite: sem repetir, só alternativas válidas, até o limite", () => {
  const ok = multiChoiceAnswer([A, B, A], [A, B, C], 2);
  assert.ok(ok.ok && JSON.stringify(ok.value.tally) === JSON.stringify({ [A]: 1, [B]: 1 }));
  assert.equal(multiChoiceAnswer([A, B, C], [A, B, C], 2).ok, false);
  assert.equal(multiChoiceAnswer(["x"], [A], 2).ok, false);
  assert.equal(answerPayloadSchema.safeParse({ type: "multiple_choice", optionId: A, optionIds: [A] }).success, false);
  assert.equal(answerPayloadSchema.safeParse({ type: "multiple_choice", optionIds: [A, B] }).success, true);
});

test("100 pontos: soma exata, zeros fora", () => {
  const ok = pointsAnswer({ [A]: 70, [B]: 30, [C]: 0 }, [A, B, C]);
  assert.ok(ok.ok && Object.keys(ok.value.tally as object).length === 2);
  assert.equal(pointsAnswer({ [A]: 60 }, [A]).ok, false);
});

test("matriz e marcar na imagem montam as contagens", () => {
  const m = matrixAnswer({ [A]: { x: 80, y: 20 } }, [A, B]);
  assert.ok(m.ok);
  assert.deepEqual(m.ok && m.value.tally, { [`${A}:x`]: 80, [`${A}:y`]: 20, [`${A}:n`]: 1 });
  assert.equal(matrixAnswer({}, [A]).ok, false);
  assert.deepEqual(pinCell(1, 0), { gx: 19, gy: 0 });
  const p = pinAnswer(0.51, 0.26);
  assert.ok(p.ok && "c:10:5" in (p.value.tally as object));
});

test("adivinhe o número: proximidade, pontos e faixa", () => {
  assert.equal(guessCloseness(50, 50, { min: 0, max: 100 }), 1);
  assert.equal(Math.round(guessCloseness(60, 50, { min: 0, max: 100 }) * 100), 60);
  assert.equal(guessCloseness(90, 50, { min: 0, max: 100 }), 0);
  const settings = { numMin: 0, numMax: 100, decimals: 0, maxPoints: 1000, timerSeconds: null };
  const hit = guessOutcome({ value: 51, correct: 50, settings, activatedAt: null, now: 0 });
  assert.ok(hit.ok && hit.isCorrect && hit.points === 960);
  assert.equal(guessOutcome({ value: 101, correct: 50, settings, activatedAt: null, now: 0 }).ok, false);
  assert.equal(guessBucket(100, settings), 19);
});

test("quiz de digitar: ignora acento, caixa e uma letra trocada em palavras longas", () => {
  assert.equal(normalizeAnswerText("  Júpiter!! "), "jupiter");
  assert.equal(isAcceptedAnswer("jupiter", ["Júpiter"]), true);
  assert.equal(isAcceptedAnswer("Jupter", ["Júpiter"]), true);
  assert.equal(isAcceptedAnswer("Marte", ["Júpiter"]), false);
  assert.equal(isAcceptedAnswer("sol", ["sal"]), false);
  const out = quizTextOutcome({ text: "JUPITER", accepted: ["Júpiter"], settings: { maxPoints: 100, speedBonus: false, timerSeconds: null }, activatedAt: null, now: 0 });
  assert.ok(out.ok && out.isCorrect && out.points === 100);
});

test("resultados dos tipos novos a partir das respostas (tally)", () => {
  const options = [{ id: A, label: "A", imagePath: null }, { id: B, label: "B", imagePath: null }];
  const rows = (values: unknown[]) => values.map((value, i) => ({ id: String(i), aggregate_key: null, value, created_at: "2026-10-26" }));
  const points = snapshotFromResponses(rows([{ tally: { [A]: 70, [B]: 30 } }, { tally: { [A]: 50, [B]: 50 } }]));
  assert.deepEqual(pointsBars(options, points).map((b) => b.average), [60, 40]);
  const matrix = snapshotFromResponses(rows([{ tally: { [`${A}:x`]: 80, [`${A}:y`]: 20, [`${A}:n`]: 1 } }, { tally: { [`${A}:x`]: 40, [`${A}:y`]: 60, [`${A}:n`]: 1 } }]));
  assert.deepEqual(matrixPoints(options, matrix).map((p) => [p.x, p.y]), [[60, 40]]);
  const pins = snapshotFromResponses(rows([{ tally: { "c:1:2": 1 } }, { tally: { "c:1:2": 1 } }, { tally: { "c:3:3": 1 } }]));
  assert.equal(pinHeat(pins).max, 2);
  const guesses = snapshotFromResponses(rows([{ tally: { "b:5": 1, _sum: 27 } }, { tally: { "b:6": 1, _sum: 33 } }]));
  const stats = guessStats({ numMin: 0, numMax: 100 }, guesses);
  assert.equal(stats.mean, 30);
  assert.equal(stats.total, 2);
});

test("settings e entrada dos tipos novos", () => {
  assert.equal(isScoredType("guess_number"), true);
  assert.equal(isScoredType("points_100"), false);
  const guess = buildInteractionInput({ type: "guess_number", title: "Quantos?", settings: defaultSettings("guess_number"), options: [], answerKey: { value: 42 } });
  assert.equal(interactionInputSchema.safeParse(guess).success, true);
  const out = buildInteractionInput({ type: "guess_number", title: "Quantos?", settings: defaultSettings("guess_number"), options: [], answerKey: { value: 420 } });
  assert.equal(interactionInputSchema.safeParse(out).success, false);
  const content = interactionInputSchema.safeParse({ type: "content", title: "Agenda", settings: { body: "- Um\n- Dois", videoUrl: "https://youtu.be/dQw4w9WgXcQ" } });
  assert.equal(content.success, true);
  assert.equal(interactionInputSchema.safeParse({ type: "content", title: "x", settings: { videoUrl: "https://evil.example/v" } }).success, false);
  assert.equal(normalizeSettings("multiple_choice", { maxChoices: 3 }).maxChoices, 3);
});

test("slide de conteúdo: vídeo só do YouTube/Vimeo e texto em blocos", () => {
  assert.equal(toEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(toEmbedUrl("https://vimeo.com/76979871"), "https://player.vimeo.com/video/76979871?dnt=1");
  assert.equal(toEmbedUrl("https://example.com/watch?v=1"), null);
  assert.deepEqual(contentBlocks("Olá\nmundo\n\n- um\n- dois"), [
    { kind: "paragraph", text: "Olá mundo" },
    { kind: "list", items: ["um", "dois"] },
  ]);
});
