"use client";

import { useCallback, useEffect, useState } from "react";
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
  /** rede de segurança: relê o estado a cada N ms (só para o projetor; nunca para participantes) */
  pollMs?: number,
): { state: LiveState | null; connected: boolean; refresh: () => Promise<void> } {
  const [state, setState] = useState<LiveState | null>(initial);
  const [connected, setConnected] = useState(false);

  // Relê o estado do banco. Quem acabou de mudar o estado chama isto: não depende de o evento
  // do realtime chegar (ele pode se perder enquanto o canal ainda está conectando).
  const refresh = useCallback(async () => {
    const { data } = await createClient()
      .from("session_live_state")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();
    const parsed = liveStateSchema.safeParse(data);
    if (parsed.success) setState(parsed.data);
  }, [sessionId]);

  useEffect(() => {
    const supabase = createClient();
    let subscribedOnce = false;
    let catchUp: number | undefined;

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
          else {
            // O que mudou entre a página carregar e o canal conectar não chega como evento:
            // relê agora e de novo logo depois (o canal pode levar alguns segundos para entregar).
            void refresh();
            catchUp = window.setTimeout(() => void refresh(), 3000);
          }
          subscribedOnce = true;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnected(false);
        }
      });

    return () => {
      window.clearTimeout(catchUp);
      void supabase.removeChannel(channel);
    };
    // onReconnect é intencionalmente fora das deps: recriar o canal a cada render seria caro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (!pollMs) return;
    const id = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(id);
  }, [pollMs, refresh]);

  return { state, connected, refresh };
}
