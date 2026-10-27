"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LayoutGroup } from "motion/react";
import * as m from "motion/react-m";
import { supportsTimer, type AnswerPayload, type PublicInteraction } from "@/lib/domain/interactions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { XIcon } from "@/components/icons";
import { SPRING, TAP } from "@/components/motion/presets";
import { AnswerTimer, enter, useCountdown } from "./answers/shared";
import { ChoiceAnswer } from "./answers/choice";
import { Points100Answer } from "./answers/points-100";
import { MatrixAnswer } from "./answers/matrix-2x2";
import { PinImageAnswer } from "./answers/pin-image";
import { GuessNumberAnswer } from "./answers/guess-number";
import { QuizTextAnswer } from "./answers/quiz-text";
import { ContentBody } from "./answers/content-slide";

/** Colunas da escala no celular: até 6 numa linha; acima disso, duas linhas parelhas (no máximo 6 por linha). */
function ratingColumns(count: number) {
  return count <= 6 ? count : Math.min(6, Math.ceil(count / 2));
}

type Props = {
  interaction: PublicInteraction;
  onSubmit: (payload: AnswerPayload) => void;
  submitting?: boolean;
  /** Pré-visualização no builder: nada é enviado. */
  preview?: boolean;
  /** Ritmo próprio: sem cronômetro (o servidor também não conta o tempo). */
  selfPaced?: boolean;
};

/** Ranking no celular: toca na preferida, depois na seguinte… Toque numa já escolhida para tirá-la. */
function RankingPicker({
  interaction,
  order,
  onChange,
  disabled,
}: {
  interaction: PublicInteraction;
  order: string[];
  onChange: (order: string[]) => void;
  disabled: boolean;
}) {
  const t = useTranslations("participant.answer");
  const byId = new Map(interaction.options.map((o) => [o.id, o]));
  const remaining = interaction.options.filter((o) => !order.includes(o.id));
  // A alternativa tocada "voa" da lista para a sua ordem (e volta, se tirada): mesmo layoutId nas duas listas.
  return (
    <LayoutGroup>
      <div className="flex flex-col gap-4">
        {order.length > 0 ? (
          <div className="flex flex-col gap-2">
            <m.div layout="position" transition={SPRING.soft} className="flex items-center justify-between text-sm">
              <span className="font-medium">{t("yourOrder")}</span>
              {/* Celular: área de toque de 44 px sem mudar a linha (pseudo-elemento invisível). */}
              <button
                type="button"
                className="text-muted-foreground underline max-md:relative max-md:after:absolute max-md:after:-inset-x-3 max-md:after:-inset-y-3"
                disabled={disabled}
                onClick={() => onChange([])}
              >
                {t("restart")}
              </button>
            </m.div>
            <ol className="flex flex-col gap-2">
              {order.map((id, index) => (
                <li key={id}>
                  <m.button
                    layoutId={`rank-${id}`}
                    transition={SPRING.soft}
                    whileTap={TAP}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(order.filter((x) => x !== id))}
                    aria-label={t("rankedItem", { position: index + 1, label: byId.get(id)?.label ?? "" })}
                    className="flex min-h-14 w-full items-center gap-3 rounded-xl border-2 border-primary bg-primary/5 px-4 py-3 text-left text-base font-medium"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
                      {t("position", { position: index + 1 })}
                    </span>
                    <span className="min-w-0 flex-1 break-words">{byId.get(id)?.label}</span>
                    <XIcon className="shrink-0 text-muted-foreground" />
                  </m.button>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {remaining.length > 0 ? (
          <div className="flex flex-col gap-2">
            {/* O texto reaparece no lugar novo depois do voo (deslizando, cruzaria a alternativa em voo). */}
            <m.p
              key={order.length}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.2, delay: 0.25 } }}
              className="text-sm text-muted-foreground"
            >
              {order.length === 0 ? t("rankFirst") : t("rankNext", { position: order.length + 1 })}
            </m.p>
            <ul className="flex flex-col gap-2">
              {remaining.map((option) => (
                <li key={option.id}>
                  <m.button
                    layoutId={`rank-${option.id}`}
                    transition={SPRING.soft}
                    whileTap={TAP}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange([...order, option.id])}
                    className="flex min-h-14 w-full items-center gap-3 rounded-xl border-2 border-border px-4 py-3 text-left text-base font-medium transition-colors hover:border-primary/40"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-dashed text-sm text-muted-foreground">
                      ?
                    </span>
                    <span className="min-w-0 flex-1 break-words">{option.label}</span>
                  </m.button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </LayoutGroup>
  );
}

export function AnswerForm({ interaction, onSubmit, submitting = false, preview = false, selfPaced = false }: Props) {
  const t = useTranslations("participant.answer");
  const tActions = useTranslations("common.actions");
  const [chosen, setChosen] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  const [text, setText] = useState("");
  // Tipos novos: cada componente informa o rascunho pronto para enviar (null = ainda não).
  const [draft, setDraft] = useState<AnswerPayload | null>(null);
  const { settings } = interaction;
  const scaleSize = settings.max - settings.min + 1;
  const longScale = interaction.type === "rating" && scaleSize > 6;

  const timerSeconds = supportsTimer(interaction.type) ? settings.timerSeconds : null;
  const remaining = useCountdown(interaction.activatedAt, timerSeconds, !preview && !selfPaced);
  const timeUp = remaining === 0;
  const locked = submitting || timeUp;
  const disabled = locked || preview;

  if (interaction.type === "content") return <ContentBody interaction={interaction} />;

  function payload(): AnswerPayload | null {
    switch (interaction.type) {
      case "multiple_choice":
        if (chosen.length === 0) return null;
        return settings.maxChoices > 1
          ? { type: "multiple_choice", optionIds: chosen }
          : { type: "multiple_choice", optionId: chosen[0]! };
      case "quiz":
        return chosen[0] ? { type: "quiz", optionId: chosen[0] } : null;
      case "rating":
        return rating !== null ? { type: "rating", value: rating } : null;
      case "word_cloud":
      case "open_text":
        return text.trim() ? { type: interaction.type, text: text.trim() } : null;
      case "ranking":
        return order.length === interaction.options.length ? { type: "ranking", order } : null;
      case "points_100":
      case "matrix_2x2":
      case "pin_image":
      case "guess_number":
      case "quiz_text":
        return draft?.type === interaction.type ? draft : null;
      case "content":
        return null;
    }
  }

  const ready = payload();

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (preview || locked || !ready) return;
        onSubmit(ready);
      }}
    >
      {timerSeconds !== null ? (
        <AnswerTimer remaining={preview || selfPaced ? timerSeconds : (remaining ?? timerSeconds)} seconds={timerSeconds} />
      ) : null}

      {interaction.type === "multiple_choice" || interaction.type === "quiz" ? (
        <ChoiceAnswer
          interaction={interaction}
          selected={chosen}
          onChange={setChosen}
          maxChoices={interaction.type === "multiple_choice" ? settings.maxChoices : 1}
          disabled={locked}
        />
      ) : null}

      {interaction.type === "rating" ? (
        <div className="flex flex-col gap-2">
          {/* Celular: escalas longas (0 a 10) em duas linhas parelhas (6 + 5), sem um número sozinho embaixo. */}
          <div
            className={cn(
              "flex flex-wrap justify-center gap-2",
              longScale && "max-md:mx-auto max-md:w-full max-md:max-w-[calc(var(--cols)_*_3.5rem_+_(var(--cols)_-_1)_*_0.5rem)]",
            )}
            role="radiogroup"
            aria-label={interaction.title}
            style={{ "--cols": ratingColumns(scaleSize) } as React.CSSProperties}
          >
            {Array.from({ length: scaleSize }, (_, i) => settings.min + i).map((value, index) => (
              <m.button
                key={value}
                {...enter(index, rating === value)}
                type="button"
                role="radio"
                aria-checked={rating === value}
                disabled={locked}
                onClick={() => setRating(value)}
                className={cn(
                  "grid size-14 place-items-center rounded-xl border-2 text-lg font-semibold transition-colors",
                  longScale &&
                    "max-md:aspect-square max-md:h-auto max-md:w-[min(3.5rem,calc((100%_-_(var(--cols)_-_1)_*_0.5rem)_/_var(--cols)))]",
                  rating === value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40",
                )}
              >
                {value}
              </m.button>
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

      {interaction.type === "ranking" ? (
        <RankingPicker interaction={interaction} order={order} onChange={setOrder} disabled={locked} />
      ) : null}

      {interaction.type === "word_cloud" ? (
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={settings.maxLength}
          placeholder={t("wordPlaceholder")}
          aria-label={t("yourAnswer")}
          disabled={locked}
          className="h-14 text-lg max-md:h-14"
          autoComplete="off"
        />
      ) : null}

      {interaction.type === "open_text" ? (
        <div className="flex flex-col gap-1">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={settings.maxLength}
            placeholder={t("textPlaceholder")}
            aria-label={t("yourAnswer")}
            disabled={locked}
            className="min-h-28 text-base"
          />
          <span className="self-end text-xs text-muted-foreground tabular-nums">
            {text.length}/{settings.maxLength}
          </span>
        </div>
      ) : null}

      {interaction.type === "points_100" ? <Points100Answer interaction={interaction} onChange={setDraft} disabled={locked} /> : null}
      {interaction.type === "matrix_2x2" ? <MatrixAnswer interaction={interaction} onChange={setDraft} disabled={locked} /> : null}
      {interaction.type === "pin_image" ? <PinImageAnswer interaction={interaction} onChange={setDraft} disabled={locked} /> : null}
      {interaction.type === "guess_number" ? <GuessNumberAnswer interaction={interaction} onChange={setDraft} disabled={locked} /> : null}
      {interaction.type === "quiz_text" ? <QuizTextAnswer interaction={interaction} onChange={setDraft} disabled={locked} /> : null}

      <Button type="submit" size="xl" disabled={!ready || disabled} className="w-full">
        {preview ? t("submitPreview") : timeUp ? t("timeUp") : submitting ? tActions("sending") : t("submit")}
      </Button>
    </form>
  );
}
