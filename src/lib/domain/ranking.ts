// Ranking (ordenar alternativas). Regra pura (sem I/O).
// Contagem de Borda: com n alternativas, a 1ª colocada recebe n pontos, a 2ª n−1, … e a última 1.
// O servidor grava os pontos de cada resposta; o banco soma em interaction_results.counts.

import type { ResultsSnapshot } from "./results.ts";

/** Pontos de cada alternativa numa resposta (ordem = da preferida para a menos preferida). */
export function bordaPoints(order: readonly string[]): Record<string, number> {
  const n = order.length;
  return Object.fromEntries(order.map((id, index) => [id, n - index]));
}

/** A ordem precisa conter cada alternativa exatamente uma vez. */
export function isValidRanking(order: readonly string[], optionIds: readonly string[]): boolean {
  if (order.length !== optionIds.length) return false;
  const expected = new Set(optionIds);
  const seen = new Set<string>();
  for (const id of order) {
    if (!expected.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

export type RankingRow = {
  key: string;
  label: string;
  points: number;
  /** posição média (1 = sempre em primeiro); null sem respostas */
  averagePosition: number | null;
  /** pontos em relação à alternativa mais pontuada (0–1), para a barra */
  share: number;
};

/** Alternativas da mais para a menos preferida (empate: ordem original). */
export function rankingResults(
  options: readonly { id: string; label: string }[],
  snapshot: Pick<ResultsSnapshot, "total" | "counts">,
): RankingRow[] {
  const n = options.length;
  const top = Math.max(0, ...options.map((o) => snapshot.counts[o.id] ?? 0));
  return options
    .map((o, index) => {
      const points = snapshot.counts[o.id] ?? 0;
      return {
        index,
        row: {
          key: o.id,
          label: o.label,
          points,
          averagePosition: snapshot.total > 0 ? Math.round((n + 1 - points / snapshot.total) * 10) / 10 : null,
          share: top > 0 ? points / top : 0,
        },
      };
    })
    .sort((a, b) => b.row.points - a.row.points || a.index - b.index)
    .map((e) => e.row);
}
