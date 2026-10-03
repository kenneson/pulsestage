import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadLibrary } from "@/lib/data/library";
import { listOwnedSessions } from "@/lib/data/sessions";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { LibraryTable } from "@/components/library/library-table";
import { PlusIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Biblioteca de perguntas" };

export default async function LibraryPage() {
  const supabase = await createClient();
  const [items, sessions] = await Promise.all([loadLibrary(supabase), listOwnedSessions(supabase)]);
  const openSessions = sessions.filter((s) => s.status !== "completed").map((s) => ({ id: s.id, title: s.title }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">Biblioteca de perguntas</h1>
          <p className="text-muted-foreground">
            Toda pergunta que você cria fica aqui, uma vez só mesmo que apareça em várias sessões. Reaproveite com um
            clique.
          </p>
        </div>
        <Link href="/dashboard/sessions/new" className={buttonVariants()}>
          <PlusIcon /> Nova sessão
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="Sua biblioteca está vazia"
          description="As perguntas aparecem aqui assim que você as cria em uma sessão."
          action={
            <Link href="/dashboard/sessions/new" className={buttonVariants({ variant: "outline" })}>
              Criar sessão
            </Link>
          }
        />
      ) : (
        <LibraryTable items={items} sessions={openSessions} />
      )}
    </div>
  );
}
