import type { SpeakerQuestion } from "@/lib/data/engagement";
import { REACTIONS, type ReactionTally } from "@/lib/domain/reactions";
import { QUESTION_STATUS_LABEL } from "@/lib/domain/questions";
import { formatInt, plural } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Perguntas da plateia depois da sessão: as mais curtidas primeiro (as ocultas só contam). */
export function AudienceQuestionsReport({ questions }: { questions: SpeakerQuestion[] }) {
  const shown = questions.filter((q) => q.status !== "hidden").sort((a, b) => b.upvotes - a.upvotes);
  const hidden = questions.length - shown.length;
  const answered = questions.filter((q) => q.status === "answered").length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Perguntas da plateia</CardTitle>
        <CardDescription>
          {plural(questions.length, "pergunta enviada", "perguntas enviadas")} · {formatInt(answered)} respondidas
          {hidden > 0 ? ` · ${formatInt(hidden)} ocultas` : ""}. Boas candidatas a conteúdo ou FAQ da próxima vez.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma pergunta visível.</p>
        ) : (
          <ul className="divide-y">
            {shown.map((q) => (
              <li key={q.id} className="flex items-start gap-3 py-2.5 text-sm">
                <span className="w-12 shrink-0 font-display font-bold tabular-nums">👍 {q.upvotes}</span>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-line break-words">{q.body}</p>
                  <p className="text-xs text-muted-foreground">{q.author ?? "Anônima"}</p>
                </div>
                <Badge variant={q.status === "answered" ? "secondary" : "outline"}>{QUESTION_STATUS_LABEL[q.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export type ReactionPeakView = { minute: number; count: number; label: string | null };

/** Reações: total por emoji e os momentos com mais reações (com o que estava no telão). */
export function ReactionsReport({ tally, peaks }: { tally: ReactionTally; peaks: ReactionPeakView[] }) {
  const total = Object.values(tally).reduce((a, b) => a + b, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reações da plateia</CardTitle>
        <CardDescription>{plural(total, "reação", "reações")} durante a sessão.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ul className="flex flex-wrap gap-3">
          {REACTIONS.map((r) => (
            <li key={r.key} className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <span aria-hidden className="text-2xl leading-none">
                {r.emoji}
              </span>
              <span className="flex flex-col leading-tight">
                <span className="font-display text-lg font-bold tabular-nums">{formatInt(tally[r.key])}</span>
                <span className="text-xs text-muted-foreground">{r.label}</span>
              </span>
            </li>
          ))}
        </ul>
        {peaks.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Momentos com mais reações</p>
            <ol className="flex flex-col gap-1 text-sm">
              {peaks.map((p) => (
                <li key={p.minute} className="flex flex-wrap gap-x-2">
                  <span className="font-display font-bold tabular-nums">min {p.minute}</span>
                  <span className="text-muted-foreground">
                    {plural(p.count, "reação", "reações")}
                    {p.label ? ` · ${p.label}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
