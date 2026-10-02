import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTerm } from "../src/lib/domain/words.ts";

test("normaliza caixa, pontuação e espaços", () => {
  assert.equal(normalizeTerm("  Produtividade!!! "), "produtividade");
  assert.equal(normalizeTerm("Inteligência   Artificial"), "inteligência artificial");
});

test("remove stopwords e devolve null quando nada sobra", () => {
  assert.equal(normalizeTerm("a produtividade"), "produtividade");
  assert.equal(normalizeTerm("de que"), null);
  assert.equal(normalizeTerm("!!!"), null);
});

test("limita a três termos", () => {
  assert.equal(normalizeTerm("um dois três quatro cinco"), "dois três quatro");
});
