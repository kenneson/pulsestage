// Respostas dos tipos novos: valida o que chegou do celular e monta o que vai para responses.value.
// Regras puras (sem I/O). O servidor lê alternativas, settings e gabarito e decide aqui.
// `tally` (mapa chave → número) é somado nos resultados públicos pelo banco (apply_response_to_results).

import { POINTS_BUDGET, type NormalizedSettings } from "./interactions.ts";

export type Tally = Record<string, number>;
export type BuiltAnswer =
  | { ok: true; value: Record<string, unknown>; aggregateKey: string | null }
  | { ok: false; error: string };

const fail = (error: string): BuiltAnswer => ({ ok: false, error });

/** Múltipla escolha com limite: sem repetir, só alternativas da pergunta, até `maxChoices`. */
export function multiChoiceAnswer(optionIds: readonly string[], validIds: readonly string[], maxChoices: number): BuiltAnswer {
  const unique = [...new Set(optionIds)];
  if (unique.length === 0) return fail("validation.chooseAtLeastOne");
  if (unique.length > maxChoices) return fail("participant.errors.tooManyChoices");
  if (!unique.every((id) => validIds.includes(id))) return fail("participant.errors.invalidOption");
  const tally: Tally = Object.fromEntries(unique.map((id) => [id, 1]));
  return { ok: true, value: { optionIds: unique, tally }, aggregateKey: null };
}

/** 100 pontos: soma exata de POINTS_BUDGET entre as alternativas da pergunta. Zeros ficam de fora. */
export function pointsAnswer(allocations: Record<string, number>, validIds: readonly string[]): BuiltAnswer {
  const entries = Object.entries(allocations).filter(([, points]) => points > 0);
  if (!entries.every(([id]) => validIds.includes(id))) return fail("participant.errors.invalidOption");
  const sum = entries.reduce((acc, [, points]) => acc + points, 0);
  if (sum !== POINTS_BUDGET) return fail("participant.errors.pointsMustTotal");
  const clean = Object.fromEntries(entries);
  return { ok: true, value: { allocations: clean, tally: clean }, aggregateKey: null };
}

/** Matriz 2×2: posição (0–100) de cada item posicionado; pelo menos um. Soma x, y e quantos por item. */
export function matrixAnswer(positions: Record<string, { x: number; y: number }>, validIds: readonly string[]): BuiltAnswer {
  const entries = Object.entries(positions);
  if (entries.length === 0) return fail("participant.errors.placeAtLeastOne");
  if (!entries.every(([id]) => validIds.includes(id))) return fail("participant.errors.invalidOption");
  const tally: Tally = {};
  for (const [id, { x, y }] of entries) {
    tally[`${id}:x`] = x;
    tally[`${id}:y`] = y;
    tally[`${id}:n`] = 1;
  }
  return { ok: true, value: { positions, tally }, aggregateKey: null };
}

/** Lado da grade do mapa de calor do "Marcar na imagem". */
export const PIN_GRID = 20;

export function pinCell(x: number, y: number): { gx: number; gy: number } {
  const clamp = (v: number) => Math.min(PIN_GRID - 1, Math.max(0, Math.floor(v * PIN_GRID)));
  return { gx: clamp(x), gy: clamp(y) };
}

export function pinAnswer(x: number, y: number): BuiltAnswer {
  const { gx, gy } = pinCell(x, y);
  const round = (v: number) => Math.round(v * 10000) / 10000;
  return { ok: true, value: { x: round(x), y: round(y), tally: { [`c:${gx}:${gy}`]: 1 } }, aggregateKey: null };
}

/** Baldes do histograma do "Adivinhe o número". */
export const GUESS_BUCKETS = 20;

export function guessBucket(value: number, settings: Pick<NormalizedSettings, "numMin" | "numMax">): number {
  const span = settings.numMax - settings.numMin;
  if (span <= 0) return 0;
  return Math.min(GUESS_BUCKETS - 1, Math.max(0, Math.floor(((value - settings.numMin) / span) * GUESS_BUCKETS)));
}

/** Contagens do chute: balde do histograma e soma (para a média no telão). */
export function guessTally(value: number, settings: Pick<NormalizedSettings, "numMin" | "numMax">): Tally {
  return { [`b:${guessBucket(value, settings)}`]: 1, _sum: value };
}
