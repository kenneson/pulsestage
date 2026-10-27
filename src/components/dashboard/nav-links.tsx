"use client";

import { useCallback, useEffect, useState } from "react";
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
import { SIDEBAR_COOKIE } from "./sidebar-cookie";
import {
  ClipboardIcon,
  GiftIcon,
  HelpIcon,
  HomeIcon,
  IdCardIcon,
  InboxIcon,
  PlugIcon,
  LibraryIcon,
  LogOutIcon,
  PlusIcon,
  PresentationIcon,
  SettingsIcon,
  SidebarIcon,
  TrendingUpIcon,
} from "@/components/icons";

// `label`: chave de dashboard.nav. `group`: seção da barra lateral (dashboard.nav.groups; "main" sem título,
// "support" fica no rodapé). Também usada pela navegação do celular (mobile-nav.tsx).
export const NAV_LINKS = [
  { href: "/dashboard", label: "overview", exact: true, icon: HomeIcon, group: "main" },
  { href: "/dashboard/sessions", label: "sessions", exact: false, icon: PresentationIcon, group: "main" },
  { href: "/dashboard/pesquisas", label: "surveys", exact: false, icon: ClipboardIcon, group: "main" },
  { href: "/dashboard/biblioteca", label: "library", exact: false, icon: LibraryIcon, group: "main" },
  { href: "/dashboard/analytics", label: "evolution", exact: true, icon: TrendingUpIcon, group: "results" },
  { href: "/dashboard/sorteios", label: "raffles", exact: true, icon: GiftIcon, group: "results" },
  { href: "/dashboard/perfil-publico", label: "publicProfile", exact: true, icon: IdCardIcon, group: "profile" },
  { href: "/dashboard/convites", label: "invites", exact: true, icon: InboxIcon, group: "profile" },
  { href: "/dashboard/integracoes", label: "integrations", exact: true, icon: PlugIcon, group: "support" },
  { href: "/dashboard/guia", label: "guide", exact: true, icon: HelpIcon, group: "support" },
] as const;

export type NavLink = (typeof NAV_LINKS)[number];

const BODY_GROUPS = ["main", "results", "profile"] as const;

export const isNavActive = (pathname: string, href: string, exact: boolean) =>
  exact ? pathname === href : pathname.startsWith(href);


const linkClass = (active: boolean, collapsed: boolean) =>
  cn(
    "relative flex min-h-10 items-center gap-3 rounded-md text-sm font-medium transition-colors",
    collapsed ? "justify-center px-0" : "px-3",
    active ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );

/**
 * Barra lateral do painel (a partir de 768 px). Recolhe para uma coluna de ícones (botão no topo ou
 * Ctrl/Cmd+B); a escolha fica num cookie. No celular, a navegação é a de `mobile-nav.tsx`.
 */
export function DashboardSidebar({
  name,
  email,
  avatarUrl,
  unreadInvites = 0,
  defaultCollapsed = false,
}: {
  name: string | null;
  email: string;
  avatarUrl: string | null;
  unreadInvites?: number;
  defaultCollapsed?: boolean;
}) {
  const t = useTranslations("dashboard.nav");
  const pathname = usePathname();
  const isActive = (href: string, exact: boolean) => isNavActive(pathname, href, exact);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const toggle = useCallback(() => setCollapsed((current) => !current), []);

  useEffect(() => {
    document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  }, [collapsed]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "b" || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      e.preventDefault();
      toggle();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const toggleLabel = collapsed ? t("expandSidebar") : t("collapseSidebar");

  const renderLink = (link: { href: string; label: NavLink["label"] | "settings"; exact: boolean; icon: NavLink["icon"] }) => {
    const active = isActive(link.href, link.exact);
    const label = t(link.label);
    const badge = link.href === "/dashboard/convites" && unreadInvites > 0;
    return (
      <Link
        key={link.href}
        href={link.href}
        aria-current={active ? "page" : undefined}
        title={collapsed ? label : undefined}
        className={linkClass(active, collapsed)}
      >
        <link.icon className={cn("shrink-0", active && "text-primary")} />
        <span className={collapsed ? "sr-only" : "truncate"}>{label}</span>
        {badge ? (
          collapsed ? (
            <span aria-hidden className="absolute right-2 top-1.5 size-2 rounded-full bg-primary" />
          ) : (
            <span
              className="ml-auto min-w-5 rounded-full bg-primary px-1.5 text-center text-xs font-semibold leading-5 text-primary-foreground tabular-nums"
              aria-label={t("unreadInvites", { count: unreadInvites })}
            >
              {unreadInvites > 99 ? "99+" : unreadInvites}
            </span>
          )
        ) : null}
        {badge && collapsed ? <span className="sr-only">{t("unreadInvites", { count: unreadInvites })}</span> : null}
      </Link>
    );
  };

  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={cn(
        "border-b bg-background print:hidden max-md:hidden md:sticky md:top-0 md:flex md:h-dvh md:shrink-0 md:flex-col md:border-b-0 md:border-r md:transition-[width] md:duration-200 motion-reduce:transition-none",
        collapsed ? "md:w-[4.75rem]" : "md:w-72",
      )}
    >
      <div className={cn("flex items-center gap-2 py-5", collapsed ? "flex-col px-3" : "justify-between pl-5 pr-3")}>
        <Logo href="/dashboard" textClassName={collapsed ? "sr-only" : undefined} />
        <button
          type="button"
          onClick={toggle}
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          title={`${toggleLabel} (Ctrl+B)`}
          className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <SidebarIcon />
        </button>
      </div>

      <div className={cn("flex flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden pb-4", collapsed ? "px-3" : "px-4")}>
        <Link
          href="/dashboard/sessions/new"
          aria-label={collapsed ? t("newSession") : undefined}
          title={collapsed ? t("newSession") : undefined}
          className={buttonVariants({ className: collapsed ? "w-full px-0" : "w-full" })}
        >
          <PlusIcon /> {collapsed ? null : t("newSession")}
        </Link>

        <nav aria-label={t("mainNav")} className="flex flex-col gap-4">
          {BODY_GROUPS.map((group) => (
            <div key={group} className="flex flex-col gap-0.5">
              {group === "main" ? null : collapsed ? (
                <span aria-hidden className="mx-2 mb-1 border-t" />
              ) : (
                <span className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                  {t(`groups.${group}`)}
                </span>
              )}
              {NAV_LINKS.filter((link) => link.group === group).map(renderLink)}
            </div>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-0.5 border-t pt-4">
          {NAV_LINKS.filter((link) => link.group === "support").map(renderLink)}
          {renderLink({ href: "/dashboard/conta", label: "settings", exact: false, icon: SettingsIcon })}
          <div className={cn("flex items-center gap-2 pt-2", collapsed ? "flex-col" : "px-1")}>
            <Link
              href="/dashboard/conta"
              title={collapsed ? (name ?? email) : undefined}
              className={cn("flex min-w-0 items-center gap-2.5 rounded-md p-2 hover:bg-muted", !collapsed && "flex-1")}
            >
              <Avatar src={avatarUrl} name={name} email={email} size={30} />
              <span className={collapsed ? "sr-only" : "flex min-w-0 flex-col leading-tight"}>
                <span className="truncate text-sm font-medium">{name ?? email}</span>
                <span className="truncate text-xs text-muted-foreground">{t("profileAndAccount")}</span>
              </span>
            </Link>
            <LocaleSwitcher compact selectClassName={collapsed ? "w-[3.25rem] pl-7 pr-1 text-xs" : undefined} />
            <ThemeToggle />
            <form action={signOutAction}>
              <button
                type="submit"
                aria-label={t("signOut")}
                title={t("signOut")}
                className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <LogOutIcon />
              </button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  );
}
