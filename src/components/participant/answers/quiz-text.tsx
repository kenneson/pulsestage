"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { PublicInteraction } from "@/lib/domain/interactions";
import { Input } from "@/components/ui/input";
import type { DraftChange } from "./shared";

/**
 * Quiz de digitar: um campo e o envio. Nada diz se acertou antes de a pergunta fechar (o resultado aparece
 * depois, na tela "Acertou!"); maiúsculas, acentos e pequenos erros de digitação não contam contra.
 */
export function QuizTextAnswer({
  interaction,
  onChange,
  disabled,
}: {
  interaction: PublicInteraction;
  onChange: DraftChange;
  disabled: boolean;
}) {
  const t = useTranslations("participant.answer");
  const [text, setText] = useState("");
  return (
    <div className="flex flex-col gap-1">
      <Input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const trimmed = e.target.value.trim();
          onChange(trimmed ? { type: "quiz_text", text: trimmed } : null);
        }}
        maxLength={interaction.settings.maxLength}
        placeholder={t("quizTextPlaceholder")}
        aria-label={t("yourAnswer")}
        disabled={disabled}
        className="h-14 text-lg max-md:h-14"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="send"
      />
      <span className="text-xs text-muted-foreground">{t("quizTextHint")}</span>
    </div>
  );
}
