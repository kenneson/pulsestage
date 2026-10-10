// Tempo de palestra. Regra pura (sem I/O).
// Duração real = do início (started_at) ao fim (ended_at), descontando as pausas.
// Durante a sessão, o relógio corre até agora; pausada, fica parado no momento da pausa.

export type SessionClock = {
  startedAt: string | null;
  endedAt: string | null;
  pausedAt: string | null;
  pausedSeconds: number;
};

/** Relógio a partir das colunas da sessão. */
export function sessionClock(row: {
  started_at: string | null;
  ended_at: string | null;
  paused_at: string | null;
  paused_seconds: number;
}): SessionClock {
  return { startedAt: row.started_at, endedAt: row.ended_at, pausedAt: row.paused_at, pausedSeconds: row.paused_seconds };
}

/** Segundos de palestra até `now` (ms). Null antes de a sessão começar. */
export function talkSeconds(clock: SessionClock, now: number): number | null {
  if (!clock.startedAt) return null;
  const start = Date.parse(clock.startedAt);
  const end = clock.endedAt ? Date.parse(clock.endedAt) : clock.pausedAt ? Date.parse(clock.pausedAt) : now;
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, Math.floor((end - start) / 1000) - clock.pausedSeconds);
}

/** Relógio: "4:05", "45:00", "1:02:09". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = String(s % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

/** Minutos arredondados para exibir duração ("51 min", "1 h 05 min"). */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 30) return "menos de 1 min";
  const minutes = Math.round(Math.max(0, totalSeconds) / 60);
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest === 0 ? `${minutes / 60} h` : `${Math.floor(minutes / 60)} h ${String(rest).padStart(2, "0")} min`;
}

/** Comparação com a duração prevista: diferença em minutos (positiva = passou do tempo). */
export function versusPlanned(totalSeconds: number, plannedMinutes: number | null): { diffMinutes: number; over: boolean } | null {
  if (!plannedMinutes) return null;
  const diffMinutes = Math.round(totalSeconds / 60) - plannedMinutes;
  return { diffMinutes, over: totalSeconds > plannedMinutes * 60 };
}

/** Frase para analytics e relatório: "51 min de palestra (previsto 45 min, 6 min a mais)". */
export function durationSummary(clock: SessionClock, plannedMinutes: number | null): string | null {
  if (!clock.endedAt) return null;
  const seconds = talkSeconds(clock, Date.parse(clock.endedAt));
  if (seconds === null) return null;
  const base = `${formatDuration(seconds)} de palestra`;
  const versus = versusPlanned(seconds, plannedMinutes);
  if (!versus) return base;
  const diff = Math.abs(versus.diffMinutes);
  const detail = diff === 0 ? "no tempo" : `${diff} min ${versus.diffMinutes > 0 ? "a mais" : "a menos"}`;
  return `${base} (previsto ${formatDuration(plannedMinutes! * 60)}, ${detail})`;
}
