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
export function LiveRoomFrame({
  sidebar,
  mobileHeader,
  mobileTabBar,
  children,
}: {
  sidebar: React.ReactNode;
  /** Barras do celular (`md:hidden`); ficam fora da sala ao vivo, que tem os próprios controles. */
  mobileHeader?: React.ReactNode;
  mobileTabBar?: React.ReactNode;
  children: React.ReactNode;
}) {
  const sessionId = liveRoomSessionId(usePathname());
  const t = useTranslations("live.focusHeader");

  if (!sessionId) {
    return (
      <div className="min-h-dvh bg-muted/30 md:flex print:bg-transparent">
        {mobileHeader}
        {sidebar}
        {/* No celular, folga embaixo para a barra de abas fixa não cobrir o fim da página. */}
        <main className="min-w-0 flex-1 px-4 py-8 max-md:pb-[calc(6rem+env(safe-area-inset-bottom))] max-md:pt-5 md:px-8 lg:px-10 print:p-0">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
        {mobileTabBar}
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-muted/30 print:bg-transparent">
      {/* Celular: só o símbolo da marca, para "Voltar à sessão" caber inteiro ao lado do idioma e do tema. */}
      <header className="sticky top-0 z-30 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur print:hidden">
        <div className="mx-auto flex h-12 w-full max-w-[1800px] items-center gap-3 px-4 max-md:h-14 max-md:gap-2 max-md:pl-3 max-md:pr-2 md:px-6">
          <Logo href="/dashboard" textClassName="max-md:sr-only" />
          <span aria-hidden className="h-5 w-px bg-border" />
          <Link
            href={`/dashboard/sessions/${sessionId}`}
            className="inline-flex min-w-0 items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground max-md:min-h-11 max-md:px-1.5 max-md:font-medium max-md:text-foreground"
          >
            <ChevronLeftIcon className="shrink-0" />
            <span className="truncate">{t("backToSession")}</span>
          </Link>
          <div className="ml-auto flex shrink-0 items-center gap-1">
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
