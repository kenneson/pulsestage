import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { normalizeJoinCode } from "@/lib/domain/session";
import { Logo } from "@/components/logo";
import { JoinCodeForm } from "@/components/join-code-form";

export const metadata: Metadata = { title: "Entrar numa sessão" };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const normalized = code ? normalizeJoinCode(code) : "";
  if (normalized) redirect(`/join/${normalized}`);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-5">
      <Logo />
      <h1 className="text-2xl font-semibold">Entrar numa sessão</h1>
      <p className="text-center text-muted-foreground">Digite o código que aparece na tela do palestrante.</p>
      <JoinCodeForm />
    </main>
  );
}
