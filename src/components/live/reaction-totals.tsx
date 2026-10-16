"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";
import { REACTION_KINDS, REACTIONS, type ReactionTally } from "@/lib/domain/reactions";
import { formatInt } from "@/lib/format";
import { fetchJson, usePolling } from "@/lib/realtime/use-polling";

const POLL_MS = 8000;
/** Fora do ar o total quase não muda: relê de vez em quando. */
const IDLE_MS = 60_000;

const tallySchema = z.record(z.enum(REACTION_KINDS), z.number()) satisfies z.ZodType<ReactionTally>;

/** Total de reações da sessão, por emoji (atualiza enquanto a sessão está no ar). */
export function ReactionTotals({ sessionId, running }: { sessionId: string; running: boolean }) {
  const t = useTranslations("live.reactionTotals");
  const tDomain = useTranslations("domain");
  const locale = useLocale();
  const [tally, setTally] = useState<ReactionTally | null>(null);

  usePolling(async () => {
    const next = await fetchJson(`/api/live/${sessionId}/reactions`, tallySchema.parse);
    if (next) setTally(next);
  }, running ? POLL_MS : IDLE_MS);

  const total = tally ? Object.values(tally).reduce((a, b) => a + b, 0) : 0;
  if (!tally || total === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground" aria-label={t("label")}>
      {REACTIONS.filter((r) => tally[r.key] > 0).map((r) => (
        <span key={r.key} title={tDomain(`reactions.${r.key}`)}>
          <span aria-hidden>{r.emoji}</span> <span className="tabular-nums">{formatInt(tally[r.key], locale)}</span>
        </span>
      ))}
    </p>
  );
}
