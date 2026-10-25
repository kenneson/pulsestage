"use client";

import { useOptimistic, useTransition } from "react";
import { useTranslations } from "next-intl";
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

// Rótulos e descrições em session.engagement.<chave>.
const OPTIONS: (keyof EngagementFlags)[] = [
  "qa_enabled",
  "qa_moderated",
  "reactions_enabled",
  "profanity_filter",
  "moderate_open_text",
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
  const t = useTranslations("session.engagement");
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
      {OPTIONS.map((key) => {
        const disabled = key === "qa_moderated" && !flags.qa_enabled;
        return (
          <li key={key}>
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3",
                // compacto (sala ao vivo): no celular, cada linha tem 44px de toque
                compact && "max-md:min-h-11 max-md:items-center",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <input
                type="checkbox"
                checked={flags[key]}
                disabled={disabled}
                onChange={(e) => toggle(key, e.target.checked)}
                className={cn("mt-0.5 size-4 shrink-0 accent-primary max-md:size-5", compact && "max-md:mt-0")}
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{t(`${key}.label`)}</span>
                {compact ? null : <span className="text-xs text-muted-foreground">{t(`${key}.description`)}</span>}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
