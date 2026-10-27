import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findSessionByCode } from "@/lib/data/public";
import { getParticipantIdFromCookie } from "@/lib/participant/token";
import { normalizeJoinCode } from "@/lib/domain/session";
import { SessionIntl } from "@/i18n/session-intl";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { JoinCodeForm } from "@/components/join-code-form";
import { JoinForm } from "@/components/participant/join-form";
import { getJoinTeams } from "@/lib/data/participant-teams";

// Uma leitura por requisição, compartilhada entre os metadados e a página.
const loadSession = cache(async (rawCode: string) => {
  const code = normalizeJoinCode(decodeURIComponent(rawCode));
  const session = code ? await findSessionByCode(createAdminClient(), code) : null;
  return { code, session };
});

// Sessão encontrada: idioma da sessão (o mesmo do telão). Não encontrada: idioma da requisição.
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { session } = await loadSession((await params).code);
  const t = await getTranslations({ locale: session?.locale ?? (await getLocale()), namespace: "participant.joinCode" });
  return { title: t("metaTitle"), robots: { index: false } };
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    // Espaços menores no celular: o botão "Participar" precisa caber sem rolar (375×667).
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-5 py-5 max-md:px-4 max-md:pb-[max(env(safe-area-inset-bottom),1.25rem)] max-md:pt-[max(env(safe-area-inset-top),1.25rem)] sm:gap-8 sm:py-8">
      {/* Sem link: quem chegou pelo QR não deve sair da sessão por um toque na marca. */}
      <Logo href={null} />
      <div className="flex flex-1 flex-col justify-center gap-5 sm:gap-6">{children}</div>
    </main>
  );
}

export default async function JoinCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code, session } = await loadSession((await params).code);

  if (!session) {
    const t = await getTranslations("participant.joinCode");
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">{t("notFoundTitle")}</h1>
        <p className="text-muted-foreground">{t("notFoundText")}</p>
        <JoinCodeForm defaultValue={code} />
      </Shell>
    );
  }

  const t = await getTranslations({ locale: session.locale, namespace: "participant.joinCode" });

  if (session.status === "completed") {
    return (
      <SessionIntl locale={session.locale}>
        <Shell>
          <h1 className="text-2xl font-semibold">{session.title}</h1>
          <p className="text-muted-foreground">{t("endedText")}</p>
          <Link href={`/feedback/${session.id}`} className={buttonVariants({ size: "xl" })}>
            {t("rateSession")}
          </Link>
        </Shell>
      </SessionIntl>
    );
  }

  if (await getParticipantIdFromCookie(session.id)) redirect(`/session/${session.id}/participate`);
  // Equipes: a pessoa escolhe a sua (sem escolha, o servidor põe na menor).
  const teams = await getJoinTeams(createAdminClient(), session.id);

  return (
    <SessionIntl locale={session.locale}>
      <Shell>
        <div>
          <p className="text-sm font-medium text-primary">{t("code", { code: session.joinCode })}</p>
          <h1 className="mt-1 text-2xl font-semibold max-md:text-balance">{session.title}</h1>
          {/* Rascunho: já dá para entrar; a tela do celular espera o início sozinha. */}
          {session.status === "draft" ? <p className="mt-2 text-sm text-muted-foreground">{t("notStarted")}</p> : null}
        </div>
        <JoinForm code={session.joinCode} teams={teams} />
      </Shell>
    </SessionIntl>
  );
}
