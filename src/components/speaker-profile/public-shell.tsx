import Link from "next/link";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { buttonVariants } from "@/components/ui/button";

/** Cabeçalho e rodapé das páginas públicas de palestrantes (perfil e diretório). */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Logo />
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link href="/palestrantes" className={cn(buttonVariants({ variant: "ghost" }), "hidden sm:inline-flex")}>
              Palestrantes
            </Link>
            <ThemeToggle />
            <Link href="/signup" className={buttonVariants({ variant: "outline" })}>
              Sou palestrante
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground md:px-6">
          <span>PulseStage · interação ao vivo para palestras e aulas</span>
          <span className="flex gap-4">
            <Link href="/palestrantes" className="underline-offset-4 hover:text-foreground hover:underline">
              Diretório
            </Link>
            <Link href="/privacidade" className="underline-offset-4 hover:text-foreground hover:underline">
              Privacidade
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
