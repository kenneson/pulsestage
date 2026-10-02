import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadSpeakerHistory } from "@/lib/data/analytics";
import { formatShortDate } from "@/lib/datetime";
import { formatPercent, formatScore } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { EvolutionChart, type EvolutionPoint } from "@/components/analytics/evolution-chart";

export const metadata: Metadata = { title: "Evolução" };

export default async function EvolutionPage() {
  const supabase = await createClient();
  const { history } = await loadSpeakerHistory(supabase);

  const points: EvolutionPoint[] = history
    .filter((h) => h.scores.count > 0)
    .map((h) => ({
      label: formatShortDate(h.date),
      clarity: h.scores.clarity,
      engagement: h.scores.engagement,
      content: h.scores.content,
      applicability: h.scores.applicability,
    }));

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
              <CardTitle>Dimensões do feedback (1–5)</CardTitle>
              <CardDescription>Sessões com poucas avaliações oscilam mais: veja o número de avaliações na tabela.</CardDescription>
            </CardHeader>
            <CardContent>
              {points.length < 2 ? (
                <p className="text-sm text-muted-foreground">São necessárias pelo menos 2 sessões com avaliações para mostrar a tendência.</p>
              ) : (
                <EvolutionChart points={points} />
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
                    <th className="py-2 text-right font-medium">Utilidade (0–10)</th>
                    <th className="py-2 text-right font-medium">Clareza</th>
                    <th className="py-2 text-right font-medium">Avaliações</th>
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
                      <td className="py-2 text-muted-foreground">{formatShortDate(h.date)}</td>
                      <td className="py-2 text-right tabular-nums">{h.participants}</td>
                      <td className="py-2 text-right tabular-nums">{formatPercent(h.participationRate)}</td>
                      <td className="py-2 text-right tabular-nums">{formatScore(h.scores.overall)}</td>
                      <td className="py-2 text-right tabular-nums">{formatScore(h.scores.clarity)}</td>
                      <td className="py-2 text-right tabular-nums">{h.scores.count}</td>
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
