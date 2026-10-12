"use client";

import { useEffect, useState } from "react";
import type { AnswerPayload, PublicInteraction } from "@/lib/domain/interactions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CheckIcon } from "@/components/icons";
import { ShapeGlyph, shapeBg } from "@/components/option-shape";
import { optionImageSrc } from "@/lib/option-images/url";

type Props = {
  interaction: PublicInteraction;
  onSubmit: (payload: AnswerPayload) => void;
  submitting?: boolean;
  /** Pré-visualização no builder: nada é enviado. */
  preview?: boolean;
};

function QuizTimer({ activatedAt, seconds }: { activatedAt: string | null; seconds: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  const start = activatedAt ? Date.parse(activatedAt) : now;
  const remaining = Math.max(0, Math.ceil((start + seconds * 1000 - now) / 1000));
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width] duration-300", remaining <= 5 ? "bg-destructive" : "bg-primary")}
          style={{ width: `${(remaining / seconds) * 100}%` }}
        />
      </div>
      <span className="w-10 text-right text-sm font-semibold tabular-nums">{remaining}s</span>
    </div>
  );
}

/**
 * Alternativas em blocos (estilo Kahoot): forma e cor e/ou imagem. Duas colunas no celular.
 * A forma e o texto sempre acompanham a cor; a escolhida ganha contorno e um ✓.
 */
function OptionTiles({
  interaction,
  selected,
  onSelect,
  disabled,
}: {
  interaction: PublicInteraction;
  selected: string | null;
  onSelect: (id: string) => void;
  disabled: boolean;
}) {
  const shapes = interaction.settings.optionStyle === "shapes";
  return (
    <div role="radiogroup" aria-label={interaction.title} className="grid grid-cols-2 gap-3">
      {interaction.options.map((option, index) => {
        const isSelected = selected === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onSelect(option.id)}
            className={cn(
              "relative flex min-h-24 flex-col rounded-xl border-2 text-left text-base font-semibold transition-[transform,box-shadow]",
              shapes ? cn(shapeBg(index), "border-transparent text-white") : "border-border bg-card",
              // Sem esmaecer as outras: o texto branco precisa manter o contraste para trocar de ideia.
              isSelected
                ? "scale-[1.02] ring-4 ring-foreground ring-offset-2 ring-offset-background"
                : !shapes && "hover:border-primary/40",
              !shapes && isSelected && "border-primary",
            )}
          >
            {option.imagePath ? (
              // eslint-disable-next-line @next/next/no-img-element -- imagem pública do Storage
              <img
                src={optionImageSrc(option.imagePath)}
                alt=""
                className="aspect-[4/3] w-full rounded-t-[10px] bg-muted object-cover"
                loading="eager"
              />
            ) : null}
            <span className="flex flex-1 items-center gap-2 px-3 py-3 leading-snug">
              {shapes ? <ShapeGlyph index={index} className="size-6 text-white" /> : null}
              <span className="min-w-0 break-words">{option.label}</span>
            </span>
            {isSelected ? (
              <span className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-foreground text-background shadow">
                <CheckIcon width={16} height={16} />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function AnswerForm({ interaction, onSubmit, submitting = false, preview = false }: Props) {
  const [optionId, setOptionId] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [text, setText] = useState("");
  const { settings } = interaction;
  const disabled = submitting || preview;

  function submit() {
    if (preview) return;
    switch (interaction.type) {
      case "multiple_choice":
      case "quiz":
        if (optionId) onSubmit({ type: interaction.type, optionId });
        return;
      case "rating":
        if (rating !== null) onSubmit({ type: "rating", value: rating });
        return;
      case "word_cloud":
      case "open_text":
        if (text.trim()) onSubmit({ type: interaction.type, text: text.trim() });
        return;
    }
  }

  const ready =
    interaction.type === "multiple_choice" || interaction.type === "quiz"
      ? optionId !== null
      : interaction.type === "rating"
        ? rating !== null
        : text.trim().length > 0;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {interaction.type === "quiz" && settings.timerSeconds ? (
        <QuizTimer activatedAt={preview ? null : interaction.activatedAt} seconds={settings.timerSeconds} />
      ) : null}

      {(interaction.type === "multiple_choice" || interaction.type === "quiz") &&
      (settings.optionStyle === "shapes" || interaction.options.some((o) => o.imagePath)) ? (
        <OptionTiles
          interaction={interaction}
          selected={optionId}
          onSelect={setOptionId}
          disabled={submitting}
        />
      ) : interaction.type === "multiple_choice" || interaction.type === "quiz" ? (
        <div role="radiogroup" aria-label={interaction.title} className="flex flex-col gap-3">
          {interaction.options.map((option, index) => {
            const selected = optionId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={submitting}
                onClick={() => setOptionId(option.id)}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-base font-medium transition-colors",
                  selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                )}
              >
                {interaction.type === "quiz" ? (
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-sm font-semibold">
                    {String.fromCharCode(65 + index)}
                  </span>
                ) : null}
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {interaction.type === "rating" ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label={interaction.title}>
            {Array.from({ length: settings.max - settings.min + 1 }, (_, i) => settings.min + i).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                disabled={submitting}
                onClick={() => setRating(value)}
                className={cn(
                  "grid size-14 place-items-center rounded-xl border-2 text-lg font-semibold transition-colors",
                  rating === value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40",
                )}
              >
                {value}
              </button>
            ))}
          </div>
          {settings.minLabel || settings.maxLabel ? (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{settings.minLabel}</span>
              <span>{settings.maxLabel}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {interaction.type === "word_cloud" ? (
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={settings.maxLength}
          placeholder="Uma palavra ou expressão curta"
          aria-label="Sua resposta"
          disabled={submitting}
          className="h-14 text-lg"
          autoComplete="off"
        />
      ) : null}

      {interaction.type === "open_text" ? (
        <div className="flex flex-col gap-1">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={settings.maxLength}
            placeholder="Escreva sua resposta"
            aria-label="Sua resposta"
            disabled={submitting}
            className="min-h-28 text-base"
          />
          <span className="self-end text-xs text-muted-foreground tabular-nums">
            {text.length}/{settings.maxLength}
          </span>
        </div>
      ) : null}

      <Button type="submit" size="xl" disabled={!ready || disabled} className="w-full">
        {preview ? "Enviar (pré-visualização)" : submitting ? "Enviando…" : "Enviar resposta"}
      </Button>
    </form>
  );
}
