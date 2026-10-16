"use client";

import { useTranslations } from "next-intl";
import { INTERACTION_TYPES, type InteractionType } from "@/lib/domain/interactions";
import { cn } from "@/lib/utils";
import { TYPE_PAPER } from "@/components/interaction-type-tag";

/**
 * Botões de tipo de pergunta com a descrição visível (title/tooltip não funciona no toque).
 * Usado no roteiro e no diálogo "Nova pergunta" da sala ao vivo.
 */
export function InteractionTypePicker({
  onPick,
  className,
}: {
  onPick: (type: InteractionType) => void;
  className?: string;
}) {
  const t = useTranslations("domain");
  return (
    <div className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {INTERACTION_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onPick(type)}
          className="flex min-h-11 items-start gap-2.5 rounded-md border border-input bg-background px-3 py-2.5 text-left shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span aria-hidden className={cn("mt-1 size-2.5 shrink-0 rounded-sm", TYPE_PAPER[type])} />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium">{t(`interactionTypes.${type}.label`)}</span>
            <span className="text-xs text-muted-foreground">{t(`interactionTypes.${type}.description`)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
