"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { drawRaffleAction, raffleStateAction, redrawRaffleAction, showRaffleAction } from "@/features/raffle/actions";
import type { RaffleState } from "@/lib/data/raffle";
import { prizeProgress, RAFFLE_REVEAL_MS, winnerRevealed } from "@/lib/domain/raffle";
import type { LiveState } from "@/lib/realtime/schemas";
import { plural } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { GiftIcon } from "@/components/icons";
import { WinnerList } from "@/components/raffle/winner-list";

const POLL_MS = 5000;

/**
 * Card "Sorteio" da sala ao vivo (também depois de encerrar a sessão, quando a pesquisa abre).
 * O ganhador novo só aparece aqui depois que o telão revela, para o palestrante viver o suspense junto.
 */
export function RafflePanel({
  sessionId,
  initial,
  status,
  live,
  onChanged,
}: {
  sessionId: string;
  initial: RaffleState;
  status: string;
  live: LiveState | null;
  onChanged?: () => void;
}) {
  const [state, setState] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  const [now, setNow] = useState(() => Date.now());

  const reload = useCallback(async () => {
    const result = await raffleStateAction(sessionId);
    if (result.ok) setState(result.data);
  }, [sessionId]);

  // Quem concorre muda enquanto a pesquisa recebe respostas: relê de tempos em tempos.
  useEffect(() => {
    const id = window.setInterval(() => void reload(), POLL_MS);
    return () => window.clearInterval(id);
  }, [reload]);

  const drawnAt = live?.raffle_drawn_at ?? null;
  const suspense = drawnAt !== null && !winnerRevealed(drawnAt, now);
  useEffect(() => {
    if (!drawnAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    const stop = window.setTimeout(() => {
      window.clearInterval(id);
      setNow(Date.now());
      void reload();
    }, Math.max(0, Date.parse(drawnAt) + RAFFLE_REVEAL_MS - Date.now()) + 200);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
    };
  }, [drawnAt, reload]);

  const started = status !== "draft";
  const onScreen = Boolean(live?.show_raffle);
  const hiddenWinner = suspense ? live?.raffle_winner_id : null;

  const run = (task: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await task();
      if (!result.ok && result.error) toast.error(result.error);
      await reload();
      onChanged?.();
    });

  if (state.eligibility === null) return null;

  return (
    <Card>
      {confirmDialog}
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <GiftIcon /> Sorteio
        </CardTitle>
        <Button
          variant={onScreen ? "default" : "outline"}
          size="sm"
          disabled={pending || !started}
          onClick={() => run(() => showRaffleAction(sessionId, !onScreen))}
        >
          {onScreen ? "Ocultar sorteio" : "Mostrar sorteio"}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-script font-bold tabular-nums text-foreground">{state.entrants}</span>{" "}
          {state.entrants === 1 ? "pessoa concorrendo" : "pessoas concorrendo"}
          {state.eligibility === "survey"
            ? status === "completed"
              ? " (quem respondeu a pesquisa)."
              : ". Só quem responder a pesquisa concorre: ela abre quando você encerra a sessão."
            : "."}
        </p>

        {suspense ? (
          <p className="rounded-md bg-standby/15 px-3 py-2 text-sm" role="status">
            Sorteando… o telão revela em{" "}
            <span className="font-script font-bold tabular-nums">
              {Math.max(0, Math.ceil((Date.parse(drawnAt!) + RAFFLE_REVEAL_MS - now) / 1000))}s
            </span>
          </p>
        ) : null}

        {state.prizes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum prêmio cadastrado.{" "}
            <Link href={`/dashboard/sessions/${sessionId}?aba=sorteio`} className="underline hover:text-foreground">
              Cadastrar
            </Link>
          </p>
        ) : (
          <ol className="flex flex-col gap-4">
            {state.prizes.map((prize) => {
              const winners = prize.winners.filter((w) => w.id !== hiddenWinner);
              const { drawn, remaining } = prizeProgress(prize.quantity, prize.winners.filter((w) => !w.forfeitedAt).length);
              return (
                <li key={prize.id} className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium leading-snug">{prize.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {drawn} de {plural(prize.quantity, "ganhador", "ganhadores")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={pending || suspense || !started || remaining === 0 || state.entrants === 0}
                      onClick={() => run(() => drawRaffleAction(sessionId, prize.id))}
                    >
                      Sortear
                    </Button>
                  </div>
                  <WinnerList
                    winners={winners}
                    canDeliver={false}
                    actions={(winner) => (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={pending || suspense}
                        onClick={async () => {
                          const ok = await confirm({
                            title: `${winner.name} não está presente?`,
                            description: "A pessoa sai do sorteio e outra é sorteada para o mesmo prêmio, com animação no telão.",
                            confirmLabel: "Sortear outra pessoa",
                          });
                          if (ok) run(() => redrawRaffleAction(sessionId, winner.id));
                        }}
                      >
                        Ausente?
                      </Button>
                    )}
                  />
                </li>
              );
            })}
          </ol>
        )}
        {!started ? <p className="text-xs text-muted-foreground">Inicie a sessão para sortear.</p> : null}
      </CardContent>
    </Card>
  );
}
