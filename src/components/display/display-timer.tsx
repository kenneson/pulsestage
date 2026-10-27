"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import * as m from "motion/react-m";
import { countdown } from "@/lib/domain/result-display";
import { cn } from "@/lib/utils";
import { SPRING } from "@/components/motion/presets";

// Contagem regressiva do telão para qualquer pergunta com tempo. Anel que esvazia e o número grande no meio;
// nos últimos segundos, âmbar (standby) e o número pulsa a cada segundo. O servidor é quem recusa depois do
// tempo (com folga): aqui é só para a sala ver.

const R = 44;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function DisplayTimer({ activatedAt, seconds }: { activatedAt: string | null; seconds: number }) {
  const t = useTranslations("display.timer");
  // Relógio só no navegador (no servidor, o anel sai cheio e sem número: nada de diferença na hidratação).
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 200);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  const c = now === null ? { remaining: seconds, fraction: 1, urgent: false, ended: false } : countdown({ activatedAt, seconds, now });
  const tone = c.urgent ? "text-standby" : "text-primary";

  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={c.ended ? t("ended") : t("label", { seconds: c.remaining })}
      className="flex shrink-0 flex-col items-center gap-1"
    >
      <div className={cn("relative grid size-32 place-items-center max-md:size-20 md:[@media(max-height:800px)]:size-24", tone)}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={R} fill="none" stroke="currentColor" strokeOpacity={0.18} strokeWidth={8} />
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - c.fraction)}
            className="transition-[stroke-dashoffset] duration-200 ease-linear"
          />
        </svg>
        <m.span
          key={c.urgent ? c.remaining : "steady"}
          className="font-display text-6xl font-bold tabular-nums max-md:text-3xl md:[@media(max-height:800px)]:text-5xl"
          initial={c.urgent && !c.ended ? { scale: 1.3 } : false}
          animate={{ scale: 1 }}
          transition={SPRING.snappy}
          aria-hidden
        >
          {now === null ? "" : c.remaining}
        </m.span>
      </div>
      {c.ended ? <span className="text-xl font-semibold text-standby max-md:text-sm">{t("ended")}</span> : null}
    </div>
  );
}
