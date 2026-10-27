"use client";

import { useTranslations } from "next-intl";
import type { InteractionType } from "@/lib/domain/interactions";
import { cn } from "@/lib/utils";
import { TYPE_PAPER } from "@/components/interaction-type-tag";

/** Os 12 tipos em grupos (organização da tela; a ordem dentro do grupo é a de uso mais comum). */
export const TYPE_GROUPS = [
  { id: "opinion", types: ["multiple_choice", "rating", "ranking", "points_100", "matrix_2x2"] },
  { id: "open", types: ["word_cloud", "open_text", "pin_image"] },
  { id: "competition", types: ["quiz", "quiz_text", "guess_number"] },
  { id: "content", types: ["content"] },
] as const satisfies readonly { id: string; types: readonly InteractionType[] }[];

// Tipo novo sem grupo não compila (some da escolha de tipo).
type Ungrouped = Exclude<InteractionType, (typeof TYPE_GROUPS)[number]["types"][number]>;
const everyTypeGrouped: [Ungrouped] extends [never] ? true : false = true;
void everyTypeGrouped;

/**
 * Botões de tipo de pergunta com a descrição visível (title/tooltip não funciona no toque), em grupos.
 * No celular, lista de uma coluna com linhas de toque confortável. Usado no roteiro e no diálogo
 * "Nova pergunta" da sala ao vivo (`className` vai na grade de cada grupo).
 */
export function InteractionTypePicker({
  onPick,
  className,
}: {
  onPick: (type: InteractionType) => void;
  className?: string;
}) {
  const t = useTranslations("domain");
  const tGroups = useTranslations("builder.picker");
  return (
    <div className="flex flex-col gap-4">
      {TYPE_GROUPS.map((group) => (
        <section key={group.id} aria-labelledby={`type-group-${group.id}`} className="flex flex-col gap-2">
          <h3 id={`type-group-${group.id}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {tGroups(`${group.id}.title`)}
            </span>
            <span className="text-xs text-muted-foreground">{tGroups(`${group.id}.hint`)}</span>
          </h3>
          <div className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3", className)}>
            {group.types.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onPick(type)}
                className="flex min-h-11 items-start gap-2.5 rounded-md border border-input bg-background px-3 py-2.5 text-left shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 max-md:min-h-14 max-md:items-center max-md:py-3"
              >
                <span aria-hidden className={cn("mt-1 size-2.5 shrink-0 rounded-sm max-md:mt-0 max-md:size-3", TYPE_PAPER[type])} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium">{t(`interactionTypes.${type}.label`)}</span>
                  <span className="text-xs text-muted-foreground">{t(`interactionTypes.${type}.description`)}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
