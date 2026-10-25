import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { normalizeJoinCode } from "@/lib/domain/session";
import { localeAlternates } from "@/i18n/seo";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { JoinCodeForm } from "@/components/join-code-form";

// Ainda não há sessão: a página fala o idioma da requisição (prefixo, cookie ou navegador).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("participant.join");
  return { title: t("metaTitle"), alternates: await localeAlternates("/join") };
}

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const normalized = code ? normalizeJoinCode(code) : "";
  if (normalized) redirect(`/join/${normalized}`);

  const t = await getTranslations("participant.join");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-5 max-md:px-4 max-md:py-[max(env(safe-area-inset-bottom),1.5rem)]">
      <div className="flex items-center gap-3">
        <Logo />
        <LocaleSwitcher compact />
      </div>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-center text-muted-foreground">{t("description")}</p>
      <JoinCodeForm />
    </main>
  );
}
