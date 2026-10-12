"use client";

import { useEffect, useState } from "react";
import { formatTicket, PRIZE_KIND_LABEL, raffleTicketSchema, type RaffleTicket } from "@/lib/domain/raffle";
import { useLiveState } from "@/lib/realtime/use-live-state";
import { cn } from "@/lib/utils";

async function fetchTicket(sessionId: string): Promise<RaffleTicket | null> {
  try {
    const res = await fetch(`/api/participant/${sessionId}/raffle`, { cache: "no-store" });
    if (!res.ok) return null;
    const parsed = raffleTicketSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Número da sorte no celular. Busca de novo a cada sorteio (realtime) e, se houver um sorteio em
 * suspense, logo depois que o telão revelar: só então aparece "Você ganhou".
 */
export function RaffleTicketCard({
  sessionId,
  drawnAt,
  className,
}: {
  sessionId: string;
  drawnAt: string | null;
  className?: string;
}) {
  const [ticket, setTicket] = useState<RaffleTicket | null>(null);
  const [recheck, setRecheck] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    void fetchTicket(sessionId).then((next) => {
      if (cancelled || !next) return;
      setTicket(next);
      if (next.enabled && next.recheckInMs !== null) {
        timer = window.setTimeout(() => setRecheck((n) => n + 1), next.recheckInMs);
      }
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sessionId, drawnAt, recheck]);

  if (!ticket?.enabled) return null;

  if (ticket.won) {
    return (
      <div className={cn("flex flex-col items-center gap-2 rounded-2xl border-2 border-primary bg-primary/10 p-5 text-center", className)} role="status">
        <span className="text-5xl" aria-hidden>
          🎉
        </span>
        <p className="text-xl font-semibold">Você ganhou!</p>
        <p className="text-lg">{ticket.won.prize}</p>
        {ticket.won.message ? (
          <p className="whitespace-pre-line break-words rounded-lg bg-background px-3 py-2 text-sm">{ticket.won.message}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {ticket.won.kind === "physical" ? "Procure o palestrante para retirar o prêmio." : "O palestrante vai combinar a entrega com você."}
          </p>
        )}
        <span className="text-xs text-muted-foreground">Prêmio {PRIZE_KIND_LABEL[ticket.won.kind].toLowerCase()}</span>
      </div>
    );
  }

  const prizes = ticket.prizes.map((p) => (p.quantity > 1 ? `${p.name} (${p.quantity})` : p.name)).join(", ");

  if (ticket.ticket !== null) {
    return (
      <div className={cn("flex flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-primary/60 p-5 text-center", className)}>
        <p className="text-sm text-muted-foreground">Seu número da sorte</p>
        <p className="font-display text-5xl font-bold tabular-nums text-primary">{formatTicket(ticket.ticket)}</p>
        {prizes ? <p className="mt-1 text-sm">Concorrendo a: {prizes}</p> : null}
        <p className="text-xs text-muted-foreground">Fique de olho no telão.</p>
      </div>
    );
  }

  // Modo "quem responder a pesquisa", antes de responder.
  return (
    <div className={cn("rounded-2xl border border-dashed p-4 text-center text-sm", className)}>
      <p className="font-medium">Tem sorteio{prizes ? `: ${prizes}` : ""}!</p>
      <p className="text-muted-foreground">Responda a pesquisa no final da sessão para receber seu número da sorte.</p>
    </div>
  );
}

/** Versão com realtime própria, para páginas fora da sala do participante (pesquisa). */
export function RaffleTicketLive({ sessionId, className }: { sessionId: string; className?: string }) {
  const { state } = useLiveState(sessionId, null);
  return <RaffleTicketCard sessionId={sessionId} drawnAt={state?.raffle_drawn_at ?? null} className={className} />;
}
