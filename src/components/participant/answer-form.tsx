"use client";

import { useEffect, useState } from "react";
import type { AnswerPayload, PublicInteraction } from "@/lib/domain/interactions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

      {interaction.type === "multiple_choice" || interaction.type === "quiz" ? (
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
