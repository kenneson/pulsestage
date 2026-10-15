"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { setLocaleAction } from "@/features/locale/actions";
import { isLocale, LOCALE_NAME, LOCALES, localizedPath, splitLocalePrefix, type Locale } from "@/lib/domain/locale";
import { GlobeIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Seletor de idioma. Em página pública com prefixo (/es, /en), troca o prefixo; nas demais, grava o cookie
 * (e o perfil, com login) e recarrega no novo idioma.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("common.locale");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: Locale) {
    startTransition(async () => {
      await setLocaleAction(next);
      // O caminho da barra de endereço tem o prefixo (o do roteador, depois do rewrite do proxy, não).
      const { locale: prefixed, path } = splitLocalePrefix(window.location.pathname);
      if (prefixed) {
        router.replace(`${localizedPath(next, path)}${window.location.search}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <label className={cn("relative inline-flex items-center", className)}>
      <span className="sr-only">{t("label")}</span>
      <GlobeIcon className="pointer-events-none absolute left-2.5 text-muted-foreground" />
      <select
        value={locale}
        disabled={pending}
        aria-label={t("change")}
        onChange={(e) => isLocale(e.target.value) && change(e.target.value)}
        className="h-9 appearance-none rounded-md border border-input bg-background py-1 pl-8 pr-3 text-sm text-foreground shadow-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_NAME[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
