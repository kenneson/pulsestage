"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { revealAnswerAction, revealResultsAction } from "@/features/live/actions";
import type { ActionResult } from "@/lib/action-result";
import type { RevealedAnswer } from "@/lib/domain/answer-reveal";
import type { PublicInteraction } from "@/lib/domain/interactions";
import { Button } from "@/components/ui/button";
import { CheckIcon, EyeIcon, LockIcon } from "@/components/icons";

/** Botões no rodapé do card do telão (mesmo tamanho do "Encerrar"). */
export const ROOM_ACTION = "max-md:h-11 max-md:flex-1 max-md:text-sm";

/** Número do gabarito como o celular mostra (casas decimais e unidade da pergunta). */
export function formatAnswerNumber(value: number, settings: Pick<PublicInteraction["settings"], "decimals" | "unit">, locale: string): string {
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: settings.decimals,
    maximumFractionDigits: settings.decimals,
  }).format(value);
  return settings.unit ? `${number} ${settings.unit}` : number;
}

/** Aviso "Oculto no telão": a sala sempre vê os resultados, a plateia ainda não. */
export function HiddenOnScreenNotice() {
  const t = useTranslations("live.reveal");
  return (
    <p className="flex items-start gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
      <LockIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>
        <span className="font-medium text-foreground">{t("hiddenOnScreen")}.</span> {t("hiddenHint")}
      </span>
    </p>
  );
}

/** Gabarito da pergunta no ar, só para o palestrante (quiz de digitar e adivinhe o número). */
export function AnswerKeyLine({ interaction, answer }: { interaction: PublicInteraction; answer: RevealedAnswer | null }) {
  const t = useTranslations("live.reveal");
  const locale = useLocale();
  if (!answer || answer.kind === "option") return null;
  const strong = (chunks: React.ReactNode) => <span className="font-semibold text-foreground">{chunks}</span>;
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground">
      <span className="break-words">
        {answer.kind === "number"
          ? t.rich("answerKey", { answer: formatAnswerNumber(answer.value, interaction.settings, locale), strong })
          : t.rich("acceptedAnswers", { answers: answer.accepted.join(" · "), strong })}
      </span>
      <span className="inline-flex items-center gap-1 text-xs">
        <LockIcon aria-hidden className="size-3" /> {t("onlyYou")}
      </span>
    </p>
  );
}

/**
 * "Revelar resultados" (pergunta com resultados escondidos) e "Revelar resposta" (tipos que pontuam).
 * Revelar a resposta também revela os resultados (no banco). Os dois voltam a esconder.
 */
export function RevealButtons({
  sessionId,
  interaction,
  canRevealAnswer,
  resultsRevealed,
  answerRevealed,
  disabled,
  onChanged,
}: {
  sessionId: string;
  interaction: PublicInteraction;
  canRevealAnswer: boolean;
  resultsRevealed: boolean;
  answerRevealed: boolean;
  disabled?: boolean;
  onChanged?: () => void;
}) {
  const t = useTranslations("live.reveal");
  const [pending, startTransition] = useTransition();

  const run = (task: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await task();
      if (!result.ok) toast.error(result.error);
      else onChanged?.();
    });

  return (
    <>
      {interaction.settings.hideResults ? (
        <Button
          variant={resultsRevealed ? "outline" : "default"}
          size="sm"
          className={ROOM_ACTION}
          aria-pressed={resultsRevealed}
          disabled={disabled || pending}
          onClick={() => run(() => revealResultsAction(sessionId, !resultsRevealed))}
        >
          <EyeIcon aria-hidden /> {resultsRevealed ? t("hideResults") : t("results")}
        </Button>
      ) : null}
      {canRevealAnswer ? (
        <Button
          variant={answerRevealed ? "outline" : interaction.settings.hideResults && !resultsRevealed ? "outline" : "default"}
          size="sm"
          className={ROOM_ACTION}
          aria-pressed={answerRevealed}
          disabled={disabled || pending}
          onClick={() => run(() => revealAnswerAction(sessionId, !answerRevealed))}
        >
          <CheckIcon aria-hidden /> {answerRevealed ? t("hideAnswer") : t("answer")}
        </Button>
      ) : null}
    </>
  );
}
