"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import * as m from "motion/react-m";
import type { AnswerPayload } from "@/lib/domain/interactions";
import { secondsLeft } from "@/lib/domain/participant-answers";
import { cn } from "@/lib/utils";
import { SPRING, STAGGER_S, TAP } from "@/components/motion/presets";

/** Cada componente de resposta informa o rascunho: null = ainda não dá para enviar. */
export type DraftChange = (payload: AnswerPayload | null) => void;

/** Alternativa entrando: uma depois da outra, de baixo para cima. O `scale` (escolhida) responde na hora. */
export function enter(index: number, selected = false) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0, scale: selected ? 1.03 : 1 },
    whileTap: TAP,
    transition: { default: { ...SPRING.soft, delay: index * STAGGER_S }, scale: SPRING.snappy },
  };
}

/**
 * Segundos que faltam no cronômetro da pergunta; null sem cronômetro (ou desligado, como no ritmo próprio
 * e na pré-visualização). Sem horário de abertura, conta a partir de quando a tela abriu.
 */
export function useCountdown(activatedAt: string | null, seconds: number | null, enabled: boolean): number | null {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  const running = enabled && seconds !== null;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);
  if (!running || seconds === null) return null;
  return secondsLeft(activatedAt, seconds, now, startedAt);
}

/** Barra do cronômetro; nos últimos 5 segundos fica vermelha e cada segundo dá um pulso. */
export function AnswerTimer({ remaining, seconds }: { remaining: number; seconds: number }) {
  const t = useTranslations("participant.answer");
  const urgent = remaining <= 5;
  return (
    <div className="flex items-center gap-3" role="timer" aria-label={t("timeLeft", { seconds: remaining })}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width] duration-300", urgent ? "bg-destructive" : "bg-primary")}
          style={{ width: `${(remaining / seconds) * 100}%` }}
        />
      </div>
      <m.span
        key={urgent ? remaining : "steady"}
        aria-hidden
        className={cn("w-10 text-right font-display text-sm font-semibold tabular-nums", urgent && "text-destructive")}
        initial={urgent ? { scale: 1.35 } : false}
        animate={{ scale: 1 }}
        transition={SPRING.snappy}
      >
        {t("secondsLeft", { seconds: remaining })}
      </m.span>
    </div>
  );
}
