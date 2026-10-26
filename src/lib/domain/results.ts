import { z } from "zod";
import type { NormalizedSettings, PublicOption } from "./interactions.ts";
import { GUESS_BUCKETS, PIN_GRID } from "./answers.ts";

export type OpenTextEntry = { id: string; text: string; at: string };

export type ResultsSnapshot = {
  total: number;
  counts: Record<string, number>;
  recent: OpenTextEntry[];
};

export const EMPTY_SNAPSHOT: ResultsSnapshot = { total: 0, counts: {}, recent: [] };

const countsSchema = z.record(z.string(), z.number());
const recentSchema = z.array(z.object({ id: z.string(), text: z.string(), at: z.string() }));
const textValueSchema = z.object({ text: z.string() });
const rankingValueSchema = z.object({ points: z.record(z.string(), z.number()) });
const tallyValueSchema = z.object({ tally: z.record(z.string(), z.number()) });

/** Converte uma linha de interaction_results (JSONB) num snapshot tipado. */
export function snapshotFromRow(
  row: { total: number; counts: unknown; recent: unknown } | null | undefined,
): ResultsSnapshot {
  if (!row) return EMPTY_SNAPSHOT;
  const counts = countsSchema.safeParse(row.counts);
  const recent = recentSchema.safeParse(row.recent);
  return {
    total: row.total,
    counts: counts.success ? counts.data : {},
    recent: recent.success ? recent.data : [],
  };
}

/**
 * Recalcula o snapshot a partir das respostas brutas (usado no analytics e no filtro "comparar grupos"), com as
 * mesmas regras do banco: o total conta todas; contagens e textos só as visíveis (moderação); `value.tally` e os
 * pontos do ranking somam por chave; senão, +1 na aggregate_key.
 */
export function snapshotFromResponses(
  responses: readonly { id: string; aggregate_key: string | null; value: unknown; created_at: string; moderation?: string }[],
): ResultsSnapshot {
  const counts: Record<string, number> = {};
  const recent: OpenTextEntry[] = [];
  for (const r of responses) {
    if (r.moderation !== undefined && r.moderation !== "visible") continue;
    const tally = tallyValueSchema.safeParse(r.value);
    if (tally.success) {
      for (const [key, value] of Object.entries(tally.data.tally)) counts[key] = (counts[key] ?? 0) + value;
      continue;
    }
    if (r.aggregate_key) {
      counts[r.aggregate_key] = (counts[r.aggregate_key] ?? 0) + 1;
      continue;
    }
    const ranking = rankingValueSchema.safeParse(r.value);
    if (ranking.success) {
      for (const [key, points] of Object.entries(ranking.data.points)) counts[key] = (counts[key] ?? 0) + points;
      continue;
    }
    const parsed = textValueSchema.safeParse(r.value);
    if (parsed.success) recent.push({ id: r.id, text: parsed.data.text, at: r.created_at });
  }
  recent.sort((a, b) => b.at.localeCompare(a.at));
  return { total: responses.length, counts, recent };
}

export type Bar = { key: string; label: string; count: number; pct: number };

function pct(count: number, total: number): number {
  return total > 0 ? count / total : 0;
}

export function optionBars(options: readonly PublicOption[], snapshot: ResultsSnapshot): Bar[] {
  return options.map((o) => {
    const count = snapshot.counts[o.id] ?? 0;
    return { key: o.id, label: o.label, count, pct: pct(count, snapshot.total) };
  });
}

export function ratingBars(min: number, max: number, snapshot: ResultsSnapshot): Bar[] {
  const bars: Bar[] = [];
  for (let v = min; v <= max; v++) {
    const count = snapshot.counts[String(v)] ?? 0;
    bars.push({ key: String(v), label: String(v), count, pct: pct(count, snapshot.total) });
  }
  return bars;
}

export type RatingStats = { total: number; mean: number | null; median: number | null };

export function ratingStats(min: number, max: number, snapshot: ResultsSnapshot): RatingStats {
  let total = 0;
  let sum = 0;
  const dist: { value: number; count: number }[] = [];
  for (let v = min; v <= max; v++) {
    const count = snapshot.counts[String(v)] ?? 0;
    total += count;
    sum += v * count;
    dist.push({ value: v, count });
  }
  if (total === 0) return { total, mean: null, median: null };

  const valueAt = (index: number): number => {
    let seen = 0;
    for (const d of dist) {
      seen += d.count;
      if (index < seen) return d.value;
    }
    return max;
  };
  const median = total % 2 === 1 ? valueAt((total - 1) / 2) : (valueAt(total / 2 - 1) + valueAt(total / 2)) / 2;
  return { total, mean: sum / total, median };
}

export type WordCount = { word: string; count: number };

export function wordList(snapshot: ResultsSnapshot, limit = 40): WordCount[] {
  return Object.entries(snapshot.counts)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, limit);
}

export type ResultsMap = Record<string, ResultsSnapshot>;

/** Linhas de interaction_results → mapa por interaction_id. */
export function toResultsMap(
  rows: readonly { interaction_id: string; total: number; counts: unknown; recent: unknown }[],
): ResultsMap {
  const map: ResultsMap = {};
  for (const row of rows) map[row.interaction_id] = snapshotFromRow(row);
  return map;
}

// ---------------------------------------------------------------------------
// Tipos novos
// ---------------------------------------------------------------------------

/** Múltipla escolha com limite: % sobre quem respondeu (a soma pode passar de 100%). */
export const choiceBars = optionBars;

/** 100 pontos: média de pontos por pessoa em cada alternativa (`pct` = média / 100), da maior para a menor. */
export function pointsBars(options: readonly PublicOption[], snapshot: ResultsSnapshot): (Bar & { average: number })[] {
  return options
    .map((o) => {
      const sum = snapshot.counts[o.id] ?? 0;
      const average = snapshot.total > 0 ? sum / snapshot.total : 0;
      return { key: o.id, label: o.label, count: sum, pct: average / 100, average };
    })
    .sort((a, b) => b.average - a.average);
}

/** Matriz 2×2: posição média (0–100) de cada item; null quando ninguém posicionou o item ainda. */
export type MatrixPoint = { key: string; label: string; x: number; y: number; count: number; index: number };

export function matrixPoints(options: readonly PublicOption[], snapshot: ResultsSnapshot): MatrixPoint[] {
  return options.flatMap((o, index) => {
    const n = snapshot.counts[`${o.id}:n`] ?? 0;
    if (n <= 0) return [];
    return [
      {
        key: o.id,
        label: o.label,
        x: (snapshot.counts[`${o.id}:x`] ?? 0) / n,
        y: (snapshot.counts[`${o.id}:y`] ?? 0) / n,
        count: n,
        index,
      },
    ];
  });
}

/** Marcar na imagem: células da grade com toques (gx, gy de 0 a PIN_GRID−1) e a intensidade (0–1). */
export type PinCell = { gx: number; gy: number; count: number; intensity: number };

export function pinHeat(snapshot: ResultsSnapshot): { grid: number; cells: PinCell[]; max: number } {
  const cells: PinCell[] = [];
  let max = 0;
  for (const [key, count] of Object.entries(snapshot.counts)) {
    const match = key.match(/^c:(\d+):(\d+)$/);
    if (!match || count <= 0) continue;
    max = Math.max(max, count);
    cells.push({ gx: Number(match[1]), gy: Number(match[2]), count, intensity: 0 });
  }
  for (const cell of cells) cell.intensity = max > 0 ? cell.count / max : 0;
  return { grid: PIN_GRID, cells, max };
}

/** Adivinhe o número: histograma (GUESS_BUCKETS baldes) e média dos chutes. */
export type GuessBucket = { index: number; from: number; to: number; count: number; pct: number };
export type GuessStats = { total: number; mean: number | null; buckets: GuessBucket[]; maxCount: number };

export function guessStats(settings: Pick<NormalizedSettings, "numMin" | "numMax">, snapshot: ResultsSnapshot): GuessStats {
  const span = (settings.numMax - settings.numMin) / GUESS_BUCKETS;
  let maxCount = 0;
  const buckets: GuessBucket[] = Array.from({ length: GUESS_BUCKETS }, (_, index) => {
    const count = snapshot.counts[`b:${index}`] ?? 0;
    maxCount = Math.max(maxCount, count);
    return { index, from: settings.numMin + span * index, to: settings.numMin + span * (index + 1), count, pct: 0 };
  });
  const answered = buckets.reduce((acc, b) => acc + b.count, 0);
  for (const b of buckets) b.pct = answered > 0 ? b.count / answered : 0;
  const sum = snapshot.counts._sum;
  return { total: answered, mean: answered > 0 && sum !== undefined ? sum / answered : null, buckets, maxCount };
}

/** Quiz de digitar: respostas mais frequentes (texto normalizado), para mostrar depois de revelar. */
export function textAnswerBars(snapshot: ResultsSnapshot, limit = 8): Bar[] {
  return Object.entries(snapshot.counts)
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .slice(0, limit)
    .map(([key, count]) => ({ key, label: key, count, pct: pct(count, snapshot.total) }));
}
