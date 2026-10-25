import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { loadSessionAnalytics } from "@/lib/data/analytics";
import { aiConfigProblem, isAIConfigured } from "@/lib/ai";
import { toPublicInteraction } from "@/lib/domain/interactions";
import {
  computeOverview,
  computePulse,
  confidenceFromSample,
  quizRanking,
  quizStats,
} from "@/lib/domain/metrics";
import { ratingStats, snapshotFromResponses } from "@/lib/domain/results";
import { questionResults, strengthsAndWeaknesses } from "@/lib/domain/survey";
import { sessionClock } from "@/lib/domain/timing";
import { durationSummaryText } from "@/i18n/text";
import { buildTimeline } from "@/lib/domain/timeline";
import { getTimelineEvents } from "@/lib/data/timeline";
import { getSlideUrls } from "@/lib/data/slides";
import { isInteractionType } from "@/lib/domain/interactions";
import { TalkTimeline, type TimelineInteractionMeta } from "@/components/analytics/talk-timeline";
import { formatDateTime } from "@/lib/datetime";
import { getSpeakerProfile } from "@/lib/data/profile";
import { formatInt, formatPercent, formatScore, formatSeconds } from "@/lib/format";
import { isUuid } from "@/lib/action-result";
import { TypeTag } from "@/components/interaction-type-tag";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState } from "@/components/ui/misc";
import { StatCard } from "@/components/dashboard/stat-card";
import { ClipboardIcon, DownloadIcon, FileTextIcon, ListIcon, TableIcon, TrendingUpIcon, UsersIcon } from "@/components/icons";
import { StatusBadge } from "@/components/sessions/status-badge";
import { DuplicateSessionButton } from "@/components/sessions/session-controls";
import { ResultsView } from "@/components/results/results-view";
import { PulseChart } from "@/components/analytics/pulse-chart";
import { OpenTextList } from "@/components/analytics/open-text-list";
import { InsightsPanel, type InsightView } from "@/components/analytics/insights-panel";
import { SurveyQuestionResults, SurveyScorecard } from "@/components/analytics/survey-report";
import { AudienceQuestionsReport, ReactionsReport, type ReactionPeakView } from "@/components/analytics/engagement-report";
import { listSessionQuestions, loadReactions } from "@/lib/data/engagement";
import { reactionPeaks, reactionsPerMinute, tallyReactions } from "@/lib/domain/reactions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("analytics.session");
  return { title: t("metaTitle") };
}

const evidenceSchema = z.array(z.string());

export default async function SessionAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const data = await loadSessionAnalytics(supabase, id);
  if (!data) notFound();
  const aiProblem = (() => {
    try {
      return aiConfigProblem();
    } catch {
      return null;
    }
  })();

  const { session, interactionsWithOptions, participants, responses } = data;
  const [{ timeZone }, t, tAnalytics, tTimeline, tDomain, locale] = await Promise.all([
    getSpeakerProfile(),
    getTranslations("analytics.session"),
    getTranslations("analytics"),
    getTranslations("analytics.timeline"),
    getTranslations("domain"),
    getLocale(),
  ]);
  const pulse = computePulse(data);
  const overview = computeOverview(data, pulse);
  const { survey } = overview;
  const { strengths, weaknesses } = strengthsAndWeaknesses(survey.dimensions);
  const surveyResults = questionResults(data.survey.questions, data.survey.answers);
  const allOptions = interactionsWithOptions.flatMap((i) => i.options);
  const quizIds = new Set(interactionsWithOptions.filter((i) => i.type === "quiz").map((i) => i.id));
  const ranking = quizRanking(
    responses.filter((r) => quizIds.has(r.interaction_id)),
    participants,
    10,
    tDomain("anonymousParticipant"),
  );
  const lowSample = confidenceFromSample(survey.count) === "low";

  const [timelineData, slideUrls, audienceQuestions, reactionRows] = await Promise.all([
    getTimelineEvents(supabase, session, interactionsWithOptions),
    getSlideUrls(supabase, session),
    listSessionQuestions(supabase, id),
    loadReactions(supabase, id),
  ]);
  const timeline = buildTimeline(timelineData.events, session.ended_at ?? new Date().toISOString());
  // Picos de reação com o que estava no telão naquele minuto (pela linha do tempo).
  const reactionPeakViews: ReactionPeakView[] = reactionPeaks(reactionsPerMinute(reactionRows, session.started_at)).map((p) => {
    const at = p.minute * 60 + 30;
    const segment = timeline?.segments.find((s) => s.start <= at && at < s.end);
    const interaction = segment?.interactionId ? interactionsWithOptions.find((i) => i.id === segment.interactionId) : undefined;
    const label =
      segment?.kind === "slide" && segment.slide !== undefined
        ? tTimeline("slideLong", { number: segment.slide + 1 })
        : interaction
          ? interaction.title
          : null;
    return { ...p, label };
  });
  const timelineMeta: Record<string, TimelineInteractionMeta> = Object.fromEntries(
    interactionsWithOptions.map((i, index) => [
      i.id,
      {
        number: index + 1,
        title: i.title,
        typeLabel: isInteractionType(i.type) ? tDomain(`interactionTypes.${i.type}.label`) : t("questionFallback"),
      },
    ]),
  );

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
  const talkTime = durationSummaryText(tDomain, sessionClock(session), session.estimated_duration_minutes);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <StatusBadge status={session.status} />
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{session.title}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDateTime(session.started_at ?? session.scheduled_at, timeZone, locale)}
            {talkTime ? ` · ${talkTime}` : ""}
          </p>
        </div>
        {/* No celular: grade de 2 com botões de 44 px; o menu Exportar abre alinhado à esquerda (fica na 1ª coluna). */}
        <div className="flex flex-wrap gap-2 max-md:grid max-md:w-full max-md:grid-cols-2 max-md:[&>a]:h-11 max-md:[&>button]:h-11">
          <Link href={`/dashboard/sessions/${id}`} className={buttonVariants({ variant: "outline" })}>
            {t("viewInteractions")}
          </Link>
          <DuplicateSessionButton sessionId={id} title={session.title} />
          <details className="relative">
            <summary
              className={buttonVariants({
                variant: "outline",
                className: "cursor-pointer list-none [&::-webkit-details-marker]:hidden max-md:h-11 max-md:w-full",
              })}
            >
              <DownloadIcon /> {t("export")}
            </summary>
            <div className="absolute right-0 z-20 mt-2 flex w-64 flex-col rounded-md border bg-card p-1.5 shadow-lg max-md:right-auto max-md:left-0 max-md:w-[min(16rem,calc(100vw-2rem))] max-md:[&>a]:min-h-11">
              <Link href={`/dashboard/sessions/${id}/relatorio`} className="flex items-center gap-2.5 rounded px-3 py-2.5 text-sm hover:bg-muted">
                <FileTextIcon className="text-muted-foreground" /> {t("exportPdf")}
              </Link>
              <a href={`/dashboard/sessions/${id}/exportar?tipo=interacoes`} download className="flex items-center gap-2.5 rounded px-3 py-2.5 text-sm hover:bg-muted">
                <TableIcon className="text-muted-foreground" /> {t("exportResponses")}
              </a>
              <a href={`/dashboard/sessions/${id}/exportar?tipo=pesquisa`} download className="flex items-center gap-2.5 rounded px-3 py-2.5 text-sm hover:bg-muted">
                <TableIcon className="text-muted-foreground" /> {t("exportSurvey")}
              </a>
            </div>
          </details>
          {session.status === "live" || session.status === "paused" ? (
            <Link href={`/dashboard/sessions/${id}/live`} className={buttonVariants({ className: "max-md:col-span-2" })}>
              {t("liveRoom")}
            </Link>
          ) : null}
        </div>
      </div>

      {session.status !== "completed" ? (
        <Alert tone="info">{t("partial")}</Alert>
      ) : null}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t("stats.participants")}
          value={formatInt(overview.participants, locale)}
          hint={t("stats.responders", { count: overview.uniqueResponders })}
          icon={<UsersIcon />}
          paper="bg-rev-blue"
        />
        <StatCard
          label={t("stats.responses")}
          value={formatInt(overview.totalResponses, locale)}
          hint={t("stats.responseRate", { rate: formatPercent(overview.responseRate) })}
          icon={<ListIcon />}
          paper="bg-rev-yellow"
        />
        <StatCard
          label={t("stats.participation")}
          value={formatPercent(overview.participationRate)}
          hint={t("stats.participationHint")}
          icon={<TrendingUpIcon />}
          paper="bg-rev-green"
        />
        <StatCard
          label={t("stats.surveys")}
          value={formatInt(survey.count, locale)}
          hint={t("stats.surveyRate", { rate: formatPercent(overview.surveyResponseRate) })}
          icon={<ClipboardIcon />}
          paper="bg-rev-gold"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t("scorecard.title")}</CardTitle>
            <CardDescription>
              {data.survey.name ? t("scorecard.namedSurvey", { name: data.survey.name }) : t("scorecard.defaultSurvey")}{" "}
              {t("scorecard.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {survey.count === 0 ? (
              <EmptyState title={t("scorecard.emptyTitle")} description={t("scorecard.emptyDescription")} />
            ) : (
              <>
                <SurveyScorecard
                  dimensions={survey.dimensions}
                  strengths={strengths}
                  weaknesses={weaknesses}
                  participationRate={overview.participationRate}
                />
                {lowSample ? (
                  <p className="text-xs text-muted-foreground">{tAnalytics("lowSample", { count: survey.count })}</p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("pulse.title")}</CardTitle>
            <CardDescription>{t("pulse.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {pulse.length === 0 ? <EmptyState title={t("pulse.empty")} /> : <PulseChart points={pulse} />}
          </CardContent>
        </Card>
      </div>

      {timeline && timeline.span > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("timeline.title")}</CardTitle>
            <CardDescription>{t("timeline.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <TalkTimeline
              timeline={timeline}
              interactions={timelineMeta}
              slideUrls={slideUrls}
              recorded={timelineData.recorded}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("insightsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <InsightsPanel
            sessionId={id}
            insights={insights}
            configured={isAIConfigured()}
            problem={locale === "pt-BR" ? aiProblem : null}
            generatedAt={latest ? formatDateTime(latest.created_at, timeZone, locale) : null}
            meta={latest?.provider ? `${latest.provider}${latest.model ? ` · ${latest.model}` : ""}` : null}
          />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("results.title")}</h2>
        {interactionsWithOptions.length === 0 ? <EmptyState title={t("results.empty")} /> : null}
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
                    <span className="font-display text-sm font-bold text-muted-foreground">#{index + 1}</span>
                    <TypeTag type={pub.type} />
                    <span className="text-xs text-muted-foreground">
                      {tAnalytics("responses", { count: rowResponses.length })}
                      {point?.rate !== null && point?.rate !== undefined
                        ? ` · ${t("results.ofPresent", { rate: formatPercent(point.rate) })}`
                        : ""}
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
                      {t("results.median", {
                        value: formatScore(ratingStats(pub.settings.min, pub.settings.max, snapshot).median, locale),
                      })}
                    </p>
                  ) : null}
                  {pub.type === "quiz"
                    ? (() => {
                        const stats = quizStats(rowResponses);
                        return (
                          <p className="text-sm text-muted-foreground">
                            {t("results.quiz", {
                              rate: formatPercent(stats.correctRate),
                              time: formatSeconds(stats.avgResponseMs, locale),
                            })}
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
            <CardTitle>{t("ranking.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="divide-y">
              {ranking.map((entry, index) => (
                <li key={entry.participantId} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-6 font-semibold tabular-nums">{t("ranking.position", { n: index + 1 })}</span>
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    {entry.avatar ? (
                      <span aria-hidden className="text-base leading-none">
                        {entry.avatar}
                      </span>
                    ) : null}
                    <span className="truncate">{entry.name}</span>
                  </span>
                  <span className="text-muted-foreground">{t("ranking.correct", { count: entry.correct })}</span>
                  <span className="w-20 text-right font-semibold tabular-nums">{t("ranking.points", { points: formatInt(entry.points, locale) })}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      {audienceQuestions.length > 0 || reactionRows.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {audienceQuestions.length > 0 ? <AudienceQuestionsReport questions={audienceQuestions} /> : null}
          {reactionRows.length > 0 ? <ReactionsReport tally={tallyReactions(reactionRows)} peaks={reactionPeakViews} /> : null}
        </div>
      ) : null}

      {surveyResults.length > 0 ? (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">{t("survey.title")}</h2>
            <p className="text-sm text-muted-foreground">
              {data.survey.name ? `${t("survey.template", { name: data.survey.name })} · ` : ""}
              {tAnalytics("responses", { count: survey.count })}
            </p>
          </div>
          <SurveyQuestionResults results={surveyResults} />
        </section>
      ) : null}
    </div>
  );
}
