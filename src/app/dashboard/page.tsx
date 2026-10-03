import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadSpeakerHistory } from "@/lib/data/analytics";
import { average } from "@/lib/domain/metrics";
import { formatPercent, formatScore } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { StatCard } from "@/components/dashboard/stat-card";
import { SessionList } from "@/components/sessions/session-list";
import { PlusIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Visão geral" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { sessions, history } = await loadSpeakerHistory(supabase);

  const withSurvey = history.filter((h) => h.survey.count > 0);
  const overall = average(withSurvey.map((h) => h.survey.headline));
  const dimensions = average(withSurvey.map((h) => h.survey.scaleAverage));
  const participation = average(history.map((h) => h.participationRate));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
          <p className="text-muted-foreground">Criar → apresentar → analisar → melhorar.</p>
        </div>
        <Link href="/dashboard/sessions/new" className={buttonVariants()}>
          <PlusIcon /> Nova sessão
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sessões" value={String(sessions.length)} hint={`${history.length} encerradas`} />
        <StatCard label="Nota geral" value={`${formatScore(overall)} / 10`} hint="Utilidade, satisfação ou recomendação" />
        <StatCard label="Média das dimensões" value={`${formatScore(dimensions)} / 5`} hint="Perguntas de 1 a 5 das pesquisas" />
        <StatCard label="Participação média" value={formatPercent(participation)} hint="Quem respondeu algo ÷ quem entrou" />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Sessões recentes</h2>
          <Link href="/dashboard/sessions" className="text-sm text-primary hover:underline">
            Ver todas
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
          <SessionList sessions={sessions.slice(0, 5)} />
        )}
      </section>
    </div>
  );
}
