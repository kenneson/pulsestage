import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { loadSpeakerHistory } from "@/lib/data/analytics";
import { formatShortDate } from "@/lib/datetime";
import { getSpeakerProfile } from "@/lib/data/profile";
import { formatInt, formatPercent, formatScore } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { EvolutionChart, type EvolutionPoint, type EvolutionSeries } from "@/components/analytics/evolution-chart";
import type { HistoryRow } from "@/lib/domain/metrics";
import type { DomainT } from "@/i18n/text";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("analytics.evolution");
  return { title: t("metaTitle") };
}

const MAX_SERIES = 4;

/** As dimensões de 1–5 presentes no maior número de sessões (os modelos variam entre sessões). */
function pickSeries(history: HistoryRow[], tDomain: DomainT): EvolutionSeries[] {
  const frequency = new Map<string, { name: string; sessions: number }>();
  for (const h of history) {
    for (const d of h.survey.dimensions) {
      if (d.kind !== "scale") continue;
      const entry = frequency.get(d.dimension) ?? { name: tDomain(`dimensions.${d.dimension}`), sessions: 0 };
      entry.sessions++;
      frequency.set(d.dimension, entry);
    }
  }
  return [...frequency.entries()]
    .sort((a, b) => b[1].sessions - a[1].sessions)
    .slice(0, MAX_SERIES)
    .map(([key, v]) => ({ key, name: v.name }));
}

export default async function EvolutionPage() {
  const supabase = await createClient();
  const [{ history }, { timeZone }, t, tDomain, locale] = await Promise.all([
    loadSpeakerHistory(supabase),
    getSpeakerProfile(),
    getTranslations("analytics.evolution"),
    getTranslations("domain"),
    getLocale(),
  ]);

  const withSurvey = history.filter((h) => h.survey.count > 0);
  const series = pickSeries(withSurvey, tDomain);
  const points: EvolutionPoint[] = withSurvey.map((h) => {
    const point: EvolutionPoint = { label: formatShortDate(h.date, timeZone, locale) };
    for (const s of series) {
      point[s.key] = h.survey.dimensions.find((d) => d.dimension === s.key && d.kind === "scale")?.mean ?? null;
    }
    return point;
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      {history.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Link href="/dashboard/sessions" className={buttonVariants({ variant: "outline" })}>
              {t("seeSessions")}
            </Link>
          }
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("chartTitle")}</CardTitle>
              <CardDescription>{t("chartDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              {points.length < 2 || series.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("notEnough")}</p>
              ) : (
                <EvolutionChart points={points} series={series} />
              )}
            </CardContent>
          </Card>

          {/* Celular: um cartão por sessão no lugar da tabela larga. */}
          <ul className="flex flex-col divide-y rounded-md bg-card shadow-[0_10px_28px_-18px_color-mix(in_oklch,var(--foreground)_32%,transparent)] md:hidden dark:border">
            {[...history].reverse().map((h) => (
              <li key={h.sessionId} className="flex flex-col gap-3 px-4 py-4">
                <div className="flex flex-col gap-0.5">
                  <Link
                    href={`/dashboard/sessions/${h.sessionId}/analytics`}
                    className="font-medium break-words hover:underline"
                  >
                    {h.title}
                  </Link>
                  <span className="text-sm text-muted-foreground">{formatShortDate(h.date, timeZone, locale)}</span>
                </div>
                <dl className="grid grid-cols-3 gap-x-3 gap-y-2.5 text-sm">
                  {(
                    [
                      [t("table.participants"), formatInt(h.participants, locale)],
                      [t("table.participation"), formatPercent(h.participationRate)],
                      [t("table.surveys"), formatInt(h.survey.count, locale)],
                      [t("table.headline"), formatScore(h.survey.headline, locale)],
                      [t("table.scaleAverage"), formatScore(h.survey.scaleAverage, locale)],
                      [
                        t("table.strongest"),
                        h.survey.dimensions[0] ? tDomain(`dimensions.${h.survey.dimensions[0].dimension}`) : "—",
                      ],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="flex min-w-0 flex-col">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="font-medium break-words tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>

          <Card className="max-md:hidden">
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 font-medium">{t("table.session")}</th>
                    <th className="py-2 font-medium">{t("table.date")}</th>
                    <th className="py-2 text-right font-medium">{t("table.participants")}</th>
                    <th className="py-2 text-right font-medium">{t("table.participation")}</th>
                    <th className="py-2 text-right font-medium">{t("table.headline")}</th>
                    <th className="py-2 text-right font-medium">{t("table.scaleAverage")}</th>
                    <th className="py-2 font-medium pl-4">{t("table.strongest")}</th>
                    <th className="py-2 text-right font-medium">{t("table.surveys")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...history].reverse().map((h) => (
                    <tr key={h.sessionId} className="border-b last:border-0">
                      <td className="py-2">
                        <Link href={`/dashboard/sessions/${h.sessionId}/analytics`} className="font-medium hover:underline">
                          {h.title}
                        </Link>
                      </td>
                      <td className="py-2 text-muted-foreground">{formatShortDate(h.date, timeZone, locale)}</td>
                      <td className="py-2 text-right tabular-nums">{formatInt(h.participants, locale)}</td>
                      <td className="py-2 text-right tabular-nums">{formatPercent(h.participationRate)}</td>
                      <td className="py-2 text-right tabular-nums">{formatScore(h.survey.headline, locale)}</td>
                      <td className="py-2 text-right tabular-nums">{formatScore(h.survey.scaleAverage, locale)}</td>
                      <td className="py-2 pl-4 text-muted-foreground">{h.survey.dimensions[0] ? tDomain(`dimensions.${h.survey.dimensions[0].dimension}`) : "—"}</td>
                      <td className="py-2 text-right tabular-nums">{formatInt(h.survey.count, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
