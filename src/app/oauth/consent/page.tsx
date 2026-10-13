import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  approveAuthorizationAction,
  denyAuthorizationAction,
  switchAccountAction,
} from "@/features/integrations/actions";
import { Logo } from "@/components/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { CheckIcon, LockIcon, XIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Conectar assistente", robots: { index: false } };

type Props = { searchParams: Promise<{ authorization_id?: string | string[]; erro?: string | string[] }> };

const CAN = [
  "Ver suas sessões, roteiros e os resultados delas (votos, médias, respostas abertas e comentários da pesquisa)",
  "Criar sessões e criar, editar, mover e excluir perguntas",
];
const CANNOT = [
  "Ver nomes, e-mails ou telefones de quem participou",
  "Iniciar, pausar ou encerrar uma sessão ao vivo",
  "Excluir sessões ou mexer na sua conta",
];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 py-10">
      <Logo />
      <div className="flex flex-col gap-5 rounded-md bg-card p-6 shadow-[0_18px_40px_-26px_color-mix(in_oklch,var(--foreground)_35%,transparent)] dark:border">
        {children}
      </div>
    </main>
  );
}

function hostOf(uri: string): string {
  try {
    return new URL(uri).host || uri;
  } catch {
    return uri;
  }
}

/** Tela de consentimento do servidor OAuth do Supabase (Authentication → OAuth Server → /oauth/consent). */
export default async function ConsentPage({ searchParams }: Props) {
  const params = await searchParams;
  const authorizationId = typeof params.authorization_id === "string" ? params.authorization_id.slice(0, 200) : null;

  if (!authorizationId || params.erro) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">Não foi possível conectar</h1>
        <p className="text-sm text-muted-foreground">
          {params.erro === "expirado"
            ? "O pedido de conexão expirou ou já foi usado."
            : "O link de conexão está incompleto."}{" "}
          Volte ao assistente (Claude, ChatGPT ou outro) e peça para conectar o PulseStage de novo.
        </p>
        <Link href="/dashboard/integracoes" className={buttonVariants({ variant: "outline" })}>
          Ver como conectar
        </Link>
      </Shell>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`)}`);

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data) redirect("/oauth/consent?erro=expirado");
  // Já autorizado antes: o Supabase devolve direto o endereço de volta.
  if (!("authorization_id" in data)) redirect(data.redirect_url);

  const clientName = data.client.name || "Um assistente de IA";

  return (
    <Shell>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">Conectar ao PulseStage</p>
        <h1 className="text-balance font-display text-2xl font-bold tracking-tight">
          {clientName} quer acessar sua conta
        </h1>
        <p className="text-sm text-muted-foreground">
          Ele vai agir como <strong className="text-foreground">{user.email}</strong> e volta para{" "}
          <span className="font-medium text-foreground">{hostOf(data.redirect_uri)}</span> depois.
        </p>
      </div>

      <div className="flex flex-col gap-3 text-sm">
        <p className="font-medium">Pelas ferramentas do PulseStage, poderá:</p>
        <ul className="flex flex-col gap-2">
          {CAN.map((item) => (
            <li key={item} className="flex gap-2">
              <CheckIcon className="mt-0.5 shrink-0 text-primary" /> {item}
            </li>
          ))}
        </ul>
        <p className="font-medium">As ferramentas não permitem:</p>
        <ul className="flex flex-col gap-2 text-muted-foreground">
          {CANNOT.map((item) => (
            <li key={item} className="flex gap-2">
              <XIcon className="mt-0.5 shrink-0" /> {item}
            </li>
          ))}
        </ul>
      </div>

      <p className="flex gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        <LockIcon className="mt-0.5 shrink-0" />
        Só permita se foi você quem pediu agora e se confia neste aplicativo: ele recebe um acesso à sua conta. Dá para
        revogar quando quiser em Integrações, no painel.
      </p>

      <div className="flex flex-wrap gap-2">
        <form action={approveAuthorizationAction} className="flex-1">
          <input type="hidden" name="authorization_id" value={data.authorization_id} />
          <Button type="submit" className="w-full">
            Permitir acesso
          </Button>
        </form>
        <form action={denyAuthorizationAction} className="flex-1">
          <input type="hidden" name="authorization_id" value={data.authorization_id} />
          <Button type="submit" variant="outline" className="w-full">
            Cancelar
          </Button>
        </form>
      </div>

      <form action={switchAccountAction} className="text-center text-xs text-muted-foreground">
        <input type="hidden" name="authorization_id" value={data.authorization_id} />
        Não é você?{" "}
        <button type="submit" className="underline hover:text-foreground">
          Entrar com outra conta
        </button>
      </form>
    </Shell>
  );
}
