"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { formatInt } from "@/lib/format";

// Ranking do quiz animado. As linhas aparecem na posição de antes do último quiz e deslizam até a
// posição atual enquanto os pontos sobem; quem entrou agora sobe do fim da lista.

const entrySchema = z.object({
  key: z.string(),
  name: z.string(),
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
const SETTLE_MS = 700;
const COUNT_MS = 1200;

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Pontos contando do valor anterior até o atual. */
function useCountUp(from: number, to: number, run: boolean): number {
  const [value, setValue] = useState(from);
  useEffect(() => {
    if (!run) return;
    if (reducedMotion()) {
      const id = requestAnimationFrame(() => setValue(to));
      return () => cancelAnimationFrame(id);
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(from + (to - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [from, to, run]);
  return value;
}

function Row({ entry, settled, total, variant }: { entry: Entry; settled: boolean; total: number; variant: Variant }) {
  const big = variant === "display";
  const startRank = entry.previousRank !== null && entry.previousRank <= total ? entry.previousRank : total + 1;
  const position = (settled ? entry.rank : startRank) - 1;
  const points = useCountUp(entry.previousPoints, entry.points, settled);
  const moved = entry.previousRank === null ? null : entry.previousRank - entry.rank;
  const leader = entry.rank === 1;

  return (
    <li
      className={cn(
        "absolute inset-x-0 flex items-center gap-4 rounded-lg px-4 transition-[transform,opacity] duration-700 ease-out",
        big ? "text-3xl" : "gap-3 px-3 text-sm",
        leader ? "bg-primary/15" : "bg-muted/60",
      )}
      style={{
        height: ROW[variant] - (big ? 10 : 6),
        transform: `translateY(${position * ROW[variant]}px)`,
        opacity: settled || entry.previousRank !== null ? 1 : 0,
      }}
    >
      <span className={cn("w-12 shrink-0 font-script font-bold tabular-nums", !big && "w-6", leader && "text-primary")}>
        {entry.rank}º
      </span>
      <span className={cn("min-w-0 flex-1 truncate font-semibold", leader && "text-primary")}>{entry.name}</span>
      {settled && moved !== null && moved !== 0 ? (
        <span className={cn("shrink-0 tabular-nums text-muted-foreground", big ? "text-xl" : "text-xs")}>
          {moved > 0 ? `↑${moved}` : `↓${-moved}`}
        </span>
      ) : null}
      {settled && entry.previousRank === null ? (
        <span className={cn("shrink-0 text-muted-foreground", big ? "text-xl" : "text-xs")}>novo</span>
      ) : null}
      <span className="shrink-0 font-script font-bold tabular-nums">{formatInt(points)} pts</span>
    </li>
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
  const [state, setState] = useState<{ version: string | null; entries: Entry[] | null; failed: boolean }>({
    version: null,
    entries: null,
    failed: false,
  });
  const [settled, setSettled] = useState(false);

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
    const id = window.setTimeout(() => setSettled(true), reducedMotion() ? 0 : SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [state]);

  const big = variant === "display";
  const entries = state.entries;

  return (
    <div className={cn("flex w-full flex-col", big ? "max-w-4xl gap-8" : "gap-3")}>
      {big ? <h1 className="text-center text-6xl font-semibold">Ranking do quiz</h1> : null}
      {entries === null ? (
        <p className={cn("text-center text-muted-foreground", big ? "text-3xl" : "text-sm")}>
          {state.failed ? "Não foi possível carregar o ranking." : "Carregando o ranking…"}
        </p>
      ) : entries.length === 0 ? (
        <p className={cn("text-center text-muted-foreground", big ? "text-3xl" : "text-sm")}>
          Ninguém respondeu ao quiz ainda.
        </p>
      ) : (
        <ol className="relative" style={{ height: entries.length * ROW[variant] }} aria-label="Ranking do quiz">
          {entries.map((entry) => (
            <Row key={entry.key} entry={entry} settled={settled} total={entries.length} variant={variant} />
          ))}
        </ol>
      )}
    </div>
  );
}
