"use client";

import { useEffect, useRef, useState } from "react";
import { fetchJson, usePolling } from "@/lib/realtime/use-polling";
import { z } from "zod";
import { REACTION_EMOJI, REACTION_MAX_FLOATS, REACTION_POLL_MS, REACTIONS } from "@/lib/domain/reactions";
import { FloatingEmojis, useFloatingEmojis } from "@/components/reactions/floating-emojis";

const responseSchema = z.object({ last: z.number(), tally: z.record(z.string(), z.number()) });
/** Com reações desligadas (404) ou falha de rede, tenta de novo com menos frequência. */
const OFF_RETRY_MS = 15_000;

/** Reações da plateia subindo no telão. Só o projetor busca (em intervalos), nunca os celulares. */
export function ReactionStream({ sessionId, active }: { sessionId: string; active: boolean }) {
  const { floats, spawn, remove } = useFloatingEmojis({ rise: 520, size: 64, spread: 3 });
  const last = useRef<number | null>(null);

  // Reações desligadas (404) ou rede fora: começa de novo do ponto atual e tenta com menos frequência.
  const [off, setOff] = useState(false);
  useEffect(() => {
    if (!active) last.current = null;
  }, [active]);

  usePolling(
    async () => {
      const query = last.current === null ? "" : `?after=${last.current}`;
      const data = await fetchJson(`/api/session/${sessionId}/reactions${query}`, responseSchema.parse);
      if (!data) {
        last.current = null;
        setOff(true);
        return;
      }
      setOff(false);
      // A primeira leitura só marca o ponto de partida (o tally vem vazio).
      last.current = data.last;
      for (const r of REACTIONS) {
        const count = data.tally[r.key] ?? 0;
        if (count > 0) spawn(REACTION_EMOJI[r.key], Math.min(count, REACTION_MAX_FLOATS));
      }
    },
    off ? OFF_RETRY_MS : REACTION_POLL_MS,
    active,
  );

  return <FloatingEmojis floats={floats} onDone={remove} className="fixed z-20" />;
}
