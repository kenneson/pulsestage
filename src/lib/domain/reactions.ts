// Reações ao vivo. Regras puras (sem I/O).

import { z } from "zod";

export const REACTIONS = [
  { key: "clap", emoji: "👏", label: "Aplausos" },
  { key: "heart", emoji: "❤️", label: "Amei" },
  { key: "laugh", emoji: "😂", label: "Engraçado" },
  { key: "wow", emoji: "😮", label: "Uau" },
  { key: "think", emoji: "🤔", label: "Pensativo" },
] as const;

export type ReactionKind = (typeof REACTIONS)[number]["key"];
export const REACTION_KINDS = REACTIONS.map((r) => r.key) as [ReactionKind, ...ReactionKind[]];
export const reactionKindSchema = z.enum(REACTION_KINDS);

export const REACTION_EMOJI = Object.fromEntries(REACTIONS.map((r) => [r.key, r.emoji])) as Record<ReactionKind, string>;

/** Intervalo mínimo entre reações da mesma pessoa e teto por janela (anti-enxurrada). */
export const REACTION_MIN_INTERVAL_MS = 400;
export const REACTION_BURST = 20;
export const REACTION_BURST_WINDOW_MS = 10_000;
/** De quanto em quanto tempo o telão busca reações novas. */
export const REACTION_POLL_MS = 1500;
/** Emojis animados por kind a cada busca, no máximo (o resto vira só número). */
export const REACTION_MAX_FLOATS = 12;

export type ReactionTally = Record<ReactionKind, number>;

export function emptyTally(): ReactionTally {
  return { clap: 0, heart: 0, laugh: 0, wow: 0, think: 0 };
}

export function tallyReactions(rows: readonly { kind: string }[]): ReactionTally {
  const tally = emptyTally();
  for (const r of rows) {
    const parsed = reactionKindSchema.safeParse(r.kind);
    if (parsed.success) tally[parsed.data] += 1;
  }
  return tally;
}

/**
 * Controle por participante, em memória: aceita se respeitar o intervalo mínimo e o teto da janela.
 * Devolve a lista nova de horários (para guardar) ou null se recusar.
 */
export function allowReaction(previous: readonly number[], now: number): number[] | null {
  const recent = previous.filter((t) => now - t < REACTION_BURST_WINDOW_MS);
  const last = recent.at(-1);
  if (last !== undefined && now - last < REACTION_MIN_INTERVAL_MS) return null;
  if (recent.length >= REACTION_BURST) return null;
  return [...recent, now];
}

export type ReactionMoment = { minute: number; count: number };

/** Reações por minuto de palestra (para achar os picos). */
export function reactionsPerMinute(
  rows: readonly { created_at: string }[],
  startedAt: string | null,
): ReactionMoment[] {
  if (!startedAt) return [];
  const start = Date.parse(startedAt);
  const byMinute = new Map<number, number>();
  for (const r of rows) {
    const t = Date.parse(r.created_at);
    if (Number.isNaN(t) || t < start) continue;
    const minute = Math.floor((t - start) / 60_000);
    byMinute.set(minute, (byMinute.get(minute) ?? 0) + 1);
  }
  return [...byMinute.entries()].map(([minute, count]) => ({ minute, count })).sort((a, b) => a.minute - b.minute);
}

/** Os momentos com mais reações (picos), do maior para o menor. */
export function reactionPeaks(moments: readonly ReactionMoment[], limit = 3): ReactionMoment[] {
  return [...moments].sort((a, b) => b.count - a.count || a.minute - b.minute).slice(0, limit);
}
