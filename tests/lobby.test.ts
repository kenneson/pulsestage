import { test } from "node:test";
import assert from "node:assert/strict";
import { LOBBY_LIMIT, lobbySchema, publicName, toLobby } from "../src/lib/domain/lobby.ts";

const rules = { profanityFilter: true, locale: "pt-BR" as const };

test("nome para a sala: aparado; vazio vira anônimo; palavrão some com o filtro ligado", () => {
  assert.equal(publicName("  Ana  ", rules), "Ana");
  assert.equal(publicName("   ", rules), null);
  assert.equal(publicName(null, rules), null);
  assert.equal(publicName("porra", rules), null);
  assert.equal(publicName("porra", { ...rules, profanityFilter: false }), "porra");
});

test("sala de espera: avatar em emoji, chave curta, mais recentes até o limite", () => {
  const rows = Array.from({ length: LOBBY_LIMIT + 5 }, (_, i) => ({
    id: `${String(i).padStart(8, "0")}-0000-0000-0000-000000000000`,
    display_name: i === 0 ? "Ana" : null,
    avatar: i === 0 ? "raposa" : "nao-existe",
  }));
  const lobby = toLobby(rows, rows.length, rules);
  assert.equal(lobby.total, LOBBY_LIMIT + 5);
  assert.equal(lobby.entries.length, LOBBY_LIMIT);
  assert.equal(lobby.entries[0].key, "00000000");
  assert.equal(lobby.entries[0].name, "Ana");
  assert.equal(lobby.entries[0].avatar, "🦊");
  assert.equal(lobby.entries[1].avatar, null);
  assert.equal(lobbySchema.safeParse(lobby).success, true);
});
