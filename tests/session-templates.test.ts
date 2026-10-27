import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  findSessionTemplate,
  SESSION_TEMPLATES,
  templateInteractions,
  templatePreview,
  templateTextKeys,
} from "../src/lib/domain/session-templates.ts";
import { interactionInputSchema } from "../src/lib/domain/interactions.ts";

const LOCALES = ["pt-BR", "es-419", "en-US"] as const;
type Tree = { [key: string]: string | Tree };

function textFor(locale: string): (key: string) => string {
  const tree = JSON.parse(readFileSync(join(import.meta.dirname, "..", "messages", locale, "templates.json"), "utf8")) as Tree;
  return (key: string) => {
    let node: string | Tree | undefined = tree;
    for (const part of key.split(".")) node = typeof node === "object" ? node[part] : undefined;
    if (typeof node !== "string") throw new Error(`${locale}: falta templates.${key}`);
    return node;
  };
}

test("seis modelos, com ids únicos, para escola, universidade e empresa", () => {
  assert.equal(SESSION_TEMPLATES.length, 6);
  assert.equal(new Set(SESSION_TEMPLATES.map((t) => t.id)).size, 6);
  const audiences = new Set(SESSION_TEMPLATES.flatMap((t) => t.audiences));
  assert.deepEqual([...audiences].sort(), ["company", "school", "university"]);
  assert.equal(findSessionTemplate("planning")?.id, "planning");
  assert.equal(findSessionTemplate("nada"), null);
});

test("nos três idiomas, todo texto existe e toda pergunta passa na validação do builder", () => {
  for (const locale of LOCALES) {
    const text = textFor(locale);
    for (const template of SESSION_TEMPLATES) {
      for (const key of templateTextKeys(template)) assert.ok(text(key).trim().length > 0, `${locale} ${key}`);
      const inputs = templateInteractions(template, text);
      assert.equal(inputs.length, template.questions.length);
      for (const input of inputs) {
        const parsed = interactionInputSchema.safeParse(input);
        assert.ok(parsed.success, `${locale} ${template.id} ${input.title}: ${parsed.success ? "" : JSON.stringify(parsed.error.issues)}`);
      }
    }
  }
});

test("usa os tipos novos e os antigos; quiz com a alternativa certa marcada", () => {
  const types = new Set(SESSION_TEMPLATES.flatMap((t) => t.questions.map((q) => q.type)));
  for (const type of ["content", "points_100", "matrix_2x2", "guess_number", "quiz_text", "quiz", "word_cloud", "rating", "ranking"]) {
    assert.ok(types.has(type as never), type);
  }
  const text = textFor("pt-BR");
  const review = findSessionTemplate("quizReview")!;
  const prime = templateInteractions(review, text).find((i) => i.title.includes("primo"));
  assert.ok(prime && prime.type === "quiz");
  assert.deepEqual(
    prime.options.filter((o) => o.isCorrect).map((o) => o.label),
    ["17"],
  );
  assert.equal(review.teams, true);
  assert.equal(findSessionTemplate("selfPacedSurvey")?.pace, "self");
});

test("prévia: tipo e título de cada pergunta, na ordem", () => {
  const planning = findSessionTemplate("planning")!;
  const preview = templatePreview(planning, textFor("en-US"));
  assert.deepEqual(
    preview.map((p) => p.type),
    ["content", "matrix_2x2", "points_100", "multiple_choice", "open_text"],
  );
  assert.equal(preview[1]!.title, "Place each initiative by effort and impact");
});
