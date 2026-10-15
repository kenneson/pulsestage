"use client";

import { useEffect, useState } from "react";
import { reactionTotalsAction } from "@/features/engagement/actions";
import { REACTIONS, type ReactionTally } from "@/lib/domain/reactions";
import { formatInt } from "@/lib/format";

const POLL_MS = 8000;

/** Total de reações da sessão, por emoji (atualiza enquanto a sessão está no ar). */
export function ReactionTotals({ sessionId, running }: { sessionId: string; running: boolean }) {
  const [tally, setTally] = useState<ReactionTally | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const result = await reactionTotalsAction(sessionId);
      if (result.ok && !cancelled) setTally(result.data);
    };
    void load();
    if (!running) return;
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [sessionId, running]);

  const total = tally ? Object.values(tally).reduce((a, b) => a + b, 0) : 0;
  if (!tally || total === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground" aria-label="Reações da plateia">
      {REACTIONS.filter((r) => tally[r.key] > 0).map((r) => (
        <span key={r.key} title={r.label}>
          <span aria-hidden>{r.emoji}</span> <span className="tabular-nums">{formatInt(tally[r.key])}</span>
        </span>
      ))}
    </p>
  );
}
