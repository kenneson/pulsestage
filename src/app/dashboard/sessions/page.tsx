import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listOwnedSessions } from "@/lib/data/sessions";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { SessionList } from "@/components/sessions/session-list";
import { PlusIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Sessões" };

export default async function SessionsPage() {
  const supabase = await createClient();
  const sessions = await listOwnedSessions(supabase);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Sessões</h1>
        <Link href="/dashboard/sessions/new" className={buttonVariants()}>
          <PlusIcon /> Nova sessão
        </Link>
      </div>
      {sessions.length === 0 ? (
        <EmptyState title="Nenhuma sessão" description="Suas palestras, aulas e workshops aparecem aqui." />
      ) : (
        <SessionList sessions={sessions} />
      )}
    </div>
  );
}
