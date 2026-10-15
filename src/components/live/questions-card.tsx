"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { listQuestionsAction, moderateQuestionAction, showQuestionsAction } from "@/features/engagement/actions";
import type { SpeakerQuestion } from "@/lib/data/engagement";
import type { QuestionStatus } from "@/lib/domain/questions";
import type { LiveState } from "@/lib/realtime/schemas";
import { questionsOnScreen } from "@/lib/domain/questions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageQuestionIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const POLL_MS = 4000;

type Tab = "open" | "pending" | "answered" | "hidden";
const TABS: { key: Tab; label: string; statuses: QuestionStatus[] }[] = [
  { key: "open", label: "Abertas", statuses: ["visible"] },
  { key: "pending", label: "Aguardando", statuses: ["pending"] },
  { key: "answered", label: "Respondidas", statuses: ["answered"] },
  { key: "hidden", label: "Ocultas", statuses: ["hidden"] },
];

/** Perguntas da plateia na sala ao vivo: aprovar, destacar no telão, marcar como respondida, ocultar. */
export function QuestionsCard({
  sessionId,
  live,
  status,
  enabled,
  onChanged,
}: {
  sessionId: string;
  live: LiveState | null;
  status: string;
  enabled: boolean;
  onChanged?: () => void;
}) {
  const [questions, setQuestions] = useState<SpeakerQuestion[]>([]);
  const [tab, setTab] = useState<Tab>("open");
  const [pending, startTransition] = useTransition();

  const reload = useCallback(async () => {
    const result = await listQuestionsAction(sessionId);
    if (result.ok) setQuestions(result.data);
  }, [sessionId]);

  useEffect(() => {
    // Primeira leitura logo em seguida; depois, de tempos em tempos.
    const first = window.setTimeout(() => void reload(), 0);
    const id = window.setInterval(() => void reload(), POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [reload]);

  const onScreen = questionsOnScreen(live);
  const highlighted = onScreen ? (live?.question_id ?? null) : null;
  const isLive = status === "live";

  const run = (task: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await task();
      if (!result.ok && result.error) toast.error(result.error);
      await reload();
      onChanged?.();
    });

  const counts = Object.fromEntries(
    TABS.map((t) => [t.key, questions.filter((q) => t.statuses.includes(q.status)).length]),
  ) as Record<Tab, number>;
  const visible = questions.filter((q) => TABS.find((t) => t.key === tab)?.statuses.includes(q.status));

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <MessageQuestionIcon /> Perguntas da plateia
        </CardTitle>
        {enabled ? (
          <Button
            variant={onScreen && !highlighted ? "default" : "outline"}
            size="sm"
            disabled={pending || !isLive}
            onClick={() => run(() => showQuestionsAction(sessionId, !(onScreen && !highlighted), null))}
          >
            {onScreen && !highlighted ? "Ocultar do telão" : "Mostrar no telão"}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!enabled ? (
          <p className="text-sm text-muted-foreground">
            Desligadas nesta sessão. Ligue em “Participação”, abaixo, para a plateia poder perguntar.
          </p>
        ) : (
          <>
            <div role="tablist" aria-label="Perguntas" className="flex flex-wrap gap-1">
              {TABS.filter((t) => t.key !== "pending" || counts.pending > 0 || tab === "pending").map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium",
                    tab === t.key ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted",
                    t.key === "pending" && counts.pending > 0 && "text-standby-foreground bg-standby/20",
                  )}
                >
                  {t.label} ({counts[t.key]})
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {tab === "open" ? "Nenhuma pergunta aberta. A plateia pergunta pelo celular." : "Nada por aqui."}
              </p>
            ) : (
              <ul className="flex max-h-[26rem] flex-col gap-2 overflow-y-auto pr-1">
                {visible.map((q) => (
                  <li key={q.id} className={cn("flex flex-col gap-2 rounded-lg border p-3", highlighted === q.id && "border-primary bg-primary/5")}>
                    <div className="flex items-start gap-3">
                      <span className="shrink-0 font-display text-sm font-bold tabular-nums">👍 {q.upvotes}</span>
                      <p className="min-w-0 flex-1 whitespace-pre-line break-words text-sm">{q.body}</p>
                    </div>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {q.author ?? "Anônima"}
                      {q.filtered ? " · barrada pelo filtro" : ""}
                      {highlighted === q.id ? <Badge variant="live">No telão</Badge> : null}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {q.status === "pending" || q.status === "hidden" ? (
                        <Button size="sm" className="h-7 px-2 text-xs" disabled={pending} onClick={() => run(() => moderateQuestionAction(q.id, "visible"))}>
                          {q.status === "pending" ? "Aprovar" : "Mostrar"}
                        </Button>
                      ) : null}
                      {q.status === "visible" || q.status === "answered" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={pending || !isLive}
                          onClick={() => run(() => showQuestionsAction(sessionId, highlighted !== q.id, highlighted === q.id ? null : q.id))}
                        >
                          {highlighted === q.id ? "Tirar do telão" : "Destacar"}
                        </Button>
                      ) : null}
                      {q.status === "visible" ? (
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={pending} onClick={() => run(() => moderateQuestionAction(q.id, "answered"))}>
                          Respondida
                        </Button>
                      ) : null}
                      {q.status === "answered" ? (
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={pending} onClick={() => run(() => moderateQuestionAction(q.id, "visible"))}>
                          Reabrir
                        </Button>
                      ) : null}
                      {q.status !== "hidden" ? (
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={pending} onClick={() => run(() => moderateQuestionAction(q.id, "hidden"))}>
                          Ocultar
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
