// Leituras de apoio dos gráficos do telão, da sala ao vivo e do celular. Regras puras (sem I/O).

import type { PinCell } from "./results.ts";

// ---------------------------------------------------------------------------
// Marcar na imagem: a área mais marcada (texto alternativo e legenda do mapa de calor)
// ---------------------------------------------------------------------------

export const PIN_REGIONS = [
  "topLeft",
  "top",
  "topRight",
  "left",
  "center",
  "right",
  "bottomLeft",
  "bottom",
  "bottomRight",
] as const;
export type PinRegion = (typeof PIN_REGIONS)[number];

/** Área (grade 3×3 da imagem) com mais marcações; null sem marcações. Empate: a primeira na ordem de leitura. */
export function pinHotRegion(heat: { grid: number; cells: readonly PinCell[] }): PinRegion | null {
  if (heat.cells.length === 0 || heat.grid <= 0) return null;
  const sums: number[] = Array.from({ length: 9 }, () => 0);
  for (const cell of heat.cells) {
    const col = Math.min(2, Math.floor((cell.gx * 3) / heat.grid));
    const row = Math.min(2, Math.floor((cell.gy * 3) / heat.grid));
    sums[row * 3 + col]! += cell.count;
  }
  let best = 0;
  for (let i = 1; i < 9; i++) if (sums[i]! > sums[best]!) best = i;
  return sums[best]! > 0 ? PIN_REGIONS[best]! : null;
}

// ---------------------------------------------------------------------------
// Adivinhe o número: posição de um valor no eixo do histograma
// ---------------------------------------------------------------------------

/** Posição (0–1) de `value` entre numMin e numMax, presa às pontas. */
export function axisPosition(value: number, range: { numMin: number; numMax: number }): number {
  const span = range.numMax - range.numMin;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (value - range.numMin) / span));
}

// ---------------------------------------------------------------------------
// Cronômetro do telão
// ---------------------------------------------------------------------------

/** Segundos finais em destaque (âmbar). */
export const TIMER_URGENT_SECONDS = 5;

export type Countdown = { remaining: number; fraction: number; urgent: boolean; ended: boolean };

/**
 * Contagem regressiva a partir da abertura da pergunta. Sem abertura registrada, o tempo cheio
 * (a pergunta acabou de entrar e o estado ainda não chegou).
 */
export function countdown(input: { activatedAt: string | null; seconds: number; now: number }): Countdown {
  const opened = input.activatedAt ? Date.parse(input.activatedAt) : Number.NaN;
  const elapsed = Number.isFinite(opened) ? Math.max(0, input.now - opened) : 0;
  const leftMs = Math.max(0, input.seconds * 1000 - elapsed);
  const remaining = Math.ceil(leftMs / 1000);
  return {
    remaining,
    fraction: input.seconds > 0 ? leftMs / (input.seconds * 1000) : 0,
    urgent: remaining <= TIMER_URGENT_SECONDS,
    ended: leftMs <= 0,
  };
}
