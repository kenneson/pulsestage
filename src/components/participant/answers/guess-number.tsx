"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { PublicInteraction } from "@/lib/domain/interactions";
import { clampGuess, guessMidpoint, guessStep, parseGuessInput } from "@/lib/domain/participant-answers";
import { cn } from "@/lib/utils";
import type { DraftChange } from "./shared";

/**
 * Adivinhe o número: campo grande (aceita vírgula) e controle deslizante entre o mínimo e o máximo, nas casas
 * decimais da pergunta. O envio só libera depois que a pessoa mexe (o meio da faixa não vale como chute).
 */
export function GuessNumberAnswer({
  interaction,
  onChange,
  disabled,
}: {
  interaction: PublicInteraction;
  onChange: DraftChange;
  disabled: boolean;
}) {
  const t = useTranslations("participant.answer");
  const locale = useLocale();
  const { numMin, numMax, decimals, unit } = interaction.settings;
  const range = { numMin, numMax, decimals };
  const rangeId = useId();
  const [text, setText] = useState("");
  const [slider, setSlider] = useState(() => guessMidpoint(range));
  const format = (value: number) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);

  const typed = parseGuessInput(text);
  const outOfRange = typed !== null && (typed < numMin || typed > numMax);

  function fromText(next: string) {
    setText(next);
    const value = parseGuessInput(next);
    if (value === null || value < numMin || value > numMax) return onChange(null);
    const rounded = clampGuess(value, range);
    setSlider(rounded);
    onChange({ type: "guess_number", value: rounded });
  }

  function fromSlider(value: number) {
    const rounded = clampGuess(value, range);
    setSlider(rounded);
    // O campo mostra o número com a vírgula/ponto do idioma da sessão.
    setText(String(rounded).replace(".", decimalSeparator(locale)));
    onChange({ type: "guess_number", value: rounded });
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="sr-only">{t("yourGuess")}</span>
        <span
          className={cn(
            "flex items-baseline gap-2 rounded-xl border-2 bg-card px-4 py-2 transition-colors focus-within:border-primary",
            outOfRange ? "border-destructive" : "border-border",
          )}
        >
          <input
            value={text}
            onChange={(e) => fromText(e.target.value)}
            onBlur={() => {
              if (typed !== null && !outOfRange) setText(String(clampGuess(typed, range)).replace(".", decimalSeparator(locale)));
            }}
            inputMode={numMin < 0 ? "text" : decimals > 0 ? "decimal" : "numeric"}
            enterKeyHint="send"
            autoComplete="off"
            placeholder={format(guessMidpoint(range))}
            disabled={disabled}
            aria-invalid={outOfRange || undefined}
            aria-describedby={rangeId}
            className="h-16 w-full min-w-0 bg-transparent font-display text-5xl font-bold tabular-nums outline-none placeholder:text-muted-foreground/40"
          />
          {unit ? <span className="shrink-0 text-xl font-semibold text-muted-foreground">{unit}</span> : null}
        </span>
      </label>

      <div className="flex flex-col gap-1">
        <input
          type="range"
          min={numMin}
          max={numMax}
          step={guessStep(decimals)}
          value={slider}
          disabled={disabled}
          onChange={(e) => fromSlider(Number(e.target.value))}
          aria-label={t("guessSlider")}
          aria-valuetext={`${format(slider)}${unit ? ` ${unit}` : ""}`}
          className="h-11 w-full cursor-pointer touch-pan-y"
        />
        <div id={rangeId} className="flex justify-between text-sm text-muted-foreground tabular-nums">
          <span>{format(numMin)}</span>
          <span className={cn(outOfRange && "font-medium text-destructive")}>
            {outOfRange ? t("guessOutOfRange", { min: format(numMin), max: format(numMax) }) : null}
          </span>
          <span>{format(numMax)}</span>
        </div>
      </div>
    </div>
  );
}

function decimalSeparator(locale: string): string {
  return new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === "decimal")?.value ?? ".";
}
