"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";
import { formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fetchJson, usePolling } from "@/lib/realtime/use-polling";

// Perguntas da plateia no telão: uma em destaque ou as mais curtidas. Busca no servidor
// (só responde enquanto o palestrante mostra as perguntas) e atualiza a cada poucos segundos.

const questionSchema = z.object({
  id: z.string(),
  body: z.string(),
  author: z.string().nullable(),
  upvotes: z.number(),
  answered: z.boolean(),
});
const responseSchema = z.object({
  highlight: questionSchema.nullable(),
  questions: z.array(questionSchema),
  total: z.number(),
});
type Data = z.infer<typeof responseSchema>;

const POLL_MS = 3000;

export function AudienceQuestionsStage({ sessionId, version, joinHost }: { sessionId: string; version: string | null; joinHost: string }) {
  const t = useTranslations("display.questions");
  const locale = useLocale();
  const [data, setData] = useState<Data | null>(null);

  const load = useCallback(async () => {
    const next = await fetchJson(`/api/session/${sessionId}/questions`, responseSchema.parse);
    if (next) setData(next);
  }, [sessionId]);
  usePolling(load, POLL_MS);

  // Destaque trocado (realtime): busca na hora, sem esperar a próxima volta.
  const seenVersion = useRef(version);
  useEffect(() => {
    if (seenVersion.current === version) return;
    seenVersion.current = version;
    void load();
  }, [version, load]);

  if (data?.highlight) {
    const q = data.highlight;
    return (
      <div className="flex w-full max-w-5xl flex-col items-center gap-10 text-center">
        <p className="font-display text-2xl font-bold uppercase tracking-widest text-primary">{t("eyebrow")}</p>
        <blockquote className="text-balance text-6xl font-semibold leading-tight">“{q.body}”</blockquote>
        <p className="text-3xl text-muted-foreground">
          {q.author ?? t("anonymous")} · 👍 {formatInt(q.upvotes, locale)}
        </p>
      </div>
    );
  }

  const list = data?.questions ?? [];
  return (
    <div className="flex w-full max-w-6xl flex-col gap-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-5xl font-semibold">{t("title")}</h1>
        <p className="text-2xl text-muted-foreground">
          {data ? t("openCount", { count: data.total }) : ""}
        </p>
      </div>
      {list.length === 0 ? (
        <p className="py-10 text-center text-4xl text-muted-foreground">
          {t.rich("empty", { host: joinHost, b: (chunks) => <span className="font-semibold text-foreground">{chunks}</span> })}
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {list.map((q, index) => (
            <li
              key={q.id}
              className={cn("flex items-center gap-6 rounded-2xl border px-6 py-5", index === 0 ? "border-primary bg-primary/10" : "bg-muted/40")}
            >
              <span className="flex w-24 shrink-0 flex-col items-center font-display text-4xl font-bold tabular-nums">
                👍
                <span>{formatInt(q.upvotes, locale)}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-3xl leading-snug">{q.body}</p>
                <p className="mt-1 text-xl text-muted-foreground">{q.author ?? t("anonymous")}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
