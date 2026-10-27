import { useLocale, useTranslations } from "next-intl";
import type { TeamLeaderboardEntry } from "@/lib/domain/team-leaderboard";
import { formatInt } from "@/lib/format";
import { TeamSwatch } from "@/components/participant/team-badge";

/** Ranking por equipes no analytics: média de pontos por pessoa (o total desempata). */
export function TeamRankingList({ entries }: { entries: TeamLeaderboardEntry[] }) {
  const t = useTranslations("analytics.session.teams");
  const tRanking = useTranslations("analytics.session.ranking");
  const locale = useLocale();
  return (
    <ol className="divide-y">
      {entries.map((entry) => (
        <li key={`${entry.rank}-${entry.key}`} className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-2 text-sm">
          <span className="font-semibold tabular-nums">{tRanking("position", { n: entry.rank })}</span>
          <span className="flex min-w-0 items-center gap-2">
            <TeamSwatch color={entry.color} />
            <span className="truncate font-medium">{entry.name}</span>
          </span>
          <span className="text-right font-semibold tabular-nums">
            {t("average", { points: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(entry.average) })}
          </span>
          <span className="col-start-2 text-xs text-muted-foreground">{t("people", { count: entry.people })}</span>
          <span className="text-right text-xs tabular-nums text-muted-foreground">
            {t("total", { points: formatInt(entry.total, locale) })}
          </span>
        </li>
      ))}
    </ol>
  );
}
