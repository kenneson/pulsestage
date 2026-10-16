"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { fetchJson, usePolling } from "@/lib/realtime/use-polling";
import { useTranslations } from "next-intl";
import { askQuestionAction, voteQuestionAction } from "@/features/participant/actions";
import { participantQuestionsSchema, QUESTION_MAX, type ParticipantQuestions, type PublicQuestion } from "@/lib/domain/questions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { MessageQuestionIcon, XIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const POLL_MS = 6000;

const fetchQuestions = (sessionId: string) =>
  fetchJson(`/api/participant/${sessionId}/questions`, participantQuestionsSchema.parse);

function QuestionItem({
  question,
  onVote,
  disabled,
}: {
  question: PublicQuestion;
  onVote: (vote: boolean) => void;
  disabled: boolean;
}) {
  const t = useTranslations("participant.questions");
  const tDomain = useTranslations("domain");
  const canVote = question.status === "visible" && !question.mine;
  return (
    <li className={cn("flex gap-3 rounded-xl border bg-card p-3", question.status === "answered" && "opacity-70")}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="whitespace-pre-line break-words">{question.body}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span>{question.author ?? t("anonymous")}</span>
          {question.mine ? <span className="font-medium text-primary">· {t("mine")}</span> : null}
          {question.status === "answered" ? <span>· {tDomain("questionStatus.answered")}</span> : null}
          {question.status === "pending" ? <span>· {tDomain("questionStatus.pending")}</span> : null}
        </p>
      </div>
      <button
        type="button"
        disabled={!canVote || disabled}
        aria-pressed={question.voted}
        aria-label={question.voted ? t("unlike") : t("like")}
        onClick={() => onVote(!question.voted)}
        className={cn(
          "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border text-sm font-semibold tabular-nums transition-colors",
          question.voted ? "border-primary bg-primary text-primary-foreground" : "bg-background",
          !canVote && "opacity-60",
        )}
      >
        <span aria-hidden className="text-base leading-none">👍</span>
        {question.upvotes}
      </button>
    </li>
  );
}

/** Perguntas da plateia no celular: enviar (anônima ou com nome), ver e curtir as dos outros. */
export function QuestionsPanel({ sessionId, myName, onClose }: { sessionId: string; myName: string | null; onClose: () => void }) {
  const t = useTranslations("participant.questions");
  const tActions = useTranslations("common.actions");
  const [data, setData] = useState<ParticipantQuestions | null>(null);
  const [body, setBody] = useState("");
  const [withName, setWithName] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const reload = useCallback(async () => {
    const next = await fetchQuestions(sessionId);
    if (next) setData(next);
  }, [sessionId]);

  // Primeira leitura ao abrir o painel; depois, de tempos em tempos (pausa com a aba escondida).
  usePolling(reload, POLL_MS);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const vote = (question: PublicQuestion, on: boolean) => {
    // Otimista: o número muda na hora; a próxima leitura confirma.
    setData((d) =>
      d
        ? {
            ...d,
            questions: d.questions.map((q) =>
              q.id === question.id ? { ...q, voted: on, upvotes: Math.max(0, q.upvotes + (on ? 1 : -1)) } : q,
            ),
          }
        : d,
    );
    startTransition(async () => {
      const result = await voteQuestionAction(sessionId, question.id, on);
      if (!result.ok) setMessage({ tone: "error", text: result.error });
      await reload();
    });
  };

  const send = () =>
    startTransition(async () => {
      const result = await askQuestionAction(sessionId, { body, withName: withName && Boolean(myName) });
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      setBody("");
      setMessage({
        tone: "success",
        text: result.data.pending ? t("sentPending") : t("sent"),
      });
      await reload();
    });

  const questions = data?.questions ?? [];

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="questions-title" className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-5 py-4">
        <h2 id="questions-title" className="flex items-center gap-2 text-lg font-semibold">
          <MessageQuestionIcon /> {t("title")}
        </h2>
        <Button variant="ghost" size="icon" aria-label={tActions("close")} onClick={onClose}>
          <XIcon />
        </Button>
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 overflow-y-auto px-5 pb-8">
        {data && !data.enabled ? (
          <Alert tone="info">{t("closed")}</Alert>
        ) : (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (body.trim().length >= 2) send();
            }}
          >
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={QUESTION_MAX}
              placeholder={t("placeholder")}
              aria-label={t("label")}
              className="min-h-24 text-base"
              disabled={pending}
            />
            <div className="flex items-center justify-between gap-3 text-sm">
              {myName ? (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={withName} onChange={(e) => setWithName(e.target.checked)} className="size-4 accent-primary" />
                  {t("showName", { name: myName })}
                </label>
              ) : (
                <span className="text-muted-foreground">{t("anonymousNote")}</span>
              )}
              <span className="text-xs text-muted-foreground tabular-nums">
                {body.length}/{QUESTION_MAX}
              </span>
            </div>
            <Button type="submit" size="lg" disabled={pending || body.trim().length < 2}>
              {pending ? tActions("sending") : t("submit")}
            </Button>
            {data?.moderated ? (
              <p className="text-xs text-muted-foreground">{t("moderatedNote")}</p>
            ) : null}
          </form>
        )}
        {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            {questions.length === 0 ? t("empty") : t("voteHint")}
          </p>
          <ul className="flex flex-col gap-2">
            {questions.map((q) => (
              <QuestionItem key={q.id} question={q} onVote={(on) => vote(q, on)} disabled={pending} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
