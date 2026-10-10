"use client";

import { useEffect, useState } from "react";
import { formatClock, talkSeconds, versusPlanned, type SessionClock } from "@/lib/domain/timing";
import { cn } from "@/lib/utils";
import { ClockIcon } from "@/components/icons";

/**
 * Cronômetro da palestra na sala ao vivo: tempo corrido (sem as pausas) contra a duração prevista.
 * Fica âmbar quando passa do previsto. Só anda com a sessão ao vivo.
 */
export function TalkTimer({
  clock,
  plannedMinutes,
  running,
  paused,
}: {
  clock: SessionClock;
  plannedMinutes: number | null;
  running: boolean;
  paused: boolean;
}) {
  // Calculado só no navegador: o relógio do servidor geraria diferença na hidratação.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = running ? window.setInterval(tick, 1000) : undefined;
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [running, clock]);

  const seconds = now === null ? null : talkSeconds(clock, now);
  if (seconds === null) return null;
  const versus = versusPlanned(seconds, plannedMinutes);

  return (
    <span
      role="timer"
      aria-label={`Tempo de palestra: ${formatClock(seconds)}${plannedMinutes ? ` de ${plannedMinutes} minutos previstos` : ""}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-sm",
        versus?.over ? "border-transparent bg-standby text-standby-foreground" : "text-foreground",
      )}
    >
      <ClockIcon className="size-3.5" />
      <span className="font-script font-bold tabular-nums">{formatClock(seconds)}</span>
      {plannedMinutes ? (
        <span className={cn("tabular-nums", versus?.over ? "opacity-80" : "text-muted-foreground")}>
          / {formatClock(plannedMinutes * 60)}
        </span>
      ) : null}
      {paused ? <span className="text-xs opacity-80">pausado</span> : null}
    </span>
  );
}
