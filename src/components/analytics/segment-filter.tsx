import Link from "next/link";
import { useTranslations } from "next-intl";
import type { SegmentGroup } from "@/lib/domain/live-room";
import { cn } from "@/lib/utils";

// "Comparar grupos" no analytics: filtro por GET (?grupo=<optionId>), sem JavaScript.
// No celular, as alternativas viram uma faixa que rola de lado (alvos de 44 px).

const chip =
  "inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-sm font-medium whitespace-nowrap max-md:min-h-11";

export function SegmentFilter({
  sessionId,
  groups,
  selected,
  memberCount,
}: {
  sessionId: string;
  groups: SegmentGroup[];
  /** alternativa escolhida (já validada) e a pergunta dela */
  selected: { option: { id: string; label: string }; group: SegmentGroup } | null;
  memberCount: number;
}) {
  const t = useTranslations("analytics.session.segment");
  const href = (optionId: string | null) =>
    `/dashboard/sessions/${sessionId}/analytics${optionId ? `?grupo=${optionId}` : ""}#resultados`;

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-card p-4 max-md:p-3">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold">{t("title")}</h3>
        <p className="text-xs text-muted-foreground">{t("description")}</p>
      </div>
      {groups.map((group, index) => (
        <div key={group.interactionId} className="flex flex-col gap-1.5">
          {groups.length > 1 ? <p className="text-xs font-medium text-muted-foreground">{group.title}</p> : null}
          <nav
            aria-label={group.title}
            className="flex flex-wrap gap-1.5 max-md:-mx-3 max-md:flex-nowrap max-md:overflow-x-auto max-md:px-3 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden"
          >
            {index === 0 ? (
              <Link
                href={href(null)}
                scroll={false}
                aria-current={selected === null ? "page" : undefined}
                className={cn(chip, selected === null ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}
              >
                {t("all")}
              </Link>
            ) : null}
            {group.options.map((option) => {
              const active = selected?.option.id === option.id;
              return (
                <Link
                  key={option.id}
                  href={href(option.id)}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={cn(chip, active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
                >
                  {option.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
      {selected ? (
        <p role="status" className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
          <span>{t("showing", { option: selected.option.label, question: selected.group.title, count: memberCount })}</span>
          <Link href={href(null)} scroll={false} className="font-medium text-primary hover:underline max-md:inline-flex max-md:min-h-11 max-md:items-center">
            {t("clear")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
