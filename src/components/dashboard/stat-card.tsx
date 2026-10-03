import { cn } from "@/lib/utils";

/** Número de resumo com ícone num quadrado de papel colorido. */
export function StatCard({
  label,
  value,
  suffix,
  hint,
  icon,
  paper = "bg-muted",
}: {
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
  icon?: React.ReactNode;
  paper?: string;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-md bg-card p-4 shadow-[0_10px_28px_-18px_color-mix(in_oklch,var(--foreground)_32%,transparent)] dark:border">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon ? (
          <span aria-hidden className={cn("grid size-8 place-items-center rounded-md text-rev-foreground [&_svg]:size-4", paper)}>
            {icon}
          </span>
        ) : null}
        {label}
      </span>
      <span className="font-script text-3xl font-bold tabular-nums">
        {value}
        {suffix ? <span className="text-base font-normal text-muted-foreground">{suffix}</span> : null}
      </span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
