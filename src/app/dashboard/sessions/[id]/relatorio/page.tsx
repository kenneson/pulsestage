import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadSessionAnalytics } from "@/lib/data/analytics";
import { getSpeakerProfile } from "@/lib/data/profile";
import { computeOverview, computePulse, confidenceFromSample } from "@/lib/domain/metrics";
import { questionResults, strengthsAndWeaknesses, type DimensionScore } from "@/lib/domain/survey";
import { formatDateTime } from "@/lib/datetime";
import { formatPercent, formatScore, plural } from "@/lib/format";
import { isUuid } from "@/lib/action-result";
import { buttonVariants } from "@/components/ui/button";
import { PrintButton } from "@/components/analytics/print-button";
import { ChevronLeftIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Relatório da sessão" };

function Score({ score }: { score: DimensionScore }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span>{score.label}</span>
      <strong className="font-script tabular-nums">
        {formatScore(score.mean)}
        <span className="font-normal text-muted-foreground">/{score.max}</span>
      </strong>
    </div>
  );
}

export default async function SessionReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const [data, profile] = await Promise.all([loadSessionAnalytics(supabase, id), getSpeakerProfile()]);
  if (!data) notFound();

  const pulse = computePulse(data);
  const overview = computeOverview(data, pulse);
  const { survey } = overview;
  const { strengths, weaknesses } = strengthsAndWeaknesses(survey.dimensions);
  // Comentários iguais viram um item com a contagem, do mais citado ao menos citado.
  const commentCounts = new Map<string, number>();
  for (const text of questionResults(data.survey.questions, data.survey.answers).flatMap((r) => (r.kind === "text" ? r.texts : []))) {
    commentCounts.set(text, (commentCounts.get(text) ?? 0) + 1);
  }
  const comments = [...commentCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const summary = data.latestInsights.find((i) => i.type === "summary");
  const recommendations = data.latestInsights.filter((i) => i.type === "recommendation").slice(0, 3);
  const lowSample = confidenceFromSample(survey.count) === "low";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/dashboard/sessions/${id}/analytics`} className={buttonVariants({ variant: "ghost" })}>
          <ChevronLeftIcon /> Voltar ao analytics
        </Link>
        <div className="flex items-center gap-3">
          <p className="hidden text-sm text-muted-foreground sm:block">Na janela de impressão, escolha “Salvar como PDF”.</p>
          <PrintButton />
        </div>
      </div>

      <article className="mx-auto flex w-full max-w-[210mm] flex-col gap-7 rounded-md bg-card p-8 text-sm text-card-foreground shadow-[0_10px_28px_-18px_color-mix(in_oklch,var(--foreground)_32%,transparent)] dark:border sm:p-12 print:max-w-none print:rounded-none print:border-0! print:p-0 print:shadow-none">
        <header className="flex flex-col gap-2 border-b-2 border-foreground pb-4">
          <p className="flex items-center gap-2 font-semibold">
            <span aria-hidden className="grid size-6 place-items-center rounded bg-primary text-primary-foreground">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M3 12h4l2-5 4 10 2-5h6" />
              </svg>
            </span>
            PulseStage · Relatório da sessão
          </p>
          <h1 className="font-script text-3xl font-bold leading-tight tracking-tight">{data.session.title}</h1>
          <p className="text-muted-foreground">
            {profile.name ?? profile.email} · {formatDateTime(data.session.started_at ?? data.session.scheduled_at, profile.timeZone)}
            {data.survey.name ? ` · pesquisa “${data.survey.name}”` : ""}
          </p>
          {profile.bio ? <p className="text-muted-foreground">{profile.bio}</p> : null}
        </header>

        <section aria-label="Números" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Participantes", String(overview.participants)],
            ["Respostas ao vivo", String(overview.totalResponses)],
            ["Participação", formatPercent(overview.participationRate)],
            ["Pesquisas respondidas", String(survey.count)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border p-3">
              <p className="text-muted-foreground">{label}</p>
              <p className="font-script text-2xl font-bold tabular-nums">{value}</p>
            </div>
          ))}
        </section>

        {strengths.length > 0 ? (
          <section aria-label="Pontos fortes e para melhorar" className="grid gap-4 break-inside-avoid sm:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-md bg-primary/10 p-4">
              <h2 className="font-semibold">Pontos mais fortes</h2>
              {strengths.map((s) => (
                <Score key={`${s.dimension}-${s.kind}`} score={s} />
              ))}
            </div>
            <div className="flex flex-col gap-2 rounded-md bg-standby/20 p-4">
              <h2 className="font-semibold">Pontos para melhorar</h2>
              {weaknesses.map((s) => (
                <Score key={`${s.dimension}-${s.kind}`} score={s} />
              ))}
            </div>
          </section>
        ) : null}

        {survey.dimensions.length > 0 ? (
          <section aria-labelledby="dims" className="flex flex-col gap-2 break-inside-avoid">
            <h2 id="dims" className="font-semibold">
              Avaliação do público
            </h2>
            <div className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
              {survey.dimensions.map((d) => (
                <Score key={`${d.dimension}-${d.kind}`} score={d} />
              ))}
            </div>
            {lowSample ? (
              <p className="text-xs text-muted-foreground">
                Amostra pequena ({plural(survey.count, "pesquisa", "pesquisas")}): interprete com cautela.
              </p>
            ) : null}
          </section>
        ) : null}

        {pulse.length > 0 ? (
          <section aria-labelledby="pulse" className="flex flex-col gap-3 break-inside-avoid">
            <h2 id="pulse" className="font-semibold">
              Participação em cada pergunta
            </h2>
            <ol className="flex flex-col gap-2">
              {pulse.map((p, index) => (
                <li key={p.interactionId} className="grid grid-cols-[1.5rem_minmax(0,1fr)_3rem] items-center gap-3">
                  <span className="font-script font-bold tabular-nums">{index + 1}</span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate">{p.title}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-muted print:bg-muted">
                      <span
                        className="block h-full origin-left rounded-full bg-primary"
                        style={{ transform: `scaleX(${p.rate ?? 0})` }}
                      />
                    </span>
                  </span>
                  <span className="text-right font-script font-bold tabular-nums">{formatPercent(p.rate)}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {summary || recommendations.length > 0 ? (
          <section aria-labelledby="ai" className="flex flex-col gap-2 break-inside-avoid">
            <h2 id="ai" className="font-semibold">
              Análise da IA
            </h2>
            {summary ? <p className="leading-relaxed">{summary.description}</p> : null}
            {recommendations.length > 0 ? (
              <ul className="ml-5 flex list-disc flex-col gap-1 leading-relaxed">
                {recommendations.map((r) => (
                  <li key={r.id}>
                    <strong>{r.title}:</strong> {r.description}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {comments.length > 0 ? (
          <section aria-labelledby="comments" className="flex flex-col gap-2 break-inside-avoid">
            <h2 id="comments" className="font-semibold">
              O que a plateia disse
            </h2>
            <ul className="ml-5 flex list-disc flex-col gap-1 leading-relaxed">
              {comments.map(([text, count]) => (
                <li key={text}>
                  “{text}”{count > 1 ? <span className="text-muted-foreground"> · {count} pessoas</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className="mt-auto flex flex-wrap justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
          <span>Participação mede quem respondeu, não atenção.</span>
          <span>Gerado em {formatDateTime(new Date().toISOString(), profile.timeZone)}</span>
        </footer>
      </article>
    </div>
  );
}
