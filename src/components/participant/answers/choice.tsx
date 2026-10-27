"use client";

import { useTranslations } from "next-intl";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import type { PublicInteraction } from "@/lib/domain/interactions";
import { cn } from "@/lib/utils";
import { CheckIcon } from "@/components/icons";
import { ShapeGlyph, shapeBg } from "@/components/option-shape";
import { optionImageSrc } from "@/lib/option-images/url";
import { SPRING } from "@/components/motion/presets";
import { enter } from "./shared";

type Props = {
  interaction: PublicInteraction;
  selected: readonly string[];
  onChange: (selected: string[]) => void;
  /** 1 = uma escolha (rádio); mais = várias, até o limite (caixas de seleção) */
  maxChoices: number;
  disabled: boolean;
};

/** Selo ✓ da alternativa escolhida nos blocos. */
function SelectedMark({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show ? (
        <m.span
          className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-foreground text-background shadow"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0, transition: { duration: 0.12 } }}
          transition={SPRING.snappy}
        >
          <CheckIcon width={16} height={16} />
        </m.span>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * Alternativas de enquete e quiz: em lista (texto), em blocos com forma e cor (estilo Kahoot) ou em grade
 * de imagens. Com `maxChoices` > 1, várias escolhas até o limite; ao chegar nele, as outras esperam.
 */
export function ChoiceAnswer({ interaction, selected, onChange, maxChoices, disabled }: Props) {
  const t = useTranslations("participant.answer");
  const multi = maxChoices > 1;
  const { optionStyle } = interaction.settings;
  const shapes = optionStyle === "shapes";
  const tiles = shapes || optionStyle === "images" || interaction.options.some((o) => o.imagePath);
  const full = multi && selected.length >= maxChoices;

  function toggle(id: string) {
    if (!multi) return onChange([id]);
    if (selected.includes(id)) return onChange(selected.filter((x) => x !== id));
    if (!full) onChange([...selected, id]);
  }

  const role = multi ? "checkbox" : "radio";
  const groupProps = multi
    ? { role: "group" as const, "aria-label": interaction.title }
    : { role: "radiogroup" as const, "aria-label": interaction.title };

  return (
    <div className="flex flex-col gap-3">
      {multi ? (
        <p className="flex items-center justify-between gap-3 text-sm text-muted-foreground" aria-live="polite">
          <span>{t("chooseUpTo", { max: maxChoices })}</span>
          <span className={cn("font-display font-semibold tabular-nums", full && "text-foreground")}>
            {t("chosenCount", { count: selected.length, max: maxChoices })}
          </span>
        </p>
      ) : null}

      {tiles ? (
        <div {...groupProps} className="grid grid-cols-2 gap-3">
          {interaction.options.map((option, index) => {
            const isSelected = selected.includes(option.id);
            const waiting = full && !isSelected;
            return (
              <m.button
                key={option.id}
                type="button"
                role={role}
                aria-checked={isSelected}
                aria-disabled={waiting || undefined}
                disabled={disabled}
                onClick={() => toggle(option.id)}
                {...enter(index, isSelected)}
                className={cn(
                  "relative flex min-h-24 flex-col rounded-xl border-2 text-left text-base font-semibold transition-[box-shadow,opacity]",
                  shapes ? cn(shapeBg(index), "border-transparent text-white") : "border-border bg-card",
                  // Sem esmaecer as outras numa escolha única: o texto branco precisa manter o contraste.
                  isSelected
                    ? "ring-4 ring-foreground ring-offset-2 ring-offset-background"
                    : !shapes && "hover:border-primary/40",
                  !shapes && isSelected && "border-primary",
                  waiting && "opacity-60",
                )}
              >
                {option.imagePath ? (
                  // eslint-disable-next-line @next/next/no-img-element -- imagem pública do Storage
                  <img
                    src={optionImageSrc(option.imagePath)}
                    alt=""
                    className={cn(
                      "w-full rounded-t-[10px] bg-muted object-cover",
                      optionStyle === "images" ? "aspect-square" : "aspect-[4/3]",
                    )}
                    loading="eager"
                  />
                ) : null}
                <span className="flex flex-1 items-center gap-2 px-3 py-3 leading-snug">
                  {shapes ? <ShapeGlyph index={index} className="size-6 text-white" /> : null}
                  <span className="min-w-0 break-words">{option.label}</span>
                </span>
                <SelectedMark show={isSelected} />
              </m.button>
            );
          })}
        </div>
      ) : (
        <div {...groupProps} className="flex flex-col gap-3">
          {interaction.options.map((option, index) => {
            const isSelected = selected.includes(option.id);
            const waiting = full && !isSelected;
            return (
              <m.button
                key={option.id}
                type="button"
                role={role}
                aria-checked={isSelected}
                aria-disabled={waiting || undefined}
                disabled={disabled}
                onClick={() => toggle(option.id)}
                {...enter(index, isSelected)}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-base font-medium transition-[color,background-color,border-color,opacity]",
                  isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                  waiting && "opacity-60",
                )}
              >
                {interaction.type === "quiz" ? (
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-sm font-semibold">
                    {String.fromCharCode(65 + index)}
                  </span>
                ) : multi ? (
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-md border-2 transition-colors",
                      isSelected ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                  >
                    {isSelected ? <CheckIcon width={14} height={14} /> : null}
                  </span>
                ) : null}
                <span className="min-w-0 break-words">{option.label}</span>
              </m.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
