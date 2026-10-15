"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { setPrizeDeliveredAction } from "@/features/raffle/actions";
import type { RaffleWinnerAdmin } from "@/lib/data/raffle";
import { formatTicket } from "@/lib/domain/raffle";
import { cn } from "@/lib/utils";

function DeliveredToggle({ winner }: { winner: RaffleWinnerAdmin }) {
  const t = useTranslations("dashboard.winnerList");
  const [pending, startTransition] = useTransition();
  const [delivered, setDelivered] = useOptimistic(winner.deliveredAt !== null);
  return (
    <label className="flex items-center gap-1.5 text-xs">
      <input
        type="checkbox"
        className="size-4"
        checked={delivered}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          startTransition(async () => {
            setDelivered(next);
            const result = await setPrizeDeliveredAction(winner.id, next);
            if (!result.ok) toast.error(result.error);
          });
        }}
      />
      {t("delivered")}
    </label>
  );
}

/** Ganhadores de um prêmio, com o controle de entrega. Ausentes aparecem riscados. */
export function WinnerList({
  winners,
  canDeliver = true,
  actions,
}: {
  winners: RaffleWinnerAdmin[];
  canDeliver?: boolean;
  /** botões extras por ganhador (ex.: "Ausente? Sortear outro" na sala ao vivo) */
  actions?: (winner: RaffleWinnerAdmin) => React.ReactNode;
}) {
  const t = useTranslations("dashboard.winnerList");
  if (winners.length === 0) return null;

  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {winners.map((w) => (
        <li key={w.id} className={cn("flex flex-wrap items-center gap-3 px-3 py-2 text-sm", w.forfeitedAt && "text-muted-foreground")}>
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-lg leading-none">
            {w.avatar ?? <span className="font-display text-sm">{w.name.charAt(0).toUpperCase()}</span>}
          </span>
          <span className={cn("min-w-0 flex-1 truncate font-medium", w.forfeitedAt && "line-through")}>{w.name}</span>
          <span className="font-display font-bold tabular-nums">{t("ticket", { number: formatTicket(w.number) })}</span>
          {w.forfeitedAt ? (
            <span className="text-xs">{t("absent")}</span>
          ) : canDeliver ? (
            <DeliveredToggle winner={w} />
          ) : null}
          {!w.forfeitedAt && actions ? actions(w) : null}
        </li>
      ))}
    </ul>
  );
}
