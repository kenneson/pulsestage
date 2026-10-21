"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/motion/animated";
import { SPRING } from "@/components/motion/presets";

// Ranking do quiz animado. As linhas aparecem na posição de antes do último quiz e deslizam até a
// posição atual enquanto os pontos sobem; quem entrou agora sobe do fim da lista.

const entrySchema = z.object({
  key: z.string(),
  name: z.string(),
  avatar: z.string().nullable().catch(null),
  rank: z.number(),
  points: z.number(),
  correct: z.number(),
  previousRank: z.number().nullable(),
  previousPoints: z.number(),
});
const responseSchema = z.object({ entries: z.array(entrySchema) });
type Entry = z.infer<typeof entrySchema>;

type Variant = "display" | "compact";

const ROW: Record<Variant, number> = { display: 76, compact: 44 };
/** Quanto tempo o ranking fica na posição de antes do último quiz antes de deslizar. */
const SETTLE_MS = 700;

function Row({ entry, settled, total, variant }: { entry: Entry; settled: boolean; total: number; variant: Variant }) {
  const t = useTranslations("display.leaderboard");
  const locale = useLocale();
  const big = variant === "display";
  const startRank = entry.previousRank !== null && entry.previousRank <= total ? entry.previousRank : total + 1;
  const position = (settled ? entry.rank : startRank) - 1;
  const moved = entry.previousRank === null ? null : entry.previousRank - entry.rank;
  const leader = entry.rank === 1;

  return (
    <m.li
      className={cn(
        "absolute inset-x-0 top-0 flex items-center gap-4 rounded-lg px-4 transition-colors duration-700",
        big ? "text-3xl" : "gap-3 px-3 text-sm",
        leader && settled ? "bg-primary/15" : "bg-muted/60",
      )}
      style={{ height: ROW[variant] - (big ? 10 : 6) }}
      initial={false}
      // Desliza com mola até a posição; quem entrou agora sobe do fim da lista aparecendo.
      animate={{ y: position * ROW[variant], opacity: settled || entry.previousRank !== null ? 1 : 0 }}
      transition={{ ...SPRING.soft, delay: settled ? Math.min(entry.rank, 10) * 0.04 : 0 }}
    >
      <span className={cn("w-12 shrink-0 font-display font-bold tabular-nums", !big && "w-6", leader && "text-primary")}>
        {t("rank", { rank: entry.rank })}
      </span>
      <span
        aria-hidden
        className={cn(
          "grid shrink-0 place-items-center rounded-full bg-background leading-none",
          big ? "size-14 text-4xl" : "size-8 text-lg",
        )}
      >
        {entry.avatar ?? <span className="font-display text-muted-foreground">{entry.name.charAt(0).toUpperCase()}</span>}
      </span>
      <span className={cn("min-w-0 flex-1 truncate font-semibold", leader && "text-primary")}>{entry.name}</span>
      <AnimatePresence>
        {settled && moved !== null && moved !== 0 ? (
          <m.span
            key="moved"
            className={cn(
              "shrink-0 font-semibold tabular-nums",
              moved > 0 ? "text-primary" : "text-muted-foreground",
              big ? "text-xl" : "text-xs",
            )}
            initial={{ opacity: 0, scale: 0.4, y: moved > 0 ? 12 : -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ ...SPRING.snappy, delay: 0.35 }}
          >
            {moved > 0 ? `↑${moved}` : `↓${-moved}`}
          </m.span>
        ) : null}
        {settled && entry.previousRank === null ? (
          <m.span
            key="new"
            className={cn("shrink-0 text-muted-foreground", big ? "text-xl" : "text-xs")}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...SPRING.snappy, delay: 0.35 }}
          >
            {t("new")}
          </m.span>
        ) : null}
      </AnimatePresence>
      {/* Os pontos contam do valor de antes do último quiz até o atual. */}
      <AnimatedNumber
        value={settled ? entry.points : entry.previousPoints}
        from={entry.previousPoints}
        locale={locale}
        duration={1.2}
        render={(points) => t("points", { points })}
        className="shrink-0 font-display font-bold"
      />
    </m.li>
  );
}

export function QuizLeaderboard({
  sessionId,
  version,
  variant = "display",
}: {
  sessionId: string;
  /** muda a cada "Mostrar ranking": busca de novo e repete a animação */
  version: string | null;
  variant?: Variant;
}) {
  const t = useTranslations("display.leaderboard");
  const [state, setState] = useState<{ version: string | null; entries: Entry[] | null; failed: boolean }>({
    version: null,
    entries: null,
    failed: false,
  });
  const [settled, setSettled] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/session/${sessionId}/leaderboard`, { cache: "no-store" })
      .then(async (res) => (res.ok ? responseSchema.parse(await res.json()).entries : null))
      .catch(() => null)
      .then((entries) => {
        if (cancelled) return;
        setSettled(false);
        setState({ version, entries, failed: entries === null });
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, version]);

  // Mostra a posição anterior por um instante e então anima até a atual.
  useEffect(() => {
    if (!state.entries) return;
    const id = window.setTimeout(() => setSettled(true), reduce ? 0 : SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [state, reduce]);

  const big = variant === "display";
  const entries = state.entries;

  return (
    <div className={cn("flex w-full flex-col", big ? "max-w-4xl gap-8" : "gap-3")}>
      {big ? <h1 className="text-center text-6xl font-semibold">{t("title")}</h1> : null}
      {entries === null ? (
        <p className={cn("text-center text-muted-foreground", big ? "text-3xl" : "text-sm")}>
          {state.failed ? t("loadFailed") : t("loading")}
        </p>
      ) : entries.length === 0 ? (
        <p className={cn("text-center text-muted-foreground", big ? "text-3xl" : "text-sm")}>
          {t("empty")}
        </p>
      ) : (
        <ol className="relative" style={{ height: entries.length * ROW[variant] }} aria-label={t("title")}>
          {entries.map((entry) => (
            <Row key={entry.key} entry={entry} settled={settled} total={entries.length} variant={variant} />
          ))}
        </ol>
      )}
    </div>
  );
}
