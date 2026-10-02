import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { findSessionByCode } from "@/lib/data/public";
import { getParticipantIdFromCookie } from "@/lib/participant/token";
import { normalizeJoinCode } from "@/lib/domain/session";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { JoinCodeForm } from "@/components/join-code-form";
import { JoinForm } from "@/components/participant/join-form";

export const metadata: Metadata = { title: "Participar", robots: { index: false } };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-5 py-8">
      <Logo />
      <div className="flex flex-1 flex-col justify-center gap-6">{children}</div>
    </main>
  );
}

export default async function JoinCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = normalizeJoinCode(decodeURIComponent(rawCode));
  const session = code ? await findSessionByCode(createAdminClient(), code) : null;

  if (!session) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">Sessão não encontrada</h1>
        <p className="text-muted-foreground">Confira o código na tela do palestrante e tente de novo.</p>
        <JoinCodeForm defaultValue={code} />
      </Shell>
    );
  }

  if (session.status === "completed") {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">{session.title}</h1>
        <p className="text-muted-foreground">Esta sessão já terminou. Que tal deixar sua avaliação?</p>
        <Link href={`/feedback/${session.id}`} className={buttonVariants({ size: "xl" })}>
          Avaliar a sessão
        </Link>
      </Shell>
    );
  }

  if (await getParticipantIdFromCookie(session.id)) redirect(`/session/${session.id}/participate`);

  return (
    <Shell>
      <div>
        <p className="text-sm font-medium text-primary">Código {session.joinCode}</p>
        <h1 className="mt-1 text-2xl font-semibold">{session.title}</h1>
        {session.status === "draft" ? (
          <p className="mt-2 text-muted-foreground">A sessão ainda não começou. Você poderá entrar assim que ela iniciar.</p>
        ) : null}
      </div>
      {session.status !== "draft" ? <JoinForm code={session.joinCode} /> : null}
    </Shell>
  );
}
