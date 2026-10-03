import type { DimensionScore, QuestionResult } from "@/lib/domain/survey";
import { QUESTION_KIND_META, DIMENSION_LABEL } from "@/lib/domain/survey";
import { formatPercent, formatScore, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { OpenTextList } from "@/components/analytics/open-text-list";

function DimensionRow({ score }: { score: DimensionScore }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex justify-between gap-3 text-sm">
        <span>{score.label}</span>
        <span className="font-semibold tabular-nums">
          {formatScore(score.mean)} <span className="font-normal text-muted-foreground">/ {score.max}</span>
        </span>
      </div>
      <Progress value={score.normalized * 100} />
    </div>
  );
}

function RankList({ title, items, tone }: { title: string; items: DimensionScore[]; tone: "strong" | "weak" }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold">{title}</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((s) => (
          <li key={`${s.dimension}-${s.kind}`} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn("size-2 shrink-0 rounded-full", tone === "strong" ? "bg-primary" : "bg-standby")}
              />
              {s.label}
            </span>
            <span className="font-script font-bold tabular-nums">
              {formatScore(s.mean)}
              <span className="font-normal text-muted-foreground">/{s.max}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Pontos fortes/fracos + todas as dimensões da pesquisa pós-evento. */
export function SurveyScorecard({
  dimensions,
  strengths,
  weaknesses,
  participationRate,
}: {
  dimensions: DimensionScore[];
  strengths: DimensionScore[];
  weaknesses: DimensionScore[];
  participationRate: number | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      {strengths.length > 0 ? (
        <div className="grid gap-4 rounded-md bg-muted/60 p-4 sm:grid-cols-2">
          <RankList title="Pontos mais fortes" items={strengths} tone="strong" />
          <RankList title="Pontos para melhorar" items={weaknesses} tone="weak" />
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Comparação entre as dimensões desta sessão, na posição relativa de cada escala.
          </p>
        </div>
      ) : null}
      {dimensions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Este modelo não tem perguntas de nota marcadas com uma dimensão. Os resultados de cada pergunta estão abaixo.
        </p>
      ) : (
        dimensions.map((d) => <DimensionRow key={`${d.dimension}-${d.kind}`} score={d} />)
      )}
      <div className="flex justify-between border-t pt-3 text-sm">
        <span>Interação (participação nas perguntas ao vivo)</span>
        <span className="font-semibold">{formatPercent(participationRate)}</span>
      </div>
    </div>
  );
}

function Bars({ rows }: { rows: { key: string; label: string; count: number; pct: number }[] }) {
  const max = Math.max(0, ...rows.map((r) => r.count));
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(2rem,auto)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate">{r.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-muted">
            <span
              className={cn("block h-full origin-left rounded-full", r.count === max && max > 0 ? "bg-foreground" : "bg-foreground/35")}
              style={{ transform: `scaleX(${r.pct})` }}
            />
          </span>
          <span className="w-16 text-right tabular-nums text-muted-foreground">
            {formatPercent(r.pct)} <span className="text-xs">({r.count})</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Resultado de cada pergunta da pesquisa. */
export function SurveyQuestionResults({ results }: { results: QuestionResult[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {results.map((r, index) => (
        <Card key={r.question.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-script text-sm font-bold">#{index + 1}</span>
              <span>{QUESTION_KIND_META[r.kind].label}</span>
              {r.question.dimension ? <span>· {DIMENSION_LABEL[r.question.dimension]}</span> : null}
              <span>· {plural(r.count, "resposta", "respostas")}</span>
            </div>
            <CardTitle className="mt-1 text-base">{r.question.label}</CardTitle>
            {r.kind === "scale" || r.kind === "nps" ? (
              <CardDescription>
                Média <strong className="text-foreground">{formatScore(r.mean)}</strong> de {r.kind === "scale" ? 5 : 10}
                {r.kind === "nps" && r.nps !== null ? (
                  <>
                    {" "}
                    · NPS <strong className="text-foreground">{r.nps}</strong>
                  </>
                ) : null}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>
            {r.kind === "text" ? (
              <OpenTextList items={r.texts} emptyText="Sem respostas." />
            ) : r.kind === "choice" ? (
              <Bars rows={r.distribution.map((d, i) => ({ key: String(i), label: d.label, count: d.count, pct: d.pct }))} />
            ) : (
              <Bars rows={r.distribution.map((d) => ({ key: String(d.value), label: String(d.value), count: d.count, pct: d.pct }))} />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
