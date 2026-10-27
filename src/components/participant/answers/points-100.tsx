"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import * as m from "motion/react-m";
import { POINTS_BUDGET, type PublicInteraction } from "@/lib/domain/interactions";
import { pointsLeft, pointsPayload, setAllocation, type Allocations } from "@/lib/domain/participant-answers";
import { CheckIcon, MinusIcon, PlusIcon } from "@/components/icons";
import { SPRING } from "@/components/motion/presets";
import { enter, type DraftChange } from "./shared";

/** Passo dos botões − e +; o controle deslizante ajusta de 1 em 1. */
const STEP = 5;

/**
 * 100 pontos: distribuir entre as alternativas com − / + ou arrastando. O saldo fica sempre à vista (preso no
 * topo ao rolar) e nenhuma alternativa passa do que sobra; o envio só libera com os 100 distribuídos.
 */
export function Points100Answer({
  interaction,
  onChange,
  disabled,
}: {
  interaction: PublicInteraction;
  onChange: DraftChange;
  disabled: boolean;
}) {
  const t = useTranslations("participant.answer");
  const [allocations, setAllocations] = useState<Allocations>({});
  const left = pointsLeft(allocations);

  function update(next: Allocations) {
    setAllocations(next);
    const payload = pointsPayload(next);
    onChange(payload ? { type: "points_100", allocations: payload } : null);
  }
  const change = (id: string, value: number) => update(setAllocation(allocations, id, value));

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 -mx-1 flex flex-col gap-2 rounded-xl border bg-background/95 px-4 py-3 backdrop-blur" aria-live="polite">
        <div className="flex min-h-8 items-center justify-between gap-3">
          {left === 0 ? (
            <span className="flex items-center gap-2 text-sm font-medium text-primary">
              <CheckIcon width={18} height={18} /> {t("pointsDone")}
            </span>
          ) : (
            <>
              <span className="text-sm text-muted-foreground">{t("pointsLeftLabel")}</span>
              <span className="font-display text-2xl font-bold tabular-nums">{t("pointsLeft", { left })}</span>
            </>
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <m.div
            className="h-full rounded-full bg-primary"
            animate={{ width: `${POINTS_BUDGET - left}%` }}
            transition={SPRING.bar}
          />
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {interaction.options.map((option, index) => {
          const value = allocations[option.id] ?? 0;
          return (
            <m.li key={option.id} {...enter(index)} whileTap={undefined} className="flex flex-col gap-2 rounded-xl border-2 border-border bg-card px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 break-words text-base font-medium leading-snug">{option.label}</span>
                <span className="shrink-0 font-display text-xl font-bold tabular-nums" aria-hidden>
                  {value}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="grid size-11 shrink-0 place-items-center rounded-lg border bg-background transition-colors hover:bg-accent disabled:opacity-40"
                  disabled={disabled || value === 0}
                  onClick={() => change(option.id, value - STEP)}
                  aria-label={t("pointsLess", { label: option.label })}
                >
                  <MinusIcon />
                </button>
                <input
                  type="range"
                  min={0}
                  max={POINTS_BUDGET}
                  step={1}
                  value={value}
                  disabled={disabled}
                  onChange={(e) => change(option.id, Number(e.target.value))}
                  aria-label={option.label}
                  aria-valuetext={t("pointsValue", { points: value })}
                  className="h-11 min-w-0 flex-1 cursor-pointer touch-pan-y"
                />
                <button
                  type="button"
                  className="grid size-11 shrink-0 place-items-center rounded-lg border bg-background transition-colors hover:bg-accent disabled:opacity-40"
                  disabled={disabled || left === 0}
                  onClick={() => change(option.id, value + STEP)}
                  aria-label={t("pointsMore", { label: option.label })}
                >
                  <PlusIcon />
                </button>
              </div>
            </m.li>
          );
        })}
      </ul>

      {left < POINTS_BUDGET ? (
        <button
          type="button"
          className="self-end text-sm text-muted-foreground underline max-md:relative max-md:after:absolute max-md:after:-inset-x-3 max-md:after:-inset-y-3"
          disabled={disabled}
          onClick={() => update({})}
        >
          {t("restart")}
        </button>
      ) : null}
    </div>
  );
}
