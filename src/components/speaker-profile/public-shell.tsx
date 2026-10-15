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
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Logo href={href("/")} />
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link href={href("/palestrantes")} className={cn(buttonVariants({ variant: "ghost" }), "hidden sm:inline-flex")}>
              {t("speakers")}
            </Link>
            <LocaleSwitcher compact />
            <ThemeToggle />
            <Link href={href("/signup")} className={buttonVariants({ variant: "outline" })}>
              {t("imSpeaker")}
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground md:px-6">
          <span>{t("tagline")}</span>
          <span className="flex gap-4">
            <Link href={href("/palestrantes")} className="underline-offset-4 hover:text-foreground hover:underline">
              {t("directory")}
            </Link>
            <Link href={href("/privacidade")} className="underline-offset-4 hover:text-foreground hover:underline">
              {t("privacy")}
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
