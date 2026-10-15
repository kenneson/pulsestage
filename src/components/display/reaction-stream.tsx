"use client";

import { useEffect, useRef } from "react";
import { z } from "zod";
import { REACTION_EMOJI, REACTION_MAX_FLOATS, REACTION_POLL_MS, REACTIONS } from "@/lib/domain/reactions";
import { FloatingEmojis, useFloatingEmojis } from "@/components/reactions/floating-emojis";

const responseSchema = z.object({ last: z.number(), tally: z.record(z.string(), z.number()) });
/** Com reações desligadas (404), tenta de novo com menos frequência. */
const OFF_RETRY_MS = 15_000;

/** Reações da plateia subindo no telão. Só o projetor busca (em intervalos), nunca os celulares. */
export function ReactionStream({ sessionId, active }: { sessionId: string; active: boolean }) {
  const { floats, spawn, remove } = useFloatingEmojis({ rise: 520, size: 64, spread: 3 });
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      last.current = null;
      return;
    }
    let cancelled = false;
    let timer: number | undefined;
    const tick = async () => {
      let wait = REACTION_POLL_MS;
      try {
        const query = last.current === null ? "" : `?after=${last.current}`;
        const res = await fetch(`/api/session/${sessionId}/reactions${query}`, { cache: "no-store" });
        if (res.status === 404) {
          last.current = null;
          wait = OFF_RETRY_MS;
        } else if (res.ok) {
          const parsed = responseSchema.safeParse(await res.json());
          if (parsed.success && !cancelled) {
            last.current = parsed.data.last;
            for (const r of REACTIONS) {
              const count = parsed.data.tally[r.key] ?? 0;
              if (count > 0) spawn(REACTION_EMOJI[r.key], Math.min(count, REACTION_MAX_FLOATS));
            }
          }
        }
      } catch {
        // rede instável: tenta no próximo ciclo
      }
      if (!cancelled) timer = window.setTimeout(() => void tick(), wait);
    };
    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sessionId, active, spawn]);

  return <FloatingEmojis floats={floats} onDone={remove} className="fixed z-20" />;
}
