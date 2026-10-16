"use client";

import { useEffect, useRef } from "react";

/**
 * Chama `fn` agora e a cada `ms` (espera a chamada anterior terminar). Com a aba escondida, pausa;
 * ao voltar, busca na hora. Para leituras periódicas por GET (nunca por Server Action: ações rodam uma
 * de cada vez e atrasariam os cliques). `enabled` false desliga.
 */
export function usePolling(fn: () => Promise<unknown> | unknown, ms: number, enabled = true) {
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer: number | undefined;

    const schedule = (delay: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(tick, delay);
    };
    async function tick() {
      if (document.visibilityState === "visible") {
        try {
          await latest.current();
        } catch {
          // falha de rede: tenta de novo na próxima volta
        }
      }
      if (!stopped) schedule(ms);
    }
    const onVisible = () => {
      if (document.visibilityState === "visible" && !stopped) schedule(0);
    };

    schedule(0);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ms, enabled]);
}

/** GET JSON sem cache, validado pelo `parse` (ex.: schema.parse). Erro HTTP ou de rede: null. */
export async function fetchJson<T>(url: string, parse: (data: unknown) => T): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return parse(await res.json());
  } catch {
    return null;
  }
}
