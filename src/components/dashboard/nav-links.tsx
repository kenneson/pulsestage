"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/features/auth/actions";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/avatar";
import { ThemeToggle } from "@/components/theme";
import { buttonVariants } from "@/components/ui/button";
import {
  BookIcon,
  ClipboardIcon,
  HomeIcon,
  LibraryIcon,
  LogOutIcon,
  MenuIcon,
  PlusIcon,
  PresentationIcon,
  SettingsIcon,
  TrendingUpIcon,
  XIcon,
} from "@/components/icons";

const LINKS = [
  { href: "/dashboard", label: "Visão geral", exact: true, icon: HomeIcon },
  { href: "/dashboard/sessions", label: "Sessões", exact: false, icon: PresentationIcon },
  { href: "/dashboard/pesquisas", label: "Pesquisas", exact: false, icon: ClipboardIcon },
  { href: "/dashboard/biblioteca", label: "Biblioteca", exact: false, icon: LibraryIcon },
  { href: "/dashboard/analytics", label: "Evolução", exact: true, icon: TrendingUpIcon },
  { href: "/dashboard/guia", label: "Guia", exact: true, icon: BookIcon },
];

const linkClass = (active: boolean) =>
  cn(
    "flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
    active ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );

/** Navegação do painel: barra lateral no desktop, menu recolhível no celular. */
export function DashboardSidebar({
  name,
  email,
  avatarUrl,
}: {
  name: string | null;
  email: string;
  avatarUrl: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string, exact: boolean) => (exact ? pathname === href : pathname.startsWith(href));
  const close = () => setOpen(false);

  return (
    <aside className="border-b bg-background md:sticky md:top-0 md:flex md:h-dvh md:w-72 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-5 md:py-5">
        <Logo href="/dashboard" />
        <button
          type="button"
          className="grid size-10 place-items-center rounded-md text-muted-foreground hover:bg-muted md:hidden"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          aria-controls="dashboard-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <XIcon width={20} height={20} /> : <MenuIcon width={20} height={20} />}
        </button>
      </div>

      <div id="dashboard-nav" className={cn("flex-1 flex-col gap-6 overflow-y-auto px-3 pb-4 md:flex md:px-4", open ? "flex" : "hidden")}>
        <Link href="/dashboard/sessions/new" onClick={close} className={buttonVariants({ className: "w-full" })}>
          <PlusIcon /> Nova sessão
        </Link>

        <nav aria-label="Navegação principal" className="flex flex-col gap-0.5">
          {LINKS.map((link) => {
            const active = isActive(link.href, link.exact);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                aria-current={active ? "page" : undefined}
                className={linkClass(active)}
              >
                <link.icon className={active ? "text-primary" : undefined} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-0.5 border-t pt-4">
          <Link
            href="/dashboard/conta"
            onClick={close}
            aria-current={isActive("/dashboard/conta", false) ? "page" : undefined}
            className={linkClass(isActive("/dashboard/conta", false))}
          >
            <SettingsIcon className={isActive("/dashboard/conta", false) ? "text-primary" : undefined} />
            Configurações
          </Link>
          <div className="flex items-center gap-2 px-1 pt-2">
            <Link href="/dashboard/conta" onClick={close} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md p-2 hover:bg-muted">
              <Avatar src={avatarUrl} name={name} email={email} size={30} />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-sm font-medium">{name ?? email}</span>
                <span className="truncate text-xs text-muted-foreground">Perfil e conta</span>
              </span>
            </Link>
            <ThemeToggle />
            <form action={signOutAction}>
              <button
                type="submit"
                aria-label="Sair"
                title="Sair"
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
