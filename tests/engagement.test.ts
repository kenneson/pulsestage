import { test } from "node:test";
import assert from "node:assert/strict";
import { bordaPoints, isValidRanking, rankingResults } from "../src/lib/domain/ranking.ts";
import { containsProfanity } from "../src/lib/domain/profanity.ts";
import { askQuestionSchema, questionsOnScreen, sortQuestions, topQuestions } from "../src/lib/domain/questions.ts";
import { allowReaction, reactionPeaks, reactionsPerMinute, tallyReactions } from "../src/lib/domain/reactions.ts";

test("bordaPoints dá n pontos à primeira e 1 à última", () => {
  assert.deepEqual(bordaPoints(["a", "b", "c"]), { a: 3, b: 2, c: 1 });
});

test("isValidRanking exige cada alternativa uma vez", () => {
  assert.equal(isValidRanking(["a", "b"], ["b", "a"]), true);
  assert.equal(isValidRanking(["a", "a"], ["a", "b"]), false);
  assert.equal(isValidRanking(["a"], ["a", "b"]), false);
  assert.equal(isValidRanking(["a", "x"], ["a", "b"]), false);
});

test("rankingResults ordena por pontos e calcula a posição média", () => {
  const options = [
    { id: "x", label: "X" },
    { id: "y", label: "Y" },
    { id: "z", label: "Z" },
  ];
  // duas respostas: x,y,z e y,x,z → x=5, y=5, z=2
  const rows = rankingResults(options, { total: 2, counts: { x: 5, y: 5, z: 2 } });
  assert.deepEqual(rows.map((r) => r.key), ["x", "y", "z"]);
  assert.equal(rows[0]!.averagePosition, 1.5);
  assert.equal(rows[2]!.averagePosition, 3);
  assert.equal(rows[2]!.share, 0.4);
  assert.equal(rankingResults(options, { total: 0, counts: {} })[0]!.averagePosition, null);
});

test("containsProfanity pega variações e não barra palavras comuns", () => {
  for (const bad of ["Porra", "p0rra", "PQP", "que merdinha", "p o r r a", "c.u", "caralhooo", "FODA-SE", "fuck this"]) {
    assert.equal(containsProfanity(bad), true, bad);
  }
  for (const ok of ["cuidado", "computador", "disputa", "porque", "curso", "desgraça", "a bola rola", "Petrópolis", "reputação", "IA na escola"]) {
    assert.equal(containsProfanity(ok), false, ok);
  }
});

test("containsProfanity segue o idioma da sessão", () => {
  for (const bad of ["weón", "WEON", "hijueputa", "conchetumare", "gonorrea", "malparido", "qué mierdita", "fuck"]) {
    assert.equal(containsProfanity(bad, "es-419"), true, bad);
  }
  for (const ok of ["vergüenza", "las tres y pico", "coger el bus", "Culiacán", "una concha en la playa", "impresora HP", "cuidado"]) {
    assert.equal(containsProfanity(ok, "es-419"), false, ok);
  }
  for (const bad of ["bullshit", "you ass", "f*ck".replace("*", "u"), "sh1t"]) {
    assert.equal(containsProfanity(bad, "en-US"), true, bad);
  }
  for (const ok of ["class", "assist", "Scunthorpe", "cocktail", "pass"]) {
    assert.equal(containsProfanity(ok, "en-US"), false, ok);
  }
  // "porra" só barra onde é palavrão; "ass" só em inglês.
  assert.equal(containsProfanity("porra", "en-US"), false);
  assert.equal(containsProfanity("ass", "pt-BR"), false);
});

test("askQuestionSchema", () => {
  assert.equal(askQuestionSchema.safeParse({ body: " Como começar? ", withName: false }).success, true);
  assert.equal(askQuestionSchema.safeParse({ body: "a", withName: false }).success, false);
  assert.equal(askQuestionSchema.safeParse({ body: "x".repeat(281), withName: true }).success, false);
});

test("sortQuestions e topQuestions", () => {
  const q = (id: string, status: string, upvotes: number, createdAt: string) => ({ id, status, upvotes, createdAt });
  const list = [
    q("a", "visible", 1, "2026-01-01T10:00:00Z"),
    q("b", "answered", 9, "2026-01-01T09:00:00Z"),
    q("c", "visible", 5, "2026-01-01T10:05:00Z"),
    q("d", "pending", 0, "2026-01-01T10:06:00Z"),
    q("e", "visible", 1, "2026-01-01T09:30:00Z"),
  ];
  assert.deepEqual(sortQuestions(list).map((x) => x.id), ["c", "e", "a", "d", "b"]);
  assert.deepEqual(topQuestions(list, 2).map((x) => x.id), ["c", "e"]);
  assert.equal(questionsOnScreen({ status: "live", show_questions: true }), true);
  assert.equal(questionsOnScreen({ status: "paused", show_questions: true }), false);
});

test("reações: contagem, limite por pessoa e picos", () => {
  assert.deepEqual(tallyReactions([{ kind: "clap" }, { kind: "clap" }, { kind: "x" }, { kind: "heart" }]), {
    clap: 2,
    heart: 1,
    laugh: 0,
    wow: 0,
    think: 0,
  });
  assert.equal(allowReaction([1000], 1200), null);
  assert.deepEqual(allowReaction([1000], 1500), [1000, 1500]);
  const full = Array.from({ length: 20 }, (_, i) => 10_000 + i * 450);
  assert.equal(allowReaction(full, 10_000 + 20 * 450), null);
  assert.deepEqual(allowReaction(full, 30_000), [30_000]);

  const start = "2026-01-01T10:00:00.000Z";
  const rows = ["10:00:10", "10:00:50", "10:03:01", "10:03:20", "10:03:59", "09:59:00"].map((t) => ({ created_at: `2026-01-01T${t}.000Z` }));
  const moments = reactionsPerMinute(rows, start);
  assert.deepEqual(moments, [
    { minute: 0, count: 2 },
    { minute: 3, count: 3 },
  ]);
  assert.deepEqual(reactionPeaks(moments, 1), [{ minute: 3, count: 3 }]);
});
