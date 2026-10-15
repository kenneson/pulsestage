import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { PlusIcon } from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("guide");
  return { title: t("metaTitle") };
}

// Manual de uso. Os nomes entre aspas são os rótulos reais dos botões: ao renomear um botão, atualize aqui
// e em messages/<idioma>/guide.json (nos três idiomas, com o texto da mesma chave do rótulo).

// Ordem das seções: a numeração sai daqui (as seções sem número ficam no fim). Os ids são as âncoras da página
// (o painel aponta para #ao-vivo).
const SECTIONS = [
  { id: "criar", key: "create", numbered: true },
  { id: "idiomas", key: "languages", numbered: true },
  { id: "roteiro", key: "lineup", numbered: true },
  { id: "slides", key: "slides", numbered: true },
  { id: "ao-vivo", key: "live", numbered: true },
  { id: "participantes", key: "audience", numbered: true },
  { id: "participacao", key: "engagement", numbered: true },
  { id: "encerrar", key: "survey", numbered: true },
  { id: "sorteio", key: "raffle", numbered: true },
  { id: "analytics", key: "analytics", numbered: true },
  { id: "perfil-publico", key: "publicProfile", numbered: true },
  { id: "assistentes", key: "assistants", numbered: true },
  { id: "dicas", key: "tips", numbered: false },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const CREATE_STEPS = ["newSession", "fields", "joinCode"] as const;
const LANGUAGE_ITEMS = ["dashboard", "public", "session"] as const;
const LINEUP_TYPES = ["poll", "scale", "cloud", "open", "quiz", "ranking"] as const;
const LIVE_STEPS = ["start", "projector", "launch", "deck", "mirror", "results", "addQuestion", "answer", "leaderboard"] as const;
const AUDIENCE_ITEMS = ["join", "active", "once", "contact"] as const;
const ENGAGEMENT_ITEMS = ["qa", "reactions", "profanity", "moderation"] as const;
const RAFFLE_ELIGIBILITY = ["survey", "everyone"] as const;
const ANALYTICS_ITEMS = ["time", "participation", "timeline", "pulse", "results", "scorecard", "survey", "insights"] as const;
const PROFILE_STEPS = ["address", "publish", "sessions"] as const;
const ASSISTANT_STEPS = ["attach", "propose", "create", "upload"] as const;
const TIPS = ["rehearse", "icebreaker", "pace", "qr", "powerpoint", "survey"] as const;

const linkClass = "font-medium text-primary hover:underline";

// Tags usadas nos textos do guia (as que um texto não usa são ignoradas).
const tags = {
  b: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
  em: (chunks: React.ReactNode) => <em>{chunks}</em>,
  code: (chunks: React.ReactNode) => <code>{chunks}</code>,
  kbd: (chunks: React.ReactNode) => <Kbd>{chunks}</Kbd>,
  directory: (chunks: React.ReactNode) => (
    <Link href="/palestrantes" className={linkClass}>
      {chunks}
    </Link>
  ),
  integrations: (chunks: React.ReactNode) => (
    <Link href="/dashboard/integracoes" className={linkClass}>
      {chunks}
    </Link>
  ),
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="flex flex-col gap-3 text-muted-foreground [&_li]:ml-5 [&_ol>li]:list-decimal [&_strong]:text-foreground [&_ul>li]:list-disc">
        {children}
      </div>
    </section>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border bg-muted px-1.5 py-0.5 font-display text-xs text-foreground">{children}</kbd>;
}

export default async function GuidePage() {
  const t = await getTranslations("guide");

  // Título de cada seção, com o número na ordem de SECTIONS.
  const titles = {} as Record<SectionKey, string>;
  let number = 0;
  for (const s of SECTIONS) {
    const title = t(`${s.key}.title`);
    titles[s.key] = s.numbered ? t("numbered", { number: ++number, title }) : title;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Link href="/dashboard/sessions/new" className={buttonVariants()}>
          <PlusIcon /> {t("newSession")}
        </Link>
      </div>

      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        <nav aria-label={t("navLabel")} className="lg:sticky lg:top-24 lg:self-start">
          <ol className="flex flex-col gap-1 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="block rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                  {titles[s.key]}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="flex max-w-3xl flex-col gap-10">
          <Section id="criar" title={titles.create}>
            <ol className="flex flex-col gap-1">
              {CREATE_STEPS.map((k) => (
                <li key={k}>{t.rich(`create.steps.${k}`, tags)}</li>
              ))}
            </ol>
          </Section>

          <Section id="idiomas" title={titles.languages}>
            <p>{t("languages.intro")}</p>
            <ul className="flex flex-col gap-1">
              {LANGUAGE_ITEMS.map((k) => (
                <li key={k}>{t.rich(`languages.items.${k}`, tags)}</li>
              ))}
            </ul>
          </Section>

          <Section id="roteiro" title={titles.lineup}>
            <p>{t("lineup.intro")}</p>
            <ul className="flex flex-col gap-1">
              {LINEUP_TYPES.map((k) => (
                <li key={k}>{t.rich(`lineup.types.${k}`, tags)}</li>
              ))}
            </ul>
            <p>{t.rich("lineup.optionStyle", tags)}</p>
            <p>{t.rich("lineup.tools", tags)}</p>
          </Section>

          <Section id="slides" title={titles.slides}>
            <p>{t.rich("slides.upload", tags)}</p>
            <p>{t.rich("slides.position", tags)}</p>
          </Section>

          <Section id="ao-vivo" title={titles.live}>
            <ol className="flex flex-col gap-1">
              {LIVE_STEPS.map((k) => (
                <li key={k}>{t.rich(`live.steps.${k}`, tags)}</li>
              ))}
            </ol>
            <p>{t.rich("live.pause", tags)}</p>
            <p>{t.rich("live.timer", tags)}</p>
          </Section>

          <Section id="participantes" title={titles.audience}>
            <ul className="flex flex-col gap-1">
              {AUDIENCE_ITEMS.map((k) => (
                <li key={k}>{t(`audience.items.${k}`)}</li>
              ))}
            </ul>
          </Section>

          <Section id="participacao" title={titles.engagement}>
            <p>{t.rich("engagement.intro", tags)}</p>
            <ul className="flex flex-col gap-1">
              {ENGAGEMENT_ITEMS.map((k) => (
                <li key={k}>{t.rich(`engagement.items.${k}`, tags)}</li>
              ))}
            </ul>
          </Section>

          <Section id="encerrar" title={titles.survey}>
            <p>{t.rich("survey.end", tags)}</p>
            <p>{t.rich("survey.template", tags)}</p>
            <p>{t.rich("survey.templates", tags)}</p>
          </Section>

          <Section id="sorteio" title={titles.raffle}>
            <p>{t.rich("raffle.intro", tags)}</p>
            <ul className="flex flex-col gap-1">
              {RAFFLE_ELIGIBILITY.map((k) => (
                <li key={k}>{t.rich(`raffle.eligibility.${k}`, tags)}</li>
              ))}
            </ul>
            <p>{t.rich("raffle.prize", tags)}</p>
            <p>{t.rich("raffle.live", tags)}</p>
            <p>{t.rich("raffle.winners", tags)}</p>
          </Section>

          <Section id="analytics" title={titles.analytics}>
            <p>{t.rich("analytics.intro", tags)}</p>
            <ul className="flex flex-col gap-1">
              {ANALYTICS_ITEMS.map((k) => (
                <li key={k}>{t.rich(`analytics.items.${k}`, tags)}</li>
              ))}
            </ul>
            <p>{t.rich("analytics.evolution", tags)}</p>
          </Section>

          <Section id="perfil-publico" title={titles.publicProfile}>
            <p>{t.rich("publicProfile.intro", tags)}</p>
            <ol className="flex flex-col gap-1">
              {PROFILE_STEPS.map((k) => (
                <li key={k}>{t.rich(`publicProfile.steps.${k}`, tags)}</li>
              ))}
            </ol>
            <p>{t.rich("publicProfile.directory", tags)}</p>
            <p>{t.rich("publicProfile.invites", tags)}</p>
          </Section>

          <Section id="assistentes" title={titles.assistants}>
            <p>{t.rich("assistants.intro", tags)}</p>
            <ol className="flex flex-col gap-1">
              {ASSISTANT_STEPS.map((k) => (
                <li key={k}>{t.rich(`assistants.steps.${k}`, tags)}</li>
              ))}
            </ol>
            <p>{t.rich("assistants.more", tags)}</p>
          </Section>

          <Section id="dicas" title={titles.tips}>
            <ul className="flex flex-col gap-1">
              {TIPS.map((k) => (
                <li key={k}>{t.rich(`tips.items.${k}`, tags)}</li>
              ))}
            </ul>
          </Section>
        </article>
      </div>
    </div>
  );
}
