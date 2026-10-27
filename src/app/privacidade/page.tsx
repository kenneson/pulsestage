import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { localeAlternates, ogLocale } from "@/i18n/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.meta");
  const [alternates, locale] = await Promise.all([localeAlternates("/privacidade"), ogLocale()]);
  return {
    title: t("title"),
    description: t("description"),
    alternates,
    openGraph: { type: "website", siteName: "PulseStage", title: t("title"), description: t("description"), locale },
  };
}

// Mantenha este texto alinhado ao código: cookies em lib/participant/token.ts (e NEXT_LOCALE em i18n/cookie.ts),
// ps_signup_tz em features/auth/actions.ts, contatos em participant_contacts (seção 0.4 da spec), hash do IP em
// lib/request-ip.ts (pesquisa anônima, código errado, convites), ensaio em features/sessions/actions.ts, entrada da
// IA em lib/ai/build-input.ts e perfil público/convites em lib/data/speaker-profile.ts e
// features/speaker-profile/actions.ts; assistentes (MCP) em lib/mcp/;
// equipes em features/teams/, marca em features/account/actions.ts (bucket brand) e suplemento em app/office/.
// Textos nos três idiomas em messages/<idioma>/legal.json.

// Data da última mudança do texto (formatada no idioma de quem lê).
const UPDATED_AT = new Date("2026-10-27T12:00:00Z");

const b = (chunks: React.ReactNode) => <strong className="text-foreground">{chunks}</strong>;
const code = (chunks: React.ReactNode) => <code>{chunks}</code>;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

const PARTICIPANT_ITEMS = ["name", "avatar", "team", "raffle", "answers", "questions", "reactions", "contact"] as const;
const COOKIE_ITEMS = ["participation", "feedback", "login", "signupTimeZone", "language", "theme"] as const;

export default async function PrivacyPage() {
  const t = await getTranslations("legal");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-5 py-8 max-md:px-4 max-md:pb-[max(env(safe-area-inset-bottom),2rem)]">
      <div className="flex items-center justify-between gap-4">
        <Logo />
        <LocaleSwitcher compact />
      </div>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("updated", { date: UPDATED_AT })}</p>
      </div>

      <div className="flex flex-col gap-8 text-muted-foreground [&_li]:ml-5 [&_li]:list-disc">
        <p>{t("intro")}</p>

        <Section title={t("controller.title")}>
          <p>{t("controller.text")}</p>
        </Section>

        <Section title={t("participants.title")}>
          <ul className="flex flex-col gap-1">
            {PARTICIPANT_ITEMS.map((item) => (
              <li key={item}>{t.rich(`participants.${item}`, { b })}</li>
            ))}
          </ul>
          <p>{t("participants.joinEarly")}</p>
          <p>{t("participants.noTracking")}</p>
        </Section>

        <Section title={t("speakers.title")}>
          <p>{t("speakers.account")}</p>
          <p>{t("speakers.slides")}</p>
          <p>{t("speakers.optionImages")}</p>
          <p>{t("speakers.brand")}</p>
          <p>{t("speakers.powerpoint")}</p>
          <p>{t.rich("speakers.publicProfile", { b })}</p>
        </Section>

        <Section title={t("invites.title")}>
          <p id="convites" className="scroll-mt-6">
            {t("invites.text")}
          </p>
        </Section>

        <Section title={t("moderation.title")}>
          <p>{t("moderation.text")}</p>
        </Section>

        <Section title={t("abuse.title")}>
          <p id="ip" className="scroll-mt-6">
            {t("abuse.text")}
          </p>
        </Section>

        <Section title={t("rehearsal.title")}>
          <p>{t("rehearsal.text")}</p>
        </Section>

        <Section title={t("cookies.title")}>
          <ul className="flex flex-col gap-1">
            {COOKIE_ITEMS.map((item) => (
              <li key={item}>{t.rich(`cookies.${item}`, { b, code })}</li>
            ))}
          </ul>
          <p>{t("cookies.necessary")}</p>
        </Section>

        <Section title={t("assistants.title")}>
          <p id="assistentes" className="scroll-mt-6">
            {t("assistants.text")}
          </p>
        </Section>

        <Section title={t("sharing.title")}>
          <ul className="flex flex-col gap-1">
            <li>{t.rich("sharing.infrastructure", { b })}</li>
            <li>{t.rich("sharing.ai", { b })}</li>
          </ul>
        </Section>

        <Section title={t("retention.title")}>
          <p>{t("retention.text")}</p>
        </Section>

        <Section title={t("rights.title")}>
          <p>{t("rights.text")}</p>
        </Section>
      </div>
    </main>
  );
}
