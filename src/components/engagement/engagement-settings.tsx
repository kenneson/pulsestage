"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { updateEngagementAction } from "@/features/engagement/actions";
import { cn } from "@/lib/utils";

export type EngagementFlags = {
  qa_enabled: boolean;
  qa_moderated: boolean;
  reactions_enabled: boolean;
  profanity_filter: boolean;
  moderate_open_text: boolean;
};

const OPTIONS: { key: keyof EngagementFlags; label: string; description: string }[] = [
  {
    key: "qa_enabled",
    label: "Perguntas da plateia",
    description: "Botão “Perguntar ao palestrante” no celular. A plateia curte as perguntas dos outros.",
  },
  {
    key: "qa_moderated",
    label: "Aprovar perguntas antes de aparecerem",
    description: "As perguntas novas ficam aguardando até você aprovar na sala ao vivo.",
  },
  {
    key: "reactions_enabled",
    label: "Reações ao vivo",
    description: "👏 ❤️ 😂 😮 🤔 no celular durante a sessão; os emojis sobem no telão.",
  },
  {
    key: "profanity_filter",
    label: "Filtro de palavrões",
    description: "Nuvem de palavras, respostas abertas e perguntas com palavrões ficam fora do telão. Você vê e pode liberar.",
  },
  {
    key: "moderate_open_text",
    label: "Aprovar respostas abertas antes do telão",
    description: "Cada resposta aberta espera a sua aprovação para aparecer no telão.",
  },
];

/** Opções de participação da sessão. Salvam na hora (também durante a apresentação). */
export function EngagementSettings({
  sessionId,
  initial,
  compact = false,
}: {
  sessionId: string;
  initial: EngagementFlags;
  compact?: boolean;
}) {
  const [flags, setFlag] = useOptimistic(initial, (current, change: Partial<EngagementFlags>) => ({ ...current, ...change }));
  const [, startTransition] = useTransition();

  const toggle = (key: keyof EngagementFlags, value: boolean) =>
    startTransition(async () => {
      setFlag({ [key]: value });
      const result = await updateEngagementAction(sessionId, { [key]: value });
      if (!result.ok) toast.error(result.error);
    });

  return (
    <ul className={cn("flex flex-col", compact ? "gap-2" : "gap-3")}>
      {OPTIONS.map((option) => {
        const disabled = option.key === "qa_moderated" && !flags.qa_enabled;
        return (
          <li key={option.key}>
            <label className={cn("flex cursor-pointer items-start gap-3", disabled && "cursor-not-allowed opacity-50")}>
              <input
                type="checkbox"
                checked={flags[option.key]}
                disabled={disabled}
                onChange={(e) => toggle(option.key, e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{option.label}</span>
                {compact ? null : <span className="text-xs text-muted-foreground">{option.description}</span>}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
