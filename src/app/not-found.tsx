import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="text-muted-foreground">O link pode estar incorreto ou a sessão foi removida.</p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        Voltar ao início
      </Link>
    </main>
  );
}
