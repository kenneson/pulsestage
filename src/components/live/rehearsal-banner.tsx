"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { endRehearsalAction } from "@/features/sessions/actions";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";

/** Faixa do ensaio no topo da sala ao vivo: lembra que nada conta e encerra (apaga) o ensaio. */
export function RehearsalBanner({ sessionId }: { sessionId: string }) {
  const t = useTranslations("live.rehearsal");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();

  async function end() {
    const ok = await confirm({
      title: t("endConfirm.title"),
      description: t("endConfirm.description"),
      confirmLabel: t("endConfirm.confirm"),
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await endRehearsalAction(sessionId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(result.data.sourceId ? `/dashboard/sessions/${result.data.sourceId}` : "/dashboard/sessions");
    });
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-standby bg-standby/15 px-4 py-3 text-sm text-foreground"
    >
      {confirmDialog}
      <p>
        {t.rich("banner", {
          strong: (chunks) => <span className="font-semibold">{chunks}</span>,
        })}
      </p>
      <Button variant="outline" size="sm" disabled={pending} onClick={end}>
        {t("end")}
      </Button>
    </div>
  );
}
