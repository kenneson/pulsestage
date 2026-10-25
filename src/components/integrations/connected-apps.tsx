"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { revokeGrantAction } from "@/features/integrations/actions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { PlugIcon } from "@/components/icons";

/** `grantedAt`: data já formatada no fuso do speaker e no idioma do painel. */
export type ConnectedApp = { clientId: string; name: string; site: string | null; grantedAt: string };

/** Assistentes com acesso à conta (OAuth), com a opção de revogar. */
export function ConnectedApps({ apps }: { apps: ConnectedApp[] }) {
  const t = useTranslations("integrations.connectedApps");
  const [list, remove] = useOptimistic(apps, (current, clientId: string) => current.filter((a) => a.clientId !== clientId));
  const [, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();

  if (list.length === 0) {
    return (
      <EmptyState
        title={t("emptyTitle")}
        description={t("emptyDescription")}
      />
    );
  }

  return (
    <ul className="divide-y rounded-md border">
      {confirmDialog}
      {list.map((app) => (
        <li key={app.clientId} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <PlugIcon className="shrink-0 text-muted-foreground" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">{app.name}</span>
            <span className="text-xs text-muted-foreground">
              {t("connectedOn", { date: app.grantedAt })}
              {app.site ? ` · ${app.site}` : ""}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="max-md:h-11 max-md:text-sm"
            onClick={async () => {
              const ok = await confirm({
                title: t("revokeTitle", { name: app.name }),
                description: t("revokeDescription"),
                confirmLabel: t("revokeConfirm"),
                destructive: true,
              });
              if (!ok) return;
              startTransition(async () => {
                remove(app.clientId);
                const result = await revokeGrantAction(app.clientId);
                if (!result.ok) toast.error(result.error);
                else toast.success(t("revoked"));
              });
            }}
          >
            {t("revoke")}
          </Button>
        </li>
      ))}
    </ul>
  );
}
