"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  READY_VIEW,
  SESSION_STEPS,
  stepHref,
  stepIndex,
  type SessionStep,
  type SessionStepView,
  type StepState,
} from "@/lib/domain/session-steps";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

/**
 * Linha do tempo da montagem da sessão. Celular: "Etapa 2 de 5 · Slides", barra de progresso e círculos
 * numerados tocáveis (a faixa rola se faltar espaço). Computador: círculos ligados por linhas, com rótulo e
 * estado. Sem sessão (Nova sessão), só o primeiro passo fica ativo.
 */
export function SessionStepper({
  sessionId,
  current,
  states,
}: {
  /** null em "Nova sessão": os passos seguintes aparecem desabilitados */
  sessionId: string | null;
  current: SessionStepView;
  states: Record<SessionStep, StepState>;
}) {
  const t = useTranslations("session.steps");
  const list = useRef<HTMLOListElement>(null);
  const currentIndex = stepIndex(current);
  const done = SESSION_STEPS.filter((step) => states[step] === "done").length;

  // No celular, o passo atual fica à vista na faixa (só rola a faixa, nunca a página).
  useEffect(() => {
    const el = list.current;
    const active = el?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!el || !active || el.scrollWidth <= el.clientWidth) return;
    el.scrollTo({ left: Math.max(0, active.offsetLeft - el.clientWidth / 2 + active.offsetWidth / 2) });
  }, [current]);

  const heading =
    current === READY_VIEW
      ? t("readyHeading")
      : t("progress", { number: currentIndex + 1, total: SESSION_STEPS.length, label: t(`${current}.label`) });

  return (
    <nav aria-label={t("aria")} className="flex flex-col gap-3 rounded-xl border bg-card p-4 max-md:-mx-1 max-md:gap-2.5 max-md:p-3 md:px-6 md:py-5">
      <div className="flex flex-col gap-1.5 md:hidden">
        <p className="text-sm font-semibold" aria-live="polite">
          {heading}
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${(Math.min(currentIndex + 1, SESSION_STEPS.length) / SESSION_STEPS.length) * 100}%` }}
          />
        </div>
      </div>
      <p className="sr-only md:hidden">{t("doneCount", { count: done, total: SESSION_STEPS.length })}</p>
      <ol
        ref={list}
        className="relative flex overflow-x-auto overscroll-x-contain [scrollbar-width:none] max-md:-mx-1 max-md:px-1 [&::-webkit-scrollbar]:hidden"
      >
        {SESSION_STEPS.map((step, index) => {
          const state = states[step];
          const isCurrent = step === current;
          const disabled = sessionId === null && index > 0;
          const label = t(`${step}.label`);
          const stateText = t(`state.${state}`);
          const circle = (
            <span
              aria-hidden
              className={cn(
                "relative z-10 grid size-9 shrink-0 place-items-center rounded-full border-2 font-display text-sm font-bold tabular-nums transition-colors",
                isCurrent
                  ? "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15"
                  : state === "done"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground",
              )}
            >
              {state === "done" && !isCurrent ? <CheckIcon width={16} height={16} strokeWidth={3} /> : index + 1}
            </span>
          );
          const text = (
            <span className="flex min-w-0 flex-col items-center text-center">
              <span
                className={cn(
                  "text-xs font-medium leading-tight md:text-sm",
                  isCurrent ? "text-foreground" : "text-muted-foreground",
                  isCurrent && "md:font-semibold",
                )}
              >
                <span className="md:hidden">{t(`${step}.short`)}</span>
                <span className="max-md:hidden">{label}</span>
              </span>
              <span
                className={cn(
                  "hidden text-xs md:block",
                  state === "done" ? "text-primary" : "text-muted-foreground",
                )}
              >
                {stateText}
              </span>
            </span>
          );
          const body = (
            <>
              {circle}
              {text}
            </>
          );
          const itemClass =
            "flex min-h-11 w-full flex-col items-center gap-1.5 rounded-lg px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring md:px-2";
          return (
            <li key={step} className="relative flex min-w-16 flex-1 items-start">
              {/* Linha de ligação até o próximo passo (preenchida quando este está feito). */}
              {index < SESSION_STEPS.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[calc(50%+1.5rem)] right-[calc(-50%+1.5rem)] top-[1.35rem] h-0.5",
                    state === "done" ? "bg-primary/60" : "bg-border",
                  )}
                />
              ) : null}
              {disabled ? (
                <span className={cn(itemClass, "cursor-not-allowed opacity-50")} aria-disabled="true">
                  {body}
                  <span className="sr-only">{`, ${t("needsSession")}`}</span>
                </span>
              ) : sessionId ? (
                <Link
                  href={stepHref(sessionId, step)}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`${index + 1}. ${label} (${stateText})`}
                  className={cn(itemClass, "transition-colors hover:bg-muted/60")}
                 
                >
                  {body}
                </Link>
              ) : (
                <span className={itemClass} aria-current={isCurrent ? "step" : undefined}>
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * "Voltar" e "Próximo" no fim de cada passo. No celular, barra fixa logo acima da barra de abas do painel
 * (a página reserva o espaço com `StepFooterSpacer`); no computador, no fim da etapa.
 */
export function StepFooter({
  back,
  skip,
  children,
}: {
  back?: { href: string; label: string } | null;
  skip?: { href: string; label: string } | null;
  /** ação principal ("Próximo: …", "Concluir", botão de envio do formulário) */
  children: React.ReactNode;
}) {
  const t = useTranslations("session.steps");
  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-4 max-md:fixed max-md:inset-x-0 max-md:bottom-[calc(4rem+env(safe-area-inset-bottom))] max-md:z-30 max-md:grid max-md:grid-cols-[auto_minmax(0,1fr)] max-md:gap-2 max-md:border-t max-md:bg-background/95 max-md:px-4 max-md:py-2 max-md:backdrop-blur print:hidden">
      {back ? (
        <Link
          href={back.href}
         
          className={cn(buttonVariants({ variant: "ghost" }), "max-md:px-3")}
          aria-label={t("backTo", { label: back.label })}
        >
          <ChevronLeftIcon /> {t("back")}
        </Link>
      ) : (
        <span className="max-md:hidden" />
      )}
      <div className="ml-auto flex items-center gap-2 max-md:col-start-2 max-md:ml-0 max-md:grid max-md:auto-cols-fr max-md:grid-flow-col">
        {skip ? (
          <Link href={skip.href} className={cn(buttonVariants({ variant: "outline" }), "max-md:px-3")}>
            {skip.label}
          </Link>
        ) : null}
        {children}
      </div>
    </div>
  );
}

/** Link "Próximo: <passo>" com a seta, no estilo do botão principal. */
export function NextStepLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={cn(buttonVariants(), "max-md:min-w-0 max-md:px-3")}>
      <span className="truncate">{label}</span> <ChevronRightIcon />
    </Link>
  );
}

/** Espaço no fim da página do celular para a barra fixa de "Voltar/Próximo" não cobrir o conteúdo. */
export function StepFooterSpacer() {
  return <div aria-hidden className="h-16 md:hidden" />;
}
