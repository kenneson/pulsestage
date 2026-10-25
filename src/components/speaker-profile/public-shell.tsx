import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getPublicHref } from "@/i18n/seo";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { buttonVariants } from "@/components/ui/button";

/** Cabeçalho e rodapé das páginas públicas de palestrantes (perfil e diretório). */
export async function PublicShell({ children }: { children: React.ReactNode }) {
  const [t, href] = await Promise.all([getTranslations("profile.shell"), getPublicHref()]);
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 max-sm:gap-2 md:px-6">
          <Logo href={href("/")} className="shrink-0" />
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link href={href("/palestrantes")} className={cn(buttonVariants({ variant: "ghost" }), "hidden sm:inline-flex")}>
              {t("speakers")}
            </Link>
            {/* No celular o idioma desce para o rodapé: marca, tema e "Sou palestrante" cabem em 360 px. */}
            <LocaleSwitcher compact className="max-sm:hidden" />
            <ThemeToggle />
            <Link href={href("/signup")} className={cn(buttonVariants({ variant: "outline" }), "max-sm:px-3")}>
              {t("imSpeaker")}
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground max-sm:pb-[max(env(safe-area-inset-bottom),1.5rem)] md:px-6">
          <span>{t("tagline")}</span>
          <span className="flex gap-4 max-sm:w-full max-sm:items-center">
            <Link href={href("/palestrantes")} className="underline-offset-4 hover:text-foreground hover:underline max-sm:py-3">
              {t("directory")}
            </Link>
            <Link href={href("/privacidade")} className="underline-offset-4 hover:text-foreground hover:underline max-sm:py-3">
              {t("privacy")}
            </Link>
            <LocaleSwitcher compact className="ml-auto sm:hidden" />
          </span>
        </div>
      </footer>
    </div>
  );
}
