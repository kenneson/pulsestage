import { useTranslations } from "next-intl";
import type { InteractionType } from "@/lib/domain/interactions";
import { cn } from "@/lib/utils";

// Papel de revisão do roteiro: cada tipo de interação tem a mesma cor em todo o produto.
export const TYPE_PAPER: Record<InteractionType, string> = {
  multiple_choice: "bg-rev-blue",
  rating: "bg-rev-pink",
  word_cloud: "bg-rev-yellow",
  open_text: "bg-rev-green",
  quiz: "bg-rev-gold",
  ranking: "bg-rev-violet",
  points_100: "bg-rev-orange",
  matrix_2x2: "bg-rev-teal",
  pin_image: "bg-rev-lime",
  guess_number: "bg-rev-magenta",
  quiz_text: "bg-rev-coral",
  // Slide de conteúdo não é pergunta: papel neutro.
  content: "bg-rev-slate",
};

// Sem "use client": também roda em Server Components (análise), com useTranslations síncrono.
export function TypeTag({ type, className }: { type: InteractionType; className?: string }) {
  const t = useTranslations("domain");
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-sm px-2 py-0.5 font-display text-xs font-bold uppercase tracking-wider text-rev-foreground",
        TYPE_PAPER[type],
        className,
      )}
    >
      {t(`interactionTypes.${type}.label`)}
    </span>
  );
}
