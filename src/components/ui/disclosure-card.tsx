import { cn } from "@/lib/utils";
import { ChevronRightIcon } from "@/components/icons";

/**
 * Cartão recolhível (<details> nativo): título, uma linha com o estado atual ("o que está ligado") e o
 * conteúdo só quando aberto. Para opções que se ajustam uma vez e quase nunca mais.
 */
export function DisclosureCard({
  title,
  summary,
  defaultOpen = false,
  className,
  id,
  children,
}: {
  id?: string;
  title: string;
  /** estado atual em uma linha, visível com o cartão fechado */
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <details
      id={id}
      open={defaultOpen || undefined}
      className={cn(
        "group rounded-md bg-card text-card-foreground shadow-[0_10px_28px_-18px_color-mix(in_oklch,var(--foreground)_32%,transparent)] dark:border",
        className,
      )}
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-5 py-4 max-md:min-h-14 max-md:px-4 [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon aria-hidden className="shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-semibold leading-tight">{title}</span>
          {summary ? <span className="truncate text-sm text-muted-foreground group-open:hidden">{summary}</span> : null}
        </span>
      </summary>
      <div className="border-t px-5 py-5 max-md:px-4">{children}</div>
    </details>
  );
}
