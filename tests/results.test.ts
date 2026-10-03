import { test } from "node:test";
import assert from "node:assert/strict";
import {
  optionBars,
  ratingBars,
  ratingStats,
  snapshotFromResponses,
  snapshotFromRow,
  wordList,
  type ResultsSnapshot,
} from "../src/lib/domain/results.ts";

const snap = (counts: Record<string, number>): ResultsSnapshot => ({
  total: Object.values(counts).reduce((a, b) => a + b, 0),
  counts,
  recent: [],
});

test("snapshotFromResponses conta por chave e guarda textos abertos do mais novo ao mais antigo", () => {
  const s = snapshotFromResponses([
    { id: "1", aggregate_key: "a", value: { optionId: "a" }, created_at: "2026-01-01T10:00:00Z" },
    { id: "2", aggregate_key: "a", value: { optionId: "a" }, created_at: "2026-01-01T10:01:00Z" },
    { id: "3", aggregate_key: null, value: { text: "antigo" }, created_at: "2026-01-01T10:02:00Z" },
    { id: "4", aggregate_key: null, value: { text: "novo" }, created_at: "2026-01-01T10:03:00Z" },
    { id: "5", aggregate_key: null, value: { lixo: true }, created_at: "2026-01-01T10:04:00Z" },
  ]);
  assert.equal(s.total, 5);
  assert.deepEqual(s.counts, { a: 2 });
  assert.deepEqual(
    s.recent.map((r) => r.text),
    ["novo", "antigo"],
  );
});

test("snapshotFromRow tolera JSON inválido vindo do banco", () => {
  const s = snapshotFromRow({ total: 3, counts: "quebrado", recent: [{ id: 1 }] });
  assert.deepEqual(s, { total: 3, counts: {}, recent: [] });
  assert.equal(snapshotFromRow(null).total, 0);
});

test("optionBars calcula porcentagem e não divide por zero", () => {
  const options = [
    { id: "a", label: "Sim", position: 0 },
    { id: "b", label: "Não", position: 1 },
  ];
  const bars = optionBars(options, snap({ a: 3, b: 1 }));
  assert.deepEqual(
    bars.map((b) => [b.label, b.count, b.pct]),
    [
      ["Sim", 3, 0.75],
      ["Não", 1, 0.25],
    ],
  );
  assert.ok(optionBars(options, snap({})).every((b) => b.pct === 0));
});

test("ratingBars cobre toda a escala, inclusive notas sem voto", () => {
  const bars = ratingBars(1, 5, snap({ "5": 2 }));
  assert.deepEqual(
    bars.map((b) => b.count),
    [0, 0, 0, 0, 2],
  );
});

test("ratingStats: média e mediana com total ímpar, par e vazio", () => {
  // 1, 2, 5 → média 8/3, mediana 2
  const odd = ratingStats(1, 5, snap({ "1": 1, "2": 1, "5": 1 }));
  assert.equal(odd.median, 2);
  assert.ok(Math.abs((odd.mean ?? 0) - 8 / 3) < 1e-9);
  // 2, 2, 4, 5 → mediana (2 + 4) / 2 = 3
  assert.equal(ratingStats(1, 5, snap({ "2": 2, "4": 1, "5": 1 })).median, 3);
  // votos fora da escala são ignorados
  assert.deepEqual(ratingStats(1, 5, snap({ "9": 4 })), { total: 0, mean: null, median: null });
});

test("wordList ordena por contagem, desempata alfabeticamente e respeita o limite", () => {
  const words = wordList(snap({ zebra: 2, abacaxi: 2, ia: 5, outro: 1 }), 3);
  assert.deepEqual(
    words.map((w) => w.word),
    ["ia", "abacaxi", "zebra"],
  );
});
