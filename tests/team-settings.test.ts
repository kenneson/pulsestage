import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canAddTeam,
  canRemoveTeam,
  defaultTeams,
  moveTeam,
  nextTeamColor,
  sameTeams,
  teamNameSchema,
} from "../src/lib/domain/team-settings.ts";

test("equipes padrão: quatro, nas cores das formas 1–4, na ordem", () => {
  const teams = defaultTeams(["Vermelha", "Azul", "Amarela", "Verde"]);
  assert.deepEqual(
    teams.map((t) => [t.name, t.color, t.position]),
    [
      ["Vermelha", 1, 0],
      ["Azul", 2, 1],
      ["Amarela", 3, 2],
      ["Verde", 4, 3],
    ],
  );
  // Sem nome traduzido, um número no lugar (nunca nome vazio).
  assert.equal(defaultTeams([])[2]!.name, "3");
});

test("próxima cor: a primeira livre; com todas usadas, a de menos uso", () => {
  assert.equal(nextTeamColor([1, 2, 3, 4]), 5);
  assert.equal(nextTeamColor([2, 3]), 1);
  assert.equal(nextTeamColor([1, 2, 3, 4, 5, 6, 7, 8, 1, 2]), 3);
});

test("limites: até 8; com equipes ligadas, pelo menos 2", () => {
  assert.equal(canAddTeam(7), true);
  assert.equal(canAddTeam(8), false);
  assert.equal(canRemoveTeam(2, true), false);
  assert.equal(canRemoveTeam(3, true), true);
  assert.equal(canRemoveTeam(1, false), true);
});

test("ordem: sobe e desce sem sair da lista; nova ordem precisa ter as mesmas equipes", () => {
  assert.deepEqual(moveTeam(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
  assert.deepEqual(moveTeam(["a", "b", "c"], "c", 1), ["a", "b", "c"]);
  assert.deepEqual(moveTeam(["a", "b"], "x", 1), ["a", "b"]);
  assert.equal(sameTeams(["a", "b"], ["b", "a"]), true);
  assert.equal(sameTeams(["a", "b"], ["a", "a"]), false);
  assert.equal(sameTeams(["a", "b"], ["a"]), false);
});

test("nome: obrigatório, até 40 caracteres, sem espaços nas pontas", () => {
  assert.equal(teamNameSchema.parse("  Azul  "), "Azul");
  assert.equal(teamNameSchema.safeParse("   ").success, false);
  assert.equal(teamNameSchema.safeParse("x".repeat(41)).success, false);
});
