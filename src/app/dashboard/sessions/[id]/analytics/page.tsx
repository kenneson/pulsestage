import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadSessionAnalytics } from "@/lib/data/analytics";
import { isAIConfigured } from "@/lib/ai";
import { INTERACTION_TYPE_META, toPublicInteraction } from "@/lib/domain/interactions";
import {
  computeOverview,
  computePulse,
  confidenceFromSample,
  quizRanking,
  quizStats,
} from "@/lib/domain/metrics";
import { ratingStats, snapshotFromResponses } from "@/lib/domain/results";
import { formatDateTime } from "@/lib/datetime";
import { formatPercent, formatScore, formatSeconds, plural } from "@/lib/format";
import { isUuid } from "@/lib/action-result";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState, Progress } from "@/components/ui/misc";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/sessions/status-badge";
import { ResultsView } from "@/components/results/results-view";
import { PulseChart } from "@/components/analytics/pulse-chart";
import { OpenTextList } from "@/components/analytics/open-text-list";
import { InsightsPanel, type InsightView } from "@/components/analytics/insights-panel";

export const metadata: Metadata = { title: "Analytics da sessão" };

const evidenceSchema = z.array(z.string());

function ScoreRow({ label, value, max }: { label: string; value: number | null; max: number }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-semibold tabular-nums">
          {formatScore(value)} <span className="font-normal text-muted-foreground">/ {max}</span>
        </span>
      </div>
      <Progress value={value === null ? 0 : (value / max) * 100} />
    </div>
  );
}

export default async function SessionAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const data = await loadSessionAnalytics(supabase, id);
  if (!data) notFound();

  const { session, interactionsWithOptions, participants, responses, feedback } = data;
  const pulse = computePulse(data);
  const overview = computeOverview(data, pulse);
  const { scores } = overview;
  const allOptions = interactionsWithOptions.flatMap((i) => i.options);
  const quizIds = new Set(interactionsWithOptions.filter((i) => i.type === "quiz").map((i) => i.id));
  const ranking = quizRanking(responses.filter((r) => quizIds.has(r.interaction_id)), participants);
  const lowSample = confidenceFromSample(scores.count) === "low";

  const insights: InsightView[] = data.latestInsights.map((i) => {
    const evidence = evidenceSchema.safeParse(i.evidence);
    return {
      id: i.id,
      type: i.type,
      title: i.title,
      description: i.description,
      evidence: evidence.success ? evidence.data : [],
      priority: i.priority,
      confidence: i.confidence,
    };
  });
  const latest = data.latestInsights[0];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <StatusBadge status={session.status} />
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{session.title}</h1>
          <p className="text-sm text-muted-foreground">{formatDateTime(session.started_at ?? session.scheduled_at)}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/sessions/${id}`} className={buttonVariants({ variant: "outline" })}>
            Ver interações
          </Link>
          {session.status === "live" || session.status === "paused" ? (
            <Link href={`/dashboard/sessions/${id}/live`} className={buttonVariants()}>
              Sala ao vivo
            </Link>
          ) : null}
        </div>
      </div>

      {session.status !== "completed" ? (
        <Alert tone="info">A sessão ainda não foi encerrada: os números abaixo são parciais.</Alert>
      ) : null}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Participantes" value={String(overview.participants)} hint={`${overview.uniqueResponders} responderam algo`} />
        <StatCard label="Respostas" value={String(overview.totalResponses)} hint={`Taxa de resposta ${formatPercent(overview.responseRate)}`} />
        <StatCard label="Participação" value={formatPercent(overview.participationRate)} hint="Quem respondeu ÷ quem entrou" />
        <StatCard label="Avaliações" value={String(scores.count)} hint={`${formatPercent(overview.feedbackResponseRate)} dos participantes`} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>Scorecard</CardTitle>
            <CardDescription>Médias do feedback pós-evento.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {scores.count === 0 ? (
              <EmptyState title="Sem avaliações ainda" description="O link de avaliação aparece no celular e no projetor ao encerrar a sessão." />
            ) : (
              <>
                <ScoreRow label="Utilidade geral" value={scores.overall} max={10} />
                <ScoreRow label="Clareza" value={scores.clarity} max={5} />
                <ScoreRow label="Engajamento" value={scores.engagement} max={5} />
                <ScoreRow label="Conteúdo" value={scores.content} max={5} />
                <ScoreRow label="Aplicabilidade" value={scores.applicability} max={5} />
                <div className="flex justify-between border-t pt-3 text-sm">
                  <span>Interação (participação)</span>
                  <span className="font-semibold">{formatPercent(overview.participationRate)}</span>
                </div>
                {lowSample ? (
                  <p className="text-xs text-muted-foreground">
                    Amostra pequena ({plural(scores.count, "avaliação", "avaliações")}): interprete com cautela.
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sinal de participação</CardTitle>
            <CardDescription>
              Respostas ÷ participantes presentes em cada interação. Mede participação, não atenção.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pulse.length === 0 ? <EmptyState title="Nenhuma interação foi ativada" /> : <PulseChart points={pulse} />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <InsightsPanel
            sessionId={id}
            insights={insights}
            configured={isAIConfigured()}
            generatedAt={latest ? formatDateTime(latest.created_at) : null}
            meta={latest?.provider ? `${latest.provider}${latest.model ? ` · ${latest.model}` : ""}` : null}
          />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Resultados por interação</h2>
        {interactionsWithOptions.length === 0 ? <EmptyState title="Nenhuma interação nesta sessão" /> : null}
        <div className="grid gap-4 lg:grid-cols-2">
          {interactionsWithOptions.map((row, index) => {
            const pub = toPublicInteraction(row, allOptions);
            if (!pub) return null;
            const rowResponses = responses.filter((r) => r.interaction_id === row.id);
            const snapshot = snapshotFromResponses(rowResponses);
            const point = pulse.find((p) => p.interactionId === row.id);
            return (
              <Card key={row.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">#{index + 1}</span>
                    <Badge variant="secondary">{INTERACTION_TYPE_META[pub.type].label}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {plural(rowResponses.length, "resposta", "respostas")}
                      {point?.rate !== null && point?.rate !== undefined ? ` · ${formatPercent(point.rate)} dos presentes` : ""}
                    </span>
                  </div>
                  <CardTitle className="mt-1">{pub.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {pub.type === "open_text" ? (
                    <OpenTextList items={snapshot.recent.map((e) => e.text)} />
                  ) : (
                    <ResultsView
                      interaction={pub}
                      snapshot={snapshot}
                      correctOptionId={row.options.find((o) => o.is_correct)?.id ?? null}
                    />
                  )}
                  {pub.type === "rating" ? (
                    <p className="text-sm text-muted-foreground">
                      Mediana {formatScore(ratingStats(pub.settings.min, pub.settings.max, snapshot).median)}
                    </p>
                  ) : null}
                  {pub.type === "quiz"
                    ? (() => {
                        const stats = quizStats(rowResponses);
                        return (
                          <p className="text-sm text-muted-foreground">
                            Acertos {formatPercent(stats.correctRate)} · tempo médio {formatSeconds(stats.avgResponseMs)}
                          </p>
                        );
                      })()
                    : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {ranking.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Ranking do quiz</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="divide-y">
              {ranking.map((entry, index) => (
                <li key={entry.participantId} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-6 font-semibold tabular-nums">{index + 1}º</span>
                  <span className="flex-1">{entry.name}</span>
                  <span className="text-muted-foreground">{entry.correct} acertos</span>
                  <span className="w-20 text-right font-semibold tabular-nums">{entry.points} pts</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        {(
          [
            ["O que foi mais valioso", feedback.map((f) => f.most_valuable_part)],
            ["O que poderia melhorar", feedback.map((f) => f.improvement)],
            ["Comentários", feedback.map((f) => f.comment)],
          ] as const
        ).map(([title, values]) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <OpenTextList items={values.filter((v): v is string => Boolean(v && v.trim()))} emptyText="Sem comentários." />
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
