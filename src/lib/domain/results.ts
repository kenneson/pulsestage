import { z } from "zod";
import type { PublicOption } from "./interactions";

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

/** Recalcula o snapshot a partir das respostas brutas (usado no analytics). */
export function snapshotFromResponses(
  responses: readonly { id: string; aggregate_key: string | null; value: unknown; created_at: string }[],
): ResultsSnapshot {
  const counts: Record<string, number> = {};
  const recent: OpenTextEntry[] = [];
  for (const r of responses) {
    if (r.aggregate_key) counts[r.aggregate_key] = (counts[r.aggregate_key] ?? 0) + 1;
    else {
      const parsed = textValueSchema.safeParse(r.value);
      if (parsed.success) recent.push({ id: r.id, text: parsed.data.text, at: r.created_at });
    }
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
