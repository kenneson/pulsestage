import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { loadSpeakerHistory } from "@/lib/data/analytics";
import { getSpeakerProfile } from "@/lib/data/profile";
import { joinUrl } from "@/lib/env";
import { average } from "@/lib/domain/metrics";
import { toSessionStatus } from "@/lib/domain/session";
import { formatInt, formatPercent, formatScore } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { StatCard } from "@/components/dashboard/stat-card";
import { SessionList } from "@/components/sessions/session-list";
import { DuplicateSessionButton, StartSessionButton } from "@/components/sessions/session-controls";
import { QrDownloadButton } from "@/components/sessions/qr-download-button";
import {
  BarChartIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CircleIcon,
  EditIcon,
  PlusIcon,
  PresentationIcon,
  QrCodeIcon,
  StarIcon,
  UsersIcon,
} from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.home");
  return { title: t("metaTitle") };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const [{ sessions, history }, profile, t, tDomain, locale] = await Promise.all([
    loadSpeakerHistory(supabase),
    getSpeakerProfile(),
    getTranslations("dashboard.home"),
    getTranslations("domain"),
    getLocale(),
  ]);
  const tActions = await getTranslations("common.actions");
  const [interactions, customTemplates] = await Promise.all([
    supabase.from("interactions").select("session_id"),
    supabase.from("survey_templates").select("id", { count: "exact", head: true }).eq("owner_id", profile.id),
  ]);

  const questionsBySession = new Map<string, number>();
  for (const row of interactions.data ?? []) {
    questionsBySession.set(row.session_id, (questionsBySession.get(row.session_id) ?? 0) + 1);
  }

  const withSurvey = history.filter((h) => h.survey.count > 0);
  const overall = average(withSurvey.map((h) => h.survey.headline));
  const dimensions = average(withSurvey.map((h) => h.survey.scaleAverage));
  const participation = average(history.map((h) => h.participationRate));

  // Próxima sessão: a que está no ar primeiro, depois o rascunho mais recente.
  const open = sessions.filter((s) => s.status !== "completed");
  const next = open.find((s) => s.status === "live" || s.status === "paused") ?? open[0] ?? null;
  const nextStatus = next ? toSessionStatus(next.status) : null;
  const nextQuestions = next ? (questionsBySession.get(next.id) ?? 0) : 0;

  const steps = [
    { done: sessions.length > 0, label: t("steps.createSession"), href: "/dashboard/sessions/new" },
    { done: questionsBySession.size > 0, label: t("steps.addQuestions"), href: next ? `/dashboard/sessions/${next.id}` : "/dashboard/sessions" },
    { done: sessions.some((s) => s.started_at !== null), label: t("steps.presentLive"), href: "/dashboard/guia#ao-vivo" },
    { done: Boolean(profile.bio || profile.avatarUrl), label: t("steps.completeProfile"), href: "/dashboard/conta#perfil" },
    { done: (customTemplates.count ?? 0) > 0, label: t("steps.createTemplate"), href: "/dashboard/pesquisas/nova" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const firstName = profile.name?.split(/\s+/)[0];

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{firstName ? t("greeting", { name: firstName }) : t("title")}</h1>
          <p className="text-muted-foreground">{t("tagline")}</p>
        </div>
        <Link href="/dashboard/sessions/new" className={buttonVariants()}>
          <PlusIcon /> {t("newSession")}
        </Link>
      </div>

      {next && nextStatus ? (
        <section
          aria-labelledby="next-session"
          className="flex flex-wrap items-center gap-5 rounded-md bg-card p-5 shadow-[0_10px_28px_-18px_color-mix(in_oklch,var(--foreground)_32%,transparent)] dark:border md:p-6"
        >
          <span aria-hidden className="hidden size-20 place-items-center rounded-md border border-dashed text-muted-foreground sm:grid">
            <QrCodeIcon width={36} height={36} />
          </span>
          <div className="flex min-w-0 flex-1 basis-72 flex-col gap-1.5">
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium text-foreground",
                  nextStatus === "live" && "border-transparent bg-primary text-primary-foreground",
                  nextStatus === "paused" && "border-transparent bg-standby text-standby-foreground",
                )}
              >
                {tDomain(`sessionStatus.${nextStatus}`)}
              </span>
              {t.rich("nextMeta", {
                code: next.join_code,
                count: nextQuestions,
                b: (chunks) => <strong className="font-display text-foreground">{chunks}</strong>,
              })}
            </p>
            <h2 id="next-session" className="font-display text-2xl font-bold tracking-tight text-balance break-words">
              {next.title}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <QrDownloadButton joinUrl={joinUrl(next.join_code)} code={next.join_code} />
            <DuplicateSessionButton sessionId={next.id} title={next.title} size="sm" />
            {nextStatus === "draft" ? (
              <>
                <Link href={`/dashboard/sessions/${next.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <EditIcon /> {tActions("edit")}
                </Link>
                <StartSessionButton sessionId={next.id} hasInteractions={nextQuestions > 0} />
              </>
            ) : (
              <Link href={`/dashboard/sessions/${next.id}/live`} className={buttonVariants()}>
                {t("openLive")}
              </Link>
            )}
          </div>
        </section>
      ) : null}

      <section aria-label={t("summary")} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t("stats.sessions")}
          value={formatInt(sessions.length, locale)}
          hint={t("stats.sessionsHint", { count: history.length })}
          icon={<PresentationIcon />}
          paper="bg-rev-blue"
        />
        <StatCard
          label={t("stats.overall")}
          value={formatScore(overall, locale)}
          suffix="/10"
          hint={t("stats.overallHint")}
          icon={<StarIcon />}
          paper="bg-rev-green"
        />
        <StatCard
          label={t("stats.dimensions")}
          value={formatScore(dimensions, locale)}
          suffix="/5"
          hint={t("stats.dimensionsHint")}
          icon={<BarChartIcon />}
          paper="bg-rev-gold"
        />
        <StatCard
          label={t("stats.participation")}
          value={formatPercent(participation)}
          hint={t("stats.participationHint")}
          icon={<UsersIcon />}
          paper="bg-rev-pink"
        />
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <section aria-labelledby="recent" className="flex min-w-0 flex-[2_1_480px] flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 id="recent" className="font-semibold">
              {t("recent")}
            </h2>
            <Link href="/dashboard/sessions" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              {t("seeAll")} <ChevronRightIcon />
            </Link>
          </div>
          {sessions.length === 0 ? (
            <EmptyState
              title={t("emptyTitle")}
              description={t("emptyDescription")}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Link href="/dashboard/sessions/new" className={buttonVariants()}>
                    {t("createSession")}
                  </Link>
                  <Link href="/dashboard/guia" className={buttonVariants({ variant: "outline" })}>
                    {t("seeGuide")}
                  </Link>
                </div>
              }
            />
          ) : (
            <SessionList sessions={sessions.slice(0, 5)} timeZone={profile.timeZone} />
          )}
        </section>

        {doneCount < steps.length ? (
          <section
            aria-labelledby="steps"
            className="flex min-w-0 flex-[1_1_280px] flex-col gap-3.5 rounded-md bg-card p-5 shadow-[0_10px_28px_-18px_color-mix(in_oklch,var(--foreground)_32%,transparent)] dark:border"
          >
            <div className="flex items-baseline justify-between">
              <h2 id="steps" className="font-semibold">
                {t("steps.title")}
              </h2>
              <span className="font-display text-sm font-bold tabular-nums">
                {doneCount}/{steps.length}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full origin-left rounded-full bg-primary" style={{ transform: `scaleX(${doneCount / steps.length})` }} />
            </div>
            <ul className="flex flex-col gap-2.5 text-sm">
              {steps.map((step) => (
                <li key={step.label} className="flex items-center gap-2.5">
                  {step.done ? (
                    <>
                      <CircleCheckIcon className="text-primary" aria-hidden />
                      <span className="text-muted-foreground line-through">{step.label}</span>
                      <span className="sr-only">{t("steps.done")}</span>
                    </>
                  ) : (
                    <>
                      <CircleIcon className="text-muted-foreground" aria-hidden />
                      <Link href={step.href} className="text-primary hover:underline">
                        {step.label}
                      </Link>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
