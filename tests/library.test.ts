import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLibrary, matchesLibraryQuery, type LibrarySource } from "../src/lib/domain/library.ts";

const source = (over: Partial<LibrarySource>): LibrarySource => ({
  id: "i1",
  sessionId: "s1",
  type: "multiple_choice",
  title: "Você já usa IA?",
  createdAt: "2026-09-01T10:00:00Z",
  optionLabels: ["Sim", "Não"],
  participation: 0.5,
  ...over,
});

test("a mesma pergunta em sessões diferentes vira um item, copiando a mais recente", () => {
  const items = buildLibrary([
    source({ id: "old", sessionId: "s1", createdAt: "2026-09-01T10:00:00Z", participation: 0.4 }),
    source({ id: "new", sessionId: "s2", title: "  você já usa   IA? ", createdAt: "2026-09-20T10:00:00Z", participation: 0.8 }),
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.sourceId, "new");
  assert.equal(items[0]?.sessions, 2);
  assert.ok(Math.abs((items[0]?.participation ?? 0) - 0.6) < 1e-9);
});

test("alternativas ou tipo diferentes mantêm itens separados; sem participantes não entra na média", () => {
  const items = buildLibrary([
    source({ id: "a" }),
    source({ id: "b", optionLabels: ["Sim", "Não", "Às vezes"] }),
    source({ id: "c", type: "quiz" }),
    source({ id: "d", type: "word_cloud", title: "Uma palavra", optionLabels: [], participation: null }),
  ]);
  assert.equal(items.length, 4);
  assert.equal(items.find((i) => i.sourceId === "d")?.participation, null);
});

test("busca ignora acento e maiúsculas e olha as alternativas", () => {
  const item = { title: "Qual é a sua maior dúvida?", optionLabels: ["Produtividade"] };
  assert.ok(matchesLibraryQuery(item, "DUVIDA"));
  assert.ok(matchesLibraryQuery(item, "produt"));
  assert.ok(!matchesLibraryQuery(item, "quiz"));
  assert.ok(matchesLibraryQuery(item, "  "));
});
