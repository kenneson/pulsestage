import { useLocale, useTranslations } from "next-intl";
import type { SpeakerQuestion } from "@/lib/data/engagement";
import { REACTIONS, type ReactionTally } from "@/lib/domain/reactions";
import { formatInt } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Perguntas da plateia depois da sessão: as mais curtidas primeiro (as ocultas só contam). */
export function AudienceQuestionsReport({ questions }: { questions: SpeakerQuestion[] }) {
  const shown = questions.filter((q) => q.status !== "hidden").sort((a, b) => b.upvotes - a.upvotes);
  const hidden = questions.length - shown.length;
  const answered = questions.filter((q) => q.status === "answered").length;
  const t = useTranslations("analytics.engagement.questions");
  const tDomain = useTranslations("domain");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>
          {t("sent", { count: questions.length })} · {t("answered", { count: answered })}
          {hidden > 0 ? ` · ${t("hidden", { count: hidden })}` : ""}. {t("tip")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("none")}</p>
        ) : (
          <ul className="divide-y">
            {shown.map((q) => (
              <li key={q.id} className="flex items-start gap-3 py-2.5 text-sm">
                <span className="w-12 shrink-0 font-display font-bold tabular-nums">👍 {q.upvotes}</span>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-line break-words">{q.body}</p>
                  <p className="text-xs text-muted-foreground">{q.author ?? t("anonymous")}</p>
                </div>
                <Badge variant={q.status === "answered" ? "secondary" : "outline"}>{tDomain(`questionStatus.${q.status}`)}</Badge>
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
  const t = useTranslations("analytics.engagement.reactions");
  const tDomain = useTranslations("domain");
  const locale = useLocale();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("total", { count: total })}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ul className="flex flex-wrap gap-3">
          {REACTIONS.map((r) => (
            <li key={r.key} className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <span aria-hidden className="text-2xl leading-none">
                {r.emoji}
              </span>
              <span className="flex flex-col leading-tight">
                <span className="font-display text-lg font-bold tabular-nums">{formatInt(tally[r.key], locale)}</span>
                <span className="text-xs text-muted-foreground">{tDomain(`reactions.${r.key}`)}</span>
              </span>
            </li>
          ))}
        </ul>
        {peaks.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t("peaksTitle")}</p>
            <ol className="flex flex-col gap-1 text-sm">
              {peaks.map((p) => (
                <li key={p.minute} className="flex flex-wrap gap-x-2">
                  <span className="font-display font-bold tabular-nums">{t("peakMinute", { minute: p.minute })}</span>
                  <span className="text-muted-foreground">
                    {t("count", { count: p.count })}
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
