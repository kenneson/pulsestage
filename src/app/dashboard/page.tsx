import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadSpeakerHistory } from "@/lib/data/analytics";
import { getSpeakerProfile } from "@/lib/data/profile";
import { joinUrl } from "@/lib/env";
import { average } from "@/lib/domain/metrics";
import { STATUS_LABEL, toSessionStatus } from "@/lib/domain/session";
import { formatPercent, formatScore, plural } from "@/lib/format";
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

export const metadata: Metadata = { title: "Visão geral" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const [{ sessions, history }, profile] = await Promise.all([loadSpeakerHistory(supabase), getSpeakerProfile()]);
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
    { done: sessions.length > 0, label: "Criar a primeira sessão", href: "/dashboard/sessions/new" },
    { done: questionsBySession.size > 0, label: "Adicionar perguntas", href: next ? `/dashboard/sessions/${next.id}` : "/dashboard/sessions" },
    { done: sessions.some((s) => s.started_at !== null), label: "Apresentar ao vivo", href: "/dashboard/guia#ao-vivo" },
    { done: Boolean(profile.bio || profile.avatarUrl), label: "Completar o perfil", href: "/dashboard/conta#perfil" },
    { done: (customTemplates.count ?? 0) > 0, label: "Criar um modelo de pesquisa", href: "/dashboard/pesquisas/nova" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const firstName = profile.name?.split(/\s+/)[0];

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{firstName ? `Olá, ${firstName}` : "Visão geral"}</h1>
          <p className="text-muted-foreground">Criar, apresentar, analisar, melhorar.</p>
        </div>
        <Link href="/dashboard/sessions/new" className={buttonVariants()}>
          <PlusIcon /> Nova sessão
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
                {STATUS_LABEL[nextStatus]}
              </span>
              código <strong className="font-script text-foreground">{next.join_code}</strong> ·{" "}
              {plural(nextQuestions, "pergunta", "perguntas")}
            </p>
            <h2 id="next-session" className="font-script text-2xl font-bold tracking-tight text-balance break-words">
              {next.title}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <QrDownloadButton joinUrl={joinUrl(next.join_code)} code={next.join_code} />
            <DuplicateSessionButton sessionId={next.id} size="sm" />
            {nextStatus === "draft" ? (
              <>
                <Link href={`/dashboard/sessions/${next.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <EditIcon /> Editar
                </Link>
                <StartSessionButton sessionId={next.id} hasInteractions={nextQuestions > 0} />
              </>
            ) : (
              <Link href={`/dashboard/sessions/${next.id}/live`} className={buttonVariants()}>
                Abrir sala ao vivo
              </Link>
            )}
          </div>
        </section>
      ) : null}

      <section aria-label="Resumo" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Sessões"
          value={String(sessions.length)}
          hint={`${history.length} encerradas`}
          icon={<PresentationIcon />}
          paper="bg-rev-blue"
        />
        <StatCard
          label="Nota geral"
          value={formatScore(overall)}
          suffix="/10"
          hint="Utilidade, satisfação ou recomendação"
          icon={<StarIcon />}
          paper="bg-rev-green"
        />
        <StatCard
          label="Média das dimensões"
          value={formatScore(dimensions)}
          suffix="/5"
          hint="Perguntas de 1 a 5 das pesquisas"
          icon={<BarChartIcon />}
          paper="bg-rev-gold"
        />
        <StatCard
          label="Participação média"
          value={formatPercent(participation)}
          hint="Quem respondeu algo ÷ quem entrou"
          icon={<UsersIcon />}
          paper="bg-rev-pink"
        />
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <section aria-labelledby="recent" className="flex min-w-0 flex-[2_1_480px] flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 id="recent" className="font-semibold">
              Sessões recentes
            </h2>
            <Link href="/dashboard/sessions" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              Ver todas <ChevronRightIcon />
            </Link>
          </div>
          {sessions.length === 0 ? (
            <EmptyState
              title="Nenhuma sessão ainda"
              description="Crie sua primeira sessão, adicione interações e compartilhe o código com a audiência."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Link href="/dashboard/sessions/new" className={buttonVariants()}>
                    Criar sessão
                  </Link>
                  <Link href="/dashboard/guia" className={buttonVariants({ variant: "outline" })}>
                    Ver o guia
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
                Primeiros passos
              </h2>
              <span className="font-script text-sm font-bold tabular-nums">
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
                      <span className="sr-only">(feito)</span>
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
