import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadSpeakerHistory } from "@/lib/data/analytics";
import { formatShortDate } from "@/lib/datetime";
import { getSpeakerProfile } from "@/lib/data/profile";
import { formatPercent, formatScore } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { EvolutionChart, type EvolutionPoint, type EvolutionSeries } from "@/components/analytics/evolution-chart";
import type { HistoryRow } from "@/lib/domain/metrics";

export const metadata: Metadata = { title: "Evolução" };

const MAX_SERIES = 4;

/** As dimensões de 1–5 presentes no maior número de sessões (os modelos variam entre sessões). */
function pickSeries(history: HistoryRow[]): EvolutionSeries[] {
  const frequency = new Map<string, { name: string; sessions: number }>();
  for (const h of history) {
    for (const d of h.survey.dimensions) {
      if (d.kind !== "scale") continue;
      const entry = frequency.get(d.dimension) ?? { name: d.label, sessions: 0 };
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
  const [{ history }, { timeZone }] = await Promise.all([loadSpeakerHistory(supabase), getSpeakerProfile()]);

  const withSurvey = history.filter((h) => h.survey.count > 0);
  const series = pickSeries(withSurvey);
  const points: EvolutionPoint[] = withSurvey.map((h) => {
    const point: EvolutionPoint = { label: formatShortDate(h.date, timeZone) };
    for (const s of series) {
      point[s.key] = h.survey.dimensions.find((d) => d.dimension === s.key && d.kind === "scale")?.mean ?? null;
    }
    return point;
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Evolução</h1>
        <p className="text-muted-foreground">Como suas avaliações mudam de uma sessão para a outra.</p>
      </div>

      {history.length === 0 ? (
        <EmptyState title="Nenhuma sessão encerrada" description="Encerre uma sessão para começar a acompanhar sua evolução." />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Dimensões das pesquisas (1–5)</CardTitle>
              <CardDescription>
                As dimensões que mais aparecem nas suas pesquisas. Sessões com poucas respostas oscilam mais: veja o
                número de pesquisas na tabela.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {points.length < 2 || series.length === 0 ? (
                <p className="text-sm text-muted-foreground">São necessárias pelo menos 2 sessões com pesquisas respondidas para mostrar a tendência.</p>
              ) : (
                <EvolutionChart points={points} series={series} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 font-medium">Sessão</th>
                    <th className="py-2 font-medium">Data</th>
                    <th className="py-2 text-right font-medium">Participantes</th>
                    <th className="py-2 text-right font-medium">Participação</th>
                    <th className="py-2 text-right font-medium">Nota geral (0–10)</th>
                    <th className="py-2 text-right font-medium">Média (1–5)</th>
                    <th className="py-2 font-medium pl-4">Ponto mais forte</th>
                    <th className="py-2 text-right font-medium">Pesquisas</th>
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
                      <td className="py-2 text-muted-foreground">{formatShortDate(h.date, timeZone)}</td>
                      <td className="py-2 text-right tabular-nums">{h.participants}</td>
                      <td className="py-2 text-right tabular-nums">{formatPercent(h.participationRate)}</td>
                      <td className="py-2 text-right tabular-nums">{formatScore(h.survey.headline)}</td>
                      <td className="py-2 text-right tabular-nums">{formatScore(h.survey.scaleAverage)}</td>
                      <td className="py-2 pl-4 text-muted-foreground">{h.survey.dimensions[0]?.label ?? "—"}</td>
                      <td className="py-2 text-right tabular-nums">{h.survey.count}</td>
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
