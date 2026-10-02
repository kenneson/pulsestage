"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { liveStateSchema, type LiveState } from "./schemas";

/**
 * Estado ao vivo da sessão (status + interaction ativa).
 * Encapsulado aqui para permitir trocar Postgres Changes por Broadcast no futuro.
 */
export function useLiveState(
  sessionId: string,
  initial: LiveState | null,
  onReconnect?: () => void,
): { state: LiveState | null; connected: boolean } {
  const [state, setState] = useState<LiveState | null>(initial);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let subscribedOnce = false;

    const channel = supabase
      .channel(`live-state:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_live_state", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const parsed = liveStateSchema.safeParse(payload.new);
          if (parsed.success) setState(parsed.data);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
          if (subscribedOnce) onReconnect?.();
          subscribedOnce = true;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnected(false);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
    // onReconnect é intencionalmente fora das deps: recriar o canal a cada render seria caro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return { state, connected };
}
