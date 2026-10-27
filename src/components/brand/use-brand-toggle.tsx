"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { setSessionBrandAction } from "@/features/account/actions";
import { cn } from "@/lib/utils";

/**
 * "Usar minha marca" da sessão (sessions.use_brand). Salva na hora, também ao vivo (o celular e o telão
 * pegam a cor e o logo na próxima vez que carregarem). Sem marca no perfil, mostra o link para a Conta.
 */
export function UseBrandToggle({
  sessionId,
  initial,
  hasBrand,
  className,
}: {
  sessionId: string;
  initial: boolean;
  /** o perfil tem logo ou cor */
  hasBrand: boolean;
  className?: string;
}) {
  const t = useTranslations("account.brand.session");
  const [enabled, setEnabled] = useOptimistic(initial);
  const [, startTransition] = useTransition();

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className="flex cursor-pointer items-start gap-3 max-md:min-h-11">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            const next = e.target.checked;
            startTransition(async () => {
              setEnabled(next);
              const result = await setSessionBrandAction(sessionId, next);
              if (!result.ok) toast.error(result.error);
            });
          }}
          className="mt-0.5 size-4 shrink-0 accent-primary max-md:size-5"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{t("label")}</span>
          <span className="text-xs text-muted-foreground">
            {hasBrand
              ? t("description")
              : t.rich("noBrand", {
                  link: (chunks) => (
                    <Link href="/dashboard/conta#marca" className="font-medium text-primary hover:underline">
                      {chunks}
                    </Link>
                  ),
                })}
          </span>
        </span>
      </label>
    </div>
  );
}
