import { cn } from "@/lib/utils";
import { teamColor, type PublicTeam } from "@/lib/domain/participant-answers";

// Cor da equipe = --shape-N (1–8). Classes por extenso para o Tailwind encontrá-las.
const SWATCH = [
  "bg-shape-1",
  "bg-shape-2",
  "bg-shape-3",
  "bg-shape-4",
  "bg-shape-5",
  "bg-shape-6",
  "bg-shape-7",
  "bg-shape-8",
] as const;

/** Bolinha da cor da equipe (decorativa: o nome sempre vem ao lado). */
export function TeamSwatch({ color, className }: { color: number; className?: string }) {
  return <span aria-hidden className={cn("size-3.5 shrink-0 rounded-full", SWATCH[teamColor(color) - 1], className)} />;
}

/** Equipe no cabeçalho do celular. */
export function TeamBadge({ team, label, className }: { team: PublicTeam; label: string; className?: string }) {
  return (
    <span
      className={cn("inline-flex max-w-40 shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium text-foreground", className)}
      title={label}
    >
      <TeamSwatch color={team.color} className="size-2.5" />
      <span className="truncate">{team.name}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
