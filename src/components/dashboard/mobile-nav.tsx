"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { signOutAction } from "@/features/auth/actions";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/avatar";
import { ThemeToggle } from "@/components/theme";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { buttonVariants } from "@/components/ui/button";
import {
  ChevronRightIcon,
  ClipboardIcon,
  HomeIcon,
  InboxIcon,
  LogOutIcon,
  MenuIcon,
  PlusIcon,
  PresentationIcon,
  SettingsIcon,
  XIcon,
} from "@/components/icons";
import { isNavActive, NAV_LINKS } from "@/components/dashboard/nav-links";

/*
 * Navegação do painel no celular (abaixo de 768 px), com cara de aplicativo: barra superior fina,
 * barra de abas fixa embaixo e "Mais" abrindo uma folha com o resto do menu. Tudo `md:hidden`: no
 * computador vale só a barra lateral (nav-links.tsx).
 */

type Profile = { name: string | null; email: string; avatarUrl: string | null; unreadInvites: number };

const NEW_SESSION = "/dashboard/sessions/new";
const INVITES = "/dashboard/convites";
const ACCOUNT = "/dashboard/conta";
// Abas fixas; o resto de NAV_LINKS (e Configurações) vai para a folha "Mais".
const TAB_HREFS: readonly string[] = ["/dashboard", "/dashboard/sessions", "/dashboard/pesquisas"];
const SHEET_LINKS = NAV_LINKS.filter((link) => !TAB_HREFS.includes(link.href));

const badgeText = (count: number) => (count > 99 ? "99+" : String(count));

function CountBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "min-w-[1.125rem] rounded-full bg-primary px-1 text-center text-[11px] font-semibold leading-[1.125rem] text-primary-foreground tabular-nums",
        className,
      )}
    >
      {badgeText(count)}
    </span>
  );
}

/** Barra superior do celular: marca, atalho dos convites e conta. */
export function MobileTopBar({ name, email, avatarUrl, unreadInvites }: Profile) {
  const t = useTranslations("dashboard.nav");
  const invitesLabel = unreadInvites > 0 ? `${t("invites")}: ${t("unreadInvites", { count: unreadInvites })}` : t("invites");

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden print:hidden">
      <div className="flex h-14 items-center gap-1 pl-4 pr-2">
        <Logo href="/dashboard" className="mr-auto" />
        <Link
          href={INVITES}
          aria-label={invitesLabel}
          className="relative grid size-11 place-items-center rounded-full text-muted-foreground transition-colors active:bg-muted"
        >
          <InboxIcon width={20} height={20} />
          {unreadInvites > 0 ? <CountBadge count={unreadInvites} className="absolute right-0.5 top-1 ring-2 ring-background" /> : null}
        </Link>
        <Link
          href={ACCOUNT}
          aria-label={t("profileAndAccount")}
          className="grid size-11 place-items-center rounded-full transition-colors active:bg-muted"
        >
          <Avatar src={avatarUrl} name={name} email={email} size={30} />
        </Link>
      </div>
    </header>
  );
}

function TabItem({
  href,
  label,
  icon: Icon,
  active,
  primary = false,
}: {
  href: string;
  label: string;
  icon: (p: React.SVGProps<SVGSVGElement>) => React.ReactNode;
  active: boolean;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="flex min-w-0 flex-col items-center justify-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <span
        className={cn(
          "grid h-8 w-14 place-items-center rounded-full transition-colors",
          primary ? "bg-primary text-primary-foreground shadow-sm" : active ? "bg-primary/12 text-primary" : "text-muted-foreground",
        )}
      >
        <Icon width={20} height={20} />
      </span>
      <span className={cn("max-w-full truncate px-0.5 text-[11px] leading-tight", active ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}>
        {label}
      </span>
    </Link>
  );
}

/** Barra de abas fixa no rodapé do celular, com a folha "Mais". */
export function MobileTabBar({ name, email, avatarUrl, unreadInvites }: Profile) {
  const t = useTranslations("dashboard.nav");
  const pathname = usePathname();
  const sheetRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const sheetId = useId();
  const titleId = useId();

  // Navegou (por um link da folha ou pelo voltar do navegador): a folha fecha.
  useEffect(() => {
    sheetRef.current?.close();
  }, [pathname]);

  const active = (href: string, exact: boolean) => isNavActive(pathname, href, exact);
  const sessionsActive = active("/dashboard/sessions", false) && !active(NEW_SESSION, false);
  const moreActive = SHEET_LINKS.some((link) => active(link.href, link.exact)) || active(ACCOUNT, false);

  function openSheet() {
    const sheet = sheetRef.current;
    if (!sheet || sheet.open) return;
    sheet.showModal();
    setOpen(true);
  }
  const closeSheet = () => sheetRef.current?.close();

  return (
    <>
      <nav
        aria-label={t("mainNav")}
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden"
      >
        <div className="mx-auto grid h-16 max-w-lg grid-cols-5">
          <TabItem href="/dashboard" label={t("overview")} icon={HomeIcon} active={active("/dashboard", true)} />
          <TabItem href="/dashboard/sessions" label={t("sessions")} icon={PresentationIcon} active={sessionsActive} />
          <TabItem href={NEW_SESSION} label={t("newSession")} icon={PlusIcon} active={active(NEW_SESSION, false)} primary />
          <TabItem href="/dashboard/pesquisas" label={t("surveys")} icon={ClipboardIcon} active={active("/dashboard/pesquisas", false)} />
          <button
            type="button"
            onClick={openSheet}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={sheetId}
            aria-label={unreadInvites > 0 ? `${t("more")}: ${t("unreadInvites", { count: unreadInvites })}` : undefined}
            className="flex min-w-0 flex-col items-center justify-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span
              className={cn(
                "relative grid h-8 w-14 place-items-center rounded-full transition-colors",
                moreActive || open ? "bg-primary/12 text-primary" : "text-muted-foreground",
              )}
            >
              <MenuIcon width={20} height={20} />
              {unreadInvites > 0 ? <CountBadge count={unreadInvites} className="absolute -top-1 right-1.5 ring-2 ring-background" /> : null}
            </span>
            <span className={cn("text-[11px] leading-tight", moreActive ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}>
              {t("more")}
            </span>
          </button>
        </div>
      </nav>

      {/* <dialog> nativo: foco preso, Esc fecha e o foco volta ao "Mais". Toque fora (no fundo) também fecha. */}
      <dialog
        ref={sheetRef}
        id={sheetId}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeSheet();
        }}
        className="app-sheet inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-2xl border-t bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/45 md:hidden"
      >
        <div className="flex flex-col pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
          <div className="flex items-center gap-3 px-4 pb-2 pt-2">
            <Avatar src={avatarUrl} name={name} email={email} size={40} />
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <h2 id={titleId} className="truncate font-semibold">
                {name ?? email}
              </h2>
              {name ? <span className="truncate text-sm text-muted-foreground">{email}</span> : null}
            </div>
            <button
              type="button"
              onClick={closeSheet}
              aria-label={t("closeMenu")}
              className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted active:bg-muted"
            >
              <XIcon width={20} height={20} />
            </button>
          </div>

          <ul className="mx-3 flex flex-col overflow-hidden rounded-xl border bg-background/60">
            {[...SHEET_LINKS, { href: ACCOUNT, label: "settings", exact: false, icon: SettingsIcon } as const].map((link) => {
              const current = active(link.href, link.exact);
              const isInvites = link.href === INVITES;
              return (
                <li key={link.href} className="border-b last:border-b-0">
                  <Link
                    href={link.href}
                    onClick={closeSheet}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 items-center gap-3 px-4 text-[15px] font-medium transition-colors active:bg-muted",
                      current && "bg-primary/10",
                    )}
                  >
                    <link.icon width={20} height={20} className={current ? "text-primary" : "text-muted-foreground"} />
                    <span className="min-w-0 flex-1 truncate">{t(link.label)}</span>
                    {isInvites && unreadInvites > 0 ? (
                      <span
                        className="min-w-5 rounded-full bg-primary px-1.5 text-center text-xs font-semibold leading-5 text-primary-foreground tabular-nums"
                        aria-label={t("unreadInvites", { count: unreadInvites })}
                      >
                        {badgeText(unreadInvites)}
                      </span>
                    ) : null}
                    <ChevronRightIcon aria-hidden className="text-muted-foreground/70" />
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mx-3 mt-3 flex items-center gap-2">
            <LocaleSwitcher className="min-w-0 flex-1" selectClassName="h-11 w-full text-base" />
            <ThemeToggle />
            <form action={signOutAction}>
              <button type="submit" className={buttonVariants({ variant: "outline", className: "text-muted-foreground" })}>
                <LogOutIcon />
                {t("signOut")}
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
