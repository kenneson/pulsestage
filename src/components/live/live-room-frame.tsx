"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ChevronLeftIcon } from "@/components/icons";

const LIVE_ROOM_PATH = /^\/dashboard\/sessions\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/live\/?$/i;

/** Id da sessão quando o caminho é a sala ao vivo (/dashboard/sessions/<uuid>/live); senão null. */
export function liveRoomSessionId(pathname: string): string | null {
  return LIVE_ROOM_PATH.exec(pathname)?.[1] ?? null;
}

/**
 * Moldura do painel. Na sala ao vivo, tela de foco: sem a barra lateral, com um cabeçalho fino e a
 * largura toda. Decide pelo caminho no navegador porque o layout do painel não renderiza de novo
 * ao navegar entre as páginas dele (o cabeçalho com o caminho ficaria velho).
 */
export function LiveRoomFrame({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  const sessionId = liveRoomSessionId(usePathname());
  const t = useTranslations("live.focusHeader");

  if (!sessionId) {
    return (
      <div className="min-h-dvh bg-muted/30 md:flex print:bg-transparent">
        {sidebar}
        <main className="min-w-0 flex-1 px-4 py-8 md:px-8 lg:px-10 print:p-0">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-muted/30 print:bg-transparent">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex h-12 w-full max-w-[1800px] items-center gap-3 px-4 md:px-6">
          <Logo href="/dashboard" />
          <span aria-hidden className="h-5 w-px bg-border" />
          <Link
            href={`/dashboard/sessions/${sessionId}`}
            className="inline-flex min-w-0 items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeftIcon className="shrink-0" />
            <span className="truncate">{t("backToSession")}</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <LocaleSwitcher compact />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="px-4 py-6 md:px-6 print:p-0">
        <div className="mx-auto w-full max-w-[1800px]">{children}</div>
      </main>
    </div>
  );
}
