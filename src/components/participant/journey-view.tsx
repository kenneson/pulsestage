"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { submitAnswerAction } from "@/features/participant/actions";
import type { AnswerPayload } from "@/lib/domain/interactions";
import {
  firstUnanswered,
  journeyResponseSchema,
  resumeIndex,
  stepTo,
  unansweredCount,
  type JourneyResponse,
} from "@/lib/domain/participant-journey";
import { showsResultsOnPhone } from "@/lib/domain/participant-answers";
import { fetchJson, usePolling } from "@/lib/realtime/use-polling";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { ChevronLeftIcon, ChevronRightIcon, CircleCheckIcon } from "@/components/icons";
import { AnimatedCheck } from "@/components/motion/animated";
import { SCREEN, SPRING } from "@/components/motion/presets";
import { AnswerForm } from "./answer-form";
import { ContentBody } from "./answers/content-slide";
import { PhoneResults } from "./phone-results";

/** Conferência lenta do roteiro (o palestrante pode acrescentar perguntas durante a sessão). */
const JOURNEY_POLL_MS = 60_000;
const DONE = "__done__";

/**
 * Ritmo próprio: cada pessoa percorre o roteiro inteiro no seu tempo. Progresso "3 de 8", anterior/próxima,
 * cada pergunta respondida uma vez, slides de conteúdo no meio e a tela final "Você terminou".
 */
export function JourneyView({
  sessionId,
  initial,
  resultsRevealed,
}: {
  sessionId: string;
  initial: JourneyResponse | null;
  resultsRevealed: boolean;
}) {
  const t = useTranslations("participant.journey");
  const [journey, setJourney] = useState<JourneyResponse | null>(initial?.status === "live" ? initial : null);
  const [answered, setAnswered] = useState<Set<string>>(() => new Set(initial?.answered ?? []));
  // O passo guarda o item, não o índice: perguntas novas no roteiro não tiram a pessoa do lugar.
  const [currentId, setCurrentId] = useState<string | null>(() => {
    if (initial?.status !== "live") return null;
    const index = resumeIndex(initial.items, new Set(initial.answered));
    return initial.items[index]?.id ?? DONE;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Roteiro lido em rascunho (vazio) não vale: busca de novo assim que a sessão começa.
  const [loadedAt] = useState(() => (initial?.status === "live" ? Date.now() : 0));
  const lastFetchAt = useRef(loadedAt);

  const load = useCallback(async () => {
    if (Date.now() - lastFetchAt.current < JOURNEY_POLL_MS / 2) return;
    lastFetchAt.current = Date.now();
    const data = await fetchJson(`/api/participant/${sessionId}/journey`, journeyResponseSchema.parse);
    if (!data) return;
    setJourney(data);
    setAnswered((prev) => new Set([...prev, ...data.answered]));
    setCurrentId((id) => id ?? data.items[resumeIndex(data.items, new Set(data.answered))]?.id ?? DONE);
  }, [sessionId]);

  usePolling(load, JOURNEY_POLL_MS);

  if (!journey || currentId === null) {
    return <p className="py-16 text-center text-muted-foreground">{t("loading")}</p>;
  }

  const { items } = journey;
  if (items.length === 0) {
    return <p className="py-16 text-center text-muted-foreground">{t("empty")}</p>;
  }

  const found = items.findIndex((item) => item.id === currentId);
  const index = currentId === DONE || found < 0 ? items.length : found;
  const item = items[index] ?? null;
  const go = (next: number) => {
    setError(null);
    setCurrentId(items[stepTo(next, items.length)]?.id ?? DONE);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  async function submit(payload: AnswerPayload) {
    if (!item) return;
    setSubmitting(true);
    setError(null);
    const result = await submitAnswerAction(sessionId, item.id, payload);
    setSubmitting(false);
    if (result.ok || result.code === "duplicate") {
      setAnswered((prev) => new Set(prev).add(item.id));
      // Com o gráfico no celular, a pessoa fica para ver; senão, segue para o próximo.
      if (!showsResultsOnPhone(item, resultsRevealed)) go(index + 1);
      return;
    }
    if (result.code === "no_participant") {
      window.location.reload();
      return;
    }
    setError(result.error);
  }

  let body: React.ReactNode;
  if (!item) {
    const missing = unansweredCount(items, answered);
    const first = firstUnanswered(items, answered);
    body = (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <AnimatedCheck />
        <h2 className="mt-2 text-2xl font-semibold max-md:text-balance">{t("doneTitle")}</h2>
        <p className="text-muted-foreground">{t("doneText")}</p>
        {missing > 0 && first >= 0 ? (
          <div className="mt-4 flex w-full flex-col gap-2">
            <p className="text-sm text-muted-foreground">{t("missing", { count: missing })}</p>
            <Button size="xl" className="w-full" onClick={() => go(first)}>
              {t("answerMissing")}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("doneSurveyLater")}</p>
        )}
        <Button variant="ghost" className="mt-2" onClick={() => go(0)}>
          {t("review")}
        </Button>
      </div>
    );
  } else if (item.type === "content") {
    body = (
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold leading-snug">{item.title}</h2>
        <ContentBody interaction={item} />
      </div>
    );
  } else if (answered.has(item.id)) {
    body = showsResultsOnPhone(item, resultsRevealed) ? (
      <PhoneResults sessionId={sessionId} interaction={item} />
    ) : (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
          <CircleCheckIcon width={28} height={28} />
        </span>
        <h2 className="text-xl font-semibold leading-snug">{item.title}</h2>
        <p className="text-muted-foreground">{t("answeredText")}</p>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-semibold leading-snug">{item.title}</h2>
          {item.description ? <p className="mt-1 text-muted-foreground">{item.description}</p> : null}
        </div>
        <AnswerForm key={item.id} interaction={item} onSubmit={submit} submitting={submitting} selfPaced />
      </div>
    );
  }

  const total = items.length;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-display font-semibold tabular-nums">
            {t("progress", { current: Math.min(index + 1, total), total })}
          </span>
          {item && answered.has(item.id) ? (
            <span className="flex items-center gap-1 text-xs font-medium text-primary">
              <CircleCheckIcon width={14} height={14} /> {t("answered")}
            </span>
          ) : null}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <m.div
            className="h-full rounded-full bg-primary"
            animate={{ width: `${(Math.min(index + 1, total) / total) * 100}%` }}
            transition={SPRING.bar}
          />
        </div>
      </div>

      {error ? <Alert>{error}</Alert> : null}
      <AnimatePresence mode="wait" initial={false}>
        <m.div key={item?.id ?? DONE} {...SCREEN}>
          {body}
        </m.div>
      </AnimatePresence>

      {item ? (
        <nav className="grid grid-cols-2 gap-3" aria-label={t("progress", { current: index + 1, total })}>
          <Button variant="outline" size="lg" disabled={index === 0 || submitting} onClick={() => go(index - 1)}>
            <ChevronLeftIcon /> {t("previous")}
          </Button>
          <Button variant={answered.has(item.id) || item.type === "content" ? "default" : "outline"} size="lg" disabled={submitting} onClick={() => go(index + 1)}>
            {t("next")} <ChevronRightIcon />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
