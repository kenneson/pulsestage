import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import {
  approveAuthorizationAction,
  denyAuthorizationAction,
  switchAccountAction,
} from "@/features/integrations/actions";
import { Logo } from "@/components/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { CheckIcon, LockIcon, XIcon } from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("integrations.consent");
  return { title: t("metaTitle"), robots: { index: false } };
}

type Props = { searchParams: Promise<{ authorization_id?: string | string[]; erro?: string | string[] }> };

// Chaves de integrations.consent.can / .cannot.
const CAN = ["read", "write"] as const;
const CANNOT = ["personal", "live", "account"] as const;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 py-10 max-md:px-4 max-md:pb-[max(env(safe-area-inset-bottom),2.5rem)] max-md:pt-[max(env(safe-area-inset-top),2.5rem)]">
      <Logo />
      <div className="flex flex-col gap-5 rounded-md bg-card p-6 max-sm:p-5 shadow-[0_18px_40px_-26px_color-mix(in_oklch,var(--foreground)_35%,transparent)] dark:border">
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
  const [t, tActions] = await Promise.all([getTranslations("integrations.consent"), getTranslations("common.actions")]);
  const authorizationId = typeof params.authorization_id === "string" ? params.authorization_id.slice(0, 200) : null;

  if (!authorizationId || params.erro) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">{t("errorTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {params.erro === "expirado" ? t("expired") : t("incomplete")} {t("tryAgain")}
        </p>
        <Link href="/dashboard/integracoes" className={buttonVariants({ variant: "outline" })}>
          {t("howToConnect")}
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

  const clientName = data.client.name || t("unnamedClient");

  return (
    <Shell>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{t("eyebrow")}</p>
        <h1 className="text-balance font-display text-2xl font-bold tracking-tight">
          {t("title", { client: clientName })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t.rich("actsAs", {
            email: user.email ?? "",
            host: hostOf(data.redirect_uri),
            b: (chunks) => <strong className="text-foreground">{chunks}</strong>,
            site: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
          })}
        </p>
      </div>

      <div className="flex flex-col gap-3 text-sm">
        <p className="font-medium">{t("canTitle")}</p>
        <ul className="flex flex-col gap-2">
          {CAN.map((item) => (
            <li key={item} className="flex gap-2">
              <CheckIcon className="mt-0.5 shrink-0 text-primary" /> {t(`can.${item}`)}
            </li>
          ))}
        </ul>
        <p className="font-medium">{t("cannotTitle")}</p>
        <ul className="flex flex-col gap-2 text-muted-foreground">
          {CANNOT.map((item) => (
            <li key={item} className="flex gap-2">
              <XIcon className="mt-0.5 shrink-0" /> {t(`cannot.${item}`)}
            </li>
          ))}
        </ul>
      </div>

      <p className="flex gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        <LockIcon className="mt-0.5 shrink-0" />
        {t("warning")}
      </p>

      {/* Celular: "Permitir" em cima, os dois na largura toda. */}
      <div className="flex flex-wrap gap-2 max-sm:flex-col">
        <form action={approveAuthorizationAction} className="flex-1">
          <input type="hidden" name="authorization_id" value={data.authorization_id} />
          <Button type="submit" className="w-full">
            {t("allow")}
          </Button>
        </form>
        <form action={denyAuthorizationAction} className="flex-1">
          <input type="hidden" name="authorization_id" value={data.authorization_id} />
          <Button type="submit" variant="outline" className="w-full">
            {tActions("cancel")}
          </Button>
        </form>
      </div>

      <form action={switchAccountAction} className="text-center text-xs text-muted-foreground">
        <input type="hidden" name="authorization_id" value={data.authorization_id} />
        {t.rich("notYou", {
          switch: (chunks) => (
            <button type="submit" className="underline hover:text-foreground max-md:py-2.5">
              {chunks}
            </button>
          ),
        })}
      </form>
    </Shell>
  );
}
