import { test } from "node:test";
import assert from "node:assert/strict";
import { utcToZonedParts, zonedToUtcIso } from "../src/lib/datetime.ts";

test("converte horário de São Paulo para UTC e volta", () => {
  const iso = zonedToUtcIso("2026-10-10", "19:00", "America/Sao_Paulo");
  assert.equal(iso, "2026-10-10T22:00:00.000Z");
  assert.deepEqual(utcToZonedParts(iso, "America/Sao_Paulo"), { date: "2026-10-10", time: "19:00" });
});

test("rejeita entradas inválidas", () => {
  assert.equal(zonedToUtcIso("10/10/2026", "19:00"), null);
  assert.equal(zonedToUtcIso("2026-10-10", "7pm"), null);
});
