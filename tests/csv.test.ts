import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, csvFileName, toCsv } from "../src/lib/domain/csv.ts";

test("células: aspas, separador, quebra de linha, número com vírgula", () => {
  assert.equal(csvCell("simples"), "simples");
  assert.equal(csvCell('disse "oi"'), '"disse ""oi"""');
  assert.equal(csvCell("a;b"), '"a;b"');
  assert.equal(csvCell("linha 1\nlinha 2"), '"linha 1\nlinha 2"');
  assert.equal(csvCell(4.5), "4,5");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(true), "sim");
});

test("texto que começa com fórmula é neutralizado", () => {
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell("+55 11"), "'+55 11");
  assert.equal(csvCell("@usuario"), "'@usuario");
  assert.equal(csvCell("-10"), "'-10");
  assert.equal(csvCell("normal = ok"), "normal = ok");
});

test("arquivo com BOM, cabeçalho e CRLF; nome de arquivo sem acento", () => {
  const csv = toCsv(["a", "b"], [[1, "x"]]);
  assert.ok(csv.startsWith("﻿a;b\r\n1;x"));
  assert.equal(csvFileName("Comunicação para líderes!", "pesquisa"), "comunicacao-para-lideres-pesquisa.csv");
  assert.equal(csvFileName("???", "x"), "sessao-x.csv");
});
