"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { countdown } from "@/lib/domain/result-display";
import { formatClock } from "@/lib/domain/timing";
import { cn } from "@/lib/utils";
import { ClockIcon } from "@/components/icons";

/**
 * Contagem regressiva da pergunta no ar (qualquer tipo com tempo limite), a mesma do celular e do telão.
 * Âmbar nos segundos finais; depois, "Tempo esgotado" (o servidor recusa respostas após a folga).
 */
export function QuestionCountdown({ activatedAt, seconds }: { activatedAt: string | null; seconds: number }) {
  const t = useTranslations("live.countdown");
  // Só no navegador: o relógio do servidor geraria diferença na hidratação.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 250);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [activatedAt, seconds]);

  const state = countdown({ activatedAt, seconds, now: now ?? Date.parse(activatedAt ?? "") });
  const time = formatClock(state.remaining);

  return (
    <div className="flex min-w-0 items-center gap-2" role="timer" aria-label={state.ended ? t("timeUp") : t("label", { time })}>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-sm",
          state.ended
            ? "border-transparent bg-muted text-muted-foreground"
            : state.urgent
              ? "border-transparent bg-standby text-standby-foreground"
              : "text-foreground",
        )}
      >
        <ClockIcon className="size-3.5" aria-hidden />
        {state.ended ? (
          <span className="font-medium">{t("timeUp")}</span>
        ) : (
          <span className="font-display font-bold tabular-nums">{time}</span>
        )}
      </span>
      {state.ended ? null : (
        <span aria-hidden className="h-1.5 w-24 overflow-hidden rounded-full bg-muted max-md:flex-1">
          <span
            className={cn("block h-full rounded-full transition-[width] duration-300", state.urgent ? "bg-standby" : "bg-primary")}
            style={{ width: `${Math.round(state.fraction * 100)}%` }}
          />
        </span>
      )}
    </div>
  );
}
