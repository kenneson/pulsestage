import { z } from "zod";

// Equipes da sessão, do lado do palestrante: limites, padrão e ordem. Regra pura (sem I/O).
// A cor é a posição das formas (--shape-1..8): a mesma paleta das alternativas, validada para os dois temas.

export const TEAM_MIN = 2;
export const TEAM_MAX = 8;
export const TEAM_NAME_MAX = 40;
export const TEAM_COLORS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
/** Equipes criadas ao ligar a opção: as cores das formas 1–4 (vermelho, azul, amarelo, verde). */
export const DEFAULT_TEAM_COLORS = [1, 2, 3, 4] as const;

export const teamNameSchema = z
  .string({ error: "session.teams.errors.nameRequired" })
  .trim()
  .min(1, "session.teams.errors.nameRequired")
  .max(TEAM_NAME_MAX, "session.teams.errors.nameTooLong");

export const teamColorSchema = z.number().int().min(1).max(TEAM_COLORS.length);

export type TeamDraft = { name: string; color: number; position: number };

/** Equipes padrão: um nome por cor (os nomes vêm traduzidos de quem chama, na ordem das cores). */
export function defaultTeams(names: readonly string[]): TeamDraft[] {
  return DEFAULT_TEAM_COLORS.map((color, index) => ({
    name: (names[index] ?? "").trim().slice(0, TEAM_NAME_MAX) || String(index + 1),
    color,
    position: index,
  }));
}

/** Cor da próxima equipe: a primeira que ninguém usa; com todas usadas, recomeça pela de menos uso. */
export function nextTeamColor(used: readonly number[]): number {
  const free = TEAM_COLORS.find((c) => !used.includes(c));
  if (free) return free;
  const uses = TEAM_COLORS.map((c) => ({ c, n: used.filter((u) => u === c).length }));
  return uses.reduce((best, cur) => (cur.n < best.n ? cur : best)).c;
}

export function canAddTeam(count: number): boolean {
  return count < TEAM_MAX;
}

/** Com equipes ligadas, ficam pelo menos duas (uma equipe só não é disputa). */
export function canRemoveTeam(count: number, enabled: boolean): boolean {
  return !enabled || count > TEAM_MIN;
}

/** Nova ordem ao subir (-1) ou descer (+1) uma equipe; sem mudança, a mesma lista. */
export function moveTeam(ids: readonly string[], id: string, direction: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

/** A nova ordem precisa ter exatamente as mesmas equipes (sem faltar, sobrar nem repetir). */
export function sameTeams(current: readonly string[], order: readonly string[]): boolean {
  return order.length === current.length && new Set(order).size === order.length && order.every((id) => current.includes(id));
}
