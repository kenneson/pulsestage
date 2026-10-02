"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PresenceMeta = { role: "participant" | "observer" };

/**
 * "Conectados agora" via Realtime Presence.
 * Número informativo: um cliente malicioso pode inflá-lo, então não entra em métricas.
 */
export function usePresence(sessionId: string, role: PresenceMeta["role"]): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`presence:session:${sessionId}`, {
      config: { presence: { key: crypto.randomUUID() } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceMeta>();
        const participants = Object.values(state).filter((metas) => metas.some((m) => m.role === "participant"));
        setCount(participants.length);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && role === "participant") {
          void channel.track({ role });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, role]);

  return count;
}
