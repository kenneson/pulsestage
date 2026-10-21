"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import * as m from "motion/react-m";
import type { CurrentInteractionResponse } from "@/lib/domain/interactions";
import {
  quizResultKind,
  quizResultSchema,
  quizRevealDelayMs,
  type RevealedQuizResult,
} from "@/lib/domain/quiz-result";
import { fetchJson } from "@/lib/realtime/use-polling";
import { cn } from "@/lib/utils";
import { ClockIcon, XIcon } from "@/components/icons";
import { AnimatedNumber } from "@/components/motion/animated";
import { EASE_OUT, SPRING } from "@/components/motion/presets";

/** Tentativas depois do fim do tempo (rede lenta, relógio do celular adiantado). */
const MAX_TRIES = 6;

type TrackedQuiz = { id: string; activatedAt: string | null; timerSeconds: number | null };

/**
 * Acompanha o último quiz que apareceu no celular e busca o resultado quando ele fecha: no fim do tempo
 * (com folga) ou quando sai do ar. O servidor só entrega depois que ninguém mais pode responder.
 * Devolve o resultado enquanto ele vale: até a próxima pergunta entrar.
 */
export function useQuizResult(sessionId: string, current: CurrentInteractionResponse): RevealedQuizResult | null {
  const active = current.status === "live" ? current.interaction : null;
  const [tracked, setTracked] = useState<TrackedQuiz | null>(null);
  const [result, setResult] = useState<{ id: string; data: RevealedQuizResult } | null>(null);

  // Quiz novo no celular: passa a acompanhar (ajuste de estado durante a renderização, sem efeito).
  if (active?.type === "quiz" && tracked?.id !== active.id) {
    setTracked({ id: active.id, activatedAt: active.activatedAt, timerSeconds: active.settings.timerSeconds });
  }

  const stillActive = active?.id === tracked?.id;
  const revealed = result !== null && result.id === tracked?.id;

  useEffect(() => {
    if (!tracked || revealed) return;
    const delay = quizRevealDelayMs({ stillActive, activatedAt: tracked.activatedAt, timerSeconds: tracked.timerSeconds, now: Date.now() });
    // Sem tempo e ainda aberto: espera o palestrante encerrar (o efeito roda de novo quando sair do ar).
    if (delay === null) return;

    let cancelled = false;
    let timer: number | undefined;
    let tries = 0;
    const attempt = async () => {
      const data = await fetchJson(
        `/api/participant/${sessionId}/quiz-result?interaction=${tracked.id}`,
        quizResultSchema.parse,
      );
      if (cancelled) return;
      if (data?.status === "revealed") {
        setResult({ id: tracked.id, data });
        return;
      }
      if (data?.status === "pending" && data.retryInMs === null) return;
      if (++tries < MAX_TRIES) {
        const wait = data?.status === "pending" && data.retryInMs !== null ? Math.min(data.retryInMs, 5000) : 1500;
        timer = window.setTimeout(attempt, wait);
      }
    };
    timer = window.setTimeout(attempt, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sessionId, tracked, stillActive, revealed]);

  // Outra pergunta no ar: o resultado do quiz anterior sai da tela.
  if (!revealed || (active !== null && active.id !== tracked?.id)) return null;
  return result.data;
}

function Badge({ kind }: { kind: ReturnType<typeof quizResultKind> }) {
  if (kind === "correct") {
    return (
      <span className="relative grid size-24 place-items-center">
        {/* Uma onda sai do círculo, uma vez: comemoração sem enfeite. */}
        <m.span
          aria-hidden
          className="absolute inset-0 rounded-full border-4 border-primary"
          initial={{ scale: 1, opacity: 0.7 }}
          animate={{ scale: 1.7, opacity: 0 }}
          transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.15 }}
        />
        <m.span
          className="grid size-24 place-items-center rounded-full bg-primary text-primary-foreground"
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={SPRING.snappy}
        >
          <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
            <m.path
              d="M20 6L9 17l-5-5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.15 }}
            />
          </svg>
        </m.span>
      </span>
    );
  }
  const Icon = kind === "wrong" ? XIcon : ClockIcon;
  return (
    <m.span
      className={cn(
        "grid size-24 place-items-center rounded-full",
        kind === "wrong" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
      )}
      initial={{ scale: 0.3, opacity: 0 }}
      // Errou: o círculo balança como um "não" de cabeça.
      animate={kind === "wrong" ? { scale: 1, opacity: 1, x: [0, -10, 10, -6, 6, 0] } : { scale: 1, opacity: 1 }}
      transition={kind === "wrong" ? { scale: SPRING.snappy, opacity: { duration: 0.2 }, x: { duration: 0.5, delay: 0.2 } } : SPRING.snappy}
    >
      <Icon width={44} height={44} />
    </m.span>
  );
}

/** Tela do resultado no celular: acertou/errou/sem resposta, pontos que contam, resposta certa e posição. */
export function QuizResultScreen({ result }: { result: RevealedQuizResult }) {
  const t = useTranslations("participant.quizResult");
  const locale = useLocale();
  const kind = quizResultKind(result);
  const item = (delay: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { ...SPRING.soft, delay },
  });

  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <Badge kind={kind} />
      <m.h2 className="mt-2 text-3xl font-semibold" {...item(0.1)}>
        {t(`${kind}`)}
      </m.h2>
      {kind === "correct" ? (
        <m.p className="font-display text-5xl font-bold text-primary" {...item(0.2)}>
          <AnimatedNumber value={result.points} from={0} locale={locale} duration={1} render={(points) => t("points", { points })} />
        </m.p>
      ) : null}
      {result.correctLabel ? (
        <m.p className="text-lg text-muted-foreground" {...item(0.2)}>
          {t.rich("correctAnswer", {
            label: result.correctLabel,
            b: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
          })}
        </m.p>
      ) : null}
      {result.standing ? (
        <m.div className="mt-4 flex flex-col gap-1 rounded-2xl border bg-card px-6 py-4" {...item(0.45)}>
          <span className="font-display text-xl font-bold">
            {t("standing", { rank: result.standing.rank, of: result.standing.of })}
          </span>
          <span className="text-sm text-muted-foreground">{t("total", { points: result.standing.points })}</span>
        </m.div>
      ) : null}
    </div>
  );
}
