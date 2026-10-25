"use client";

import { useCallback, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";
import { moderateResponseAction, setTermVisibilityAction } from "@/features/engagement/actions";
import type { ModerationQueue } from "@/lib/data/engagement";
import { fetchJson, usePolling } from "@/lib/realtime/use-polling";
import { wordList, type ResultsSnapshot } from "@/lib/domain/results";
import { Button } from "@/components/ui/button";
import { XIcon } from "@/components/icons";

const POLL_MS = 4000;

const queueSchema = z.object({
  responses: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      moderation: z.enum(["pending", "hidden"]),
      filtered: z.boolean(),
      createdAt: z.string(),
    }),
  ),
  hiddenTerms: z.array(z.object({ term: z.string(), count: z.number(), filtered: z.boolean() })),
}) satisfies z.ZodType<ModerationQueue>;

/**
 * Moderação da pergunta de texto no ar (nuvem ou aberta): ocultar o que não deve ir ao telão,
 * aprovar o que espera e liberar o que o filtro barrou. O telão só mostra o que está visível.
 * Use `key={interactionId}` para começar vazio quando a pergunta no ar muda.
 */
export function ModerationPanel({
  sessionId,
  interactionId,
  type,
  snapshot,
}: {
  sessionId: string;
  interactionId: string;
  type: "word_cloud" | "open_text";
  snapshot: ResultsSnapshot;
}) {
  const t = useTranslations("live.moderation");
  const tCommon = useTranslations("common.actions");
  const [queue, setQueue] = useState<ModerationQueue>({ responses: [], hiddenTerms: [] });
  const [pending, startTransition] = useTransition();

  const reload = useCallback(async () => {
    const next = await fetchJson(
      `/api/live/${sessionId}/moderation?interaction=${encodeURIComponent(interactionId)}`,
      queueSchema.parse,
    );
    if (next) setQueue(next);
  }, [sessionId, interactionId]);
  usePolling(reload, POLL_MS);

  const run = (task: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await task();
      if (!result.ok && result.error) toast.error(result.error);
      await reload();
    });

  if (type === "word_cloud") {
    const words = wordList(snapshot, 30);
    return (
      <details className="rounded-lg border px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium max-md:py-2.5">
          {t("moderateWords")}
          {queue.hiddenTerms.length > 0 ? ` · ${t("hiddenCount", { count: queue.hiddenTerms.length })}` : ""}
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          {words.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground">{t("wordsOnScreenHint")}</p>
              <ul className="flex flex-wrap gap-1.5 max-md:gap-2">
                {words.map((w) => (
                  <li key={w.word}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => setTermVisibilityAction(interactionId, w.word, false))}
                      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs hover:border-destructive hover:text-destructive max-md:min-h-11 max-md:px-3.5 max-md:text-sm"
                      aria-label={t("hideWord", { word: w.word })}
                    >
                      {w.word} <span className="text-muted-foreground">{w.count}</span> <XIcon className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {queue.hiddenTerms.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground">{t("offScreen")}</p>
              <ul className="flex flex-col gap-1">
                {queue.hiddenTerms.map((term) => (
                  <li key={term.term} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">
                      {term.term}{" "}
                      <span className="text-muted-foreground">
                        · {term.count}
                        {term.filtered ? ` · ${t("profanityFilter")}` : ""}
                      </span>
                    </span>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs max-md:h-11 max-md:shrink-0 max-md:px-3 max-md:text-sm" disabled={pending} onClick={() => run(() => setTermVisibilityAction(interactionId, term.term, true))}>
                      {tCommon("show")}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {words.length === 0 && queue.hiddenTerms.length === 0 ? <p className="text-xs text-muted-foreground">{t("noWords")}</p> : null}
        </div>
      </details>
    );
  }

  const waiting = queue.responses.filter((r) => r.moderation === "pending");
  const hidden = queue.responses.filter((r) => r.moderation === "hidden");
  return (
    <details className="rounded-lg border px-3 py-2 text-sm" open={waiting.length > 0}>
      <summary className="cursor-pointer font-medium max-md:py-2.5">
        {t("moderateResponses")}
        {waiting.length > 0 ? ` · ${t("waitingCount", { count: waiting.length })}` : ""}
        {hidden.length > 0 ? ` · ${t("hiddenCount", { count: hidden.length })}` : ""}
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        {waiting.length > 0 ? (
          <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
            {waiting.map((r) => (
              <li key={r.id} className="flex items-start gap-2 rounded-md bg-standby/10 p-2 max-md:items-center">
                <p className="min-w-0 flex-1 break-words">{r.text}</p>
                <Button size="sm" className="h-7 px-2 text-xs max-md:h-11 max-md:shrink-0 max-md:px-3 max-md:text-sm" disabled={pending} onClick={() => run(() => moderateResponseAction(r.id, true))}>
                  {t("approve")}
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs max-md:h-11 max-md:shrink-0 max-md:px-3 max-md:text-sm" disabled={pending} onClick={() => run(() => moderateResponseAction(r.id, false))}>
                  {tCommon("hide")}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        {snapshot.recent.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">{t("onScreen")}</p>
            <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto pr-1">
              {snapshot.recent.map((r) => (
                <li key={r.id} className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 break-words">{r.text}</p>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs max-md:h-11 max-md:shrink-0 max-md:px-3 max-md:text-sm" disabled={pending} onClick={() => run(() => moderateResponseAction(r.id, false))}>
                    {tCommon("hide")}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {hidden.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">{t("offScreen")}</p>
            <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto pr-1">
              {hidden.map((r) => (
                <li key={r.id} className="flex items-start gap-2 text-muted-foreground">
                  <p className="min-w-0 flex-1 break-words">
                    {r.text}
                    {r.filtered ? <span className="text-xs"> · {t("profanityFilter")}</span> : null}
                  </p>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs max-md:h-11 max-md:shrink-0 max-md:px-3 max-md:text-sm" disabled={pending} onClick={() => run(() => moderateResponseAction(r.id, true))}>
                    {tCommon("show")}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {waiting.length === 0 && hidden.length === 0 && snapshot.recent.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("noResponses")}</p>
        ) : null}
      </div>
    </details>
  );
}
