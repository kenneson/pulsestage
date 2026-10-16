import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canTransition,
  generateJoinCode,
  isEditable,
  isInProgress,
  JOIN_CODE_REGEX,
  normalizeJoinCode,
  toSessionStatus,
} from "../src/lib/domain/session.ts";

test("transições de status permitidas", () => {
  assert.ok(canTransition("draft", "live"));
  assert.ok(canTransition("live", "paused"));
  assert.ok(canTransition("paused", "completed"));
  assert.ok(!canTransition("completed", "live"));
  assert.ok(!canTransition("draft", "completed"));
});

test("código gerado é válido e sem caracteres ambíguos", () => {
  for (let i = 0; i < 200; i++) {
    const code = generateJoinCode();
    assert.match(code, JOIN_CODE_REGEX);
    assert.doesNotMatch(code, /[01OI]/);
  }
});

test("normaliza o código digitado", () => {
  assert.equal(normalizeJoinCode(" ia-2026 "), "IA2026");
});

test("toSessionStatus: valor desconhecido vira rascunho", () => {
  assert.equal(toSessionStatus("live"), "live");
  assert.equal(toSessionStatus("completed"), "completed");
  assert.equal(toSessionStatus("arquivada"), "draft");
  assert.equal(toSessionStatus(""), "draft");
});

test("em andamento: ao vivo ou pausada", () => {
  assert.ok(isInProgress("live"));
  assert.ok(isInProgress("paused"));
  assert.ok(!isInProgress("draft"));
  assert.ok(!isInProgress("completed"));
});

test("editável: tudo antes de encerrar", () => {
  assert.ok(isEditable("draft"));
  assert.ok(isEditable("live"));
  assert.ok(isEditable("paused"));
  assert.ok(!isEditable("completed"));
});
