import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { StageDemo } from "@/components/landing/stage-demo";
import { JoinCodeForm } from "@/components/join-code-form";
import { ShapeGlyph, shapeBg } from "@/components/option-shape";
import { CheckIcon } from "@/components/icons";
import { MAX_PARTICIPANTS_PER_SESSION } from "@/lib/domain/session";
import { formatInt, formatScore } from "@/lib/format";
import { IntlProvider } from "@/i18n/provider";
import { getPublicHref, localeAlternates, ogLocale } from "@/i18n/seo";

// Textos em messages/<idioma>/landing.json; aqui ficam só a ordem, as cores e os dados simulados.

const STEPS = ["create", "join", "learn"] as const;

// Cada tipo de pergunta tem a sua cor em todo o produto (papel de revisão do roteiro).
const QUESTION_TYPES = [
  { paper: "bg-rev-blue", type: "multiple_choice" },
  { paper: "bg-rev-pink", type: "rating" },
  { paper: "bg-rev-yellow", type: "word_cloud" },
  { paper: "bg-rev-green", type: "open_text" },
  { paper: "bg-rev-gold", type: "quiz" },
  { paper: "bg-rev-violet", type: "ranking" },
] as const;

// Recursos que valem a sessão inteira, fora do roteiro.
const AUDIENCE_TOOLS = ["questions", "reactions", "safe"] as const;

const HERO_FACTS = ["qr", "slides", "quiz"] as const;

// Uma faixa de deck: slides (escuros, como no telão) e perguntas no papel do seu tipo.
type DeckText = "opening" | "whatChanges" | "inPractice" | "risks" | "nextSteps" | "thanks";
const DECK: (
  | { kind: "slide"; n: number; title: DeckText }
  | { kind: "question"; paper: string; type: "poll" | "cloud" | "quiz" }
)[] = [
  { kind: "slide", n: 1, title: "opening" },
  { kind: "question", paper: "bg-rev-blue", type: "poll" },
  { kind: "slide", n: 2, title: "whatChanges" },
  { kind: "slide", n: 3, title: "inPractice" },
  { kind: "question", paper: "bg-rev-yellow", type: "cloud" },
  { kind: "slide", n: 4, title: "risks" },
  { kind: "question", paper: "bg-rev-gold", type: "quiz" },
  { kind: "slide", n: 5, title: "nextSteps" },
  { kind: "slide", n: 6, title: "thanks" },
];

const SLIDE_POINTS = ["pdf", "drag", "clicker", "live"] as const;

const GAME_POINTS = ["avatars", "shapes", "speed", "leaderboard", "raffle", "survey"] as const;

const QUIZ_TILES = ["GPT", "Excel", "Linux", "HTML"];

const RANKING = [
  { avatar: "🦉", name: "Carla", points: 1950, move: "↑2" },
  { avatar: "🦊", name: "Ana", points: 1820, move: "↓1" },
  { avatar: "🐼", name: "Bruno", points: 1610, move: "↓1" },
];

// Exemplo ilustrativo (dados simulados) do relatório depois da sessão.
const PULSE = [
  { minute: 0, rate: 0.82 },
  { minute: 12, rate: 0.91 },
  { minute: 25, rate: 0.58 },
  { minute: 40, rate: 0.66 },
  { minute: 52, rate: 0.74 },
];

const NOTES: { id: "cloud" | "quiz" | "comments"; confidence: "high" | "medium" | "low"; sample: { kind: "responses" | "comments"; count: number } }[] = [
  { id: "cloud", confidence: "high", sample: { kind: "responses", count: 64 } },
  { id: "quiz", confidence: "medium", sample: { kind: "responses", count: 22 } },
  { id: "comments", confidence: "low", sample: { kind: "comments", count: 3 } },
];

const SCORECARD = [
  { dimension: "utilidade", value: 8.6, scale: "/10" },
  { dimension: "clareza", value: 4.4, scale: "/5" },
  { dimension: "engajamento", value: 4.1, scale: "/5" },
  { dimension: "conteudo", value: 4.5, scale: "/5" },
  { dimension: "aplicabilidade", value: 3.9, scale: "/5" },
] as const;

const AUDIENCES = ["universities", "schools", "companies", "events"] as const;

// Conversa de exemplo da seção de IA (dados simulados, rotulados).
const AI_PLAN = [
  { slide: 2, paper: "bg-rev-yellow", type: "word_cloud", text: "cloud" },
  { slide: 7, paper: "bg-rev-gold", type: "quiz", text: "quiz" },
  { slide: 12, paper: "bg-rev-pink", type: "rating", text: "scale" },
  { slide: null, paper: "bg-rev-green", type: "open_text", text: "open" },
] as const;

const AI_POINTS = ["slides", "placement", "approval", "analysis"] as const;

const FAQ = ["app", "price", "slides", "raffle", "questions", "schools", "assistants", "capacity", "export", "data"] as const;

function SectionHeading({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="reveal flex max-w-2xl flex-col gap-4">
      <h2 className="font-display text-[clamp(1.8rem,3.2vw,2.75rem)] font-bold leading-[1.08] tracking-[-0.02em] text-balance">
        {title}
      </h2>
      <p className="text-lg leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-grid min-w-7 place-items-center rounded border bg-card px-1.5 pb-0.5 font-display text-sm font-bold text-foreground shadow-[inset_0_-2px_0_var(--border)]">
      {children}
    </kbd>
  );
}

/** Posição da linha na entrada em sequência do hero (ver .script-line em globals.css). */
const line = (n: number) => ({ "--line": n }) as React.CSSProperties;

/** Escalona itens lado a lado na revelação por rolagem (ver .reveal em globals.css). */
const stagger = (i: number) => ({ "--i": i }) as React.CSSProperties;

const paperShadow = "shadow-[0_24px_48px_-32px_color-mix(in_oklch,var(--foreground)_40%,transparent)]";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing.meta");
  const [alternates, locale] = await Promise.all([localeAlternates("/"), ogLocale()]);
  return {
    title: { absolute: t("title") },
    description: t("description"),
    alternates,
    openGraph: { type: "website", siteName: "PulseStage", title: t("title"), description: t("description"), locale },
  };
}

export default async function Home() {
  const [t, tDomain, locale, href] = await Promise.all([
    getTranslations("landing"),
    getTranslations("domain"),
    getLocale(),
    getPublicHref(),
  ]);
  const maxParticipants = formatInt(MAX_PARTICIPANTS_PER_SESSION, locale);
  // Fatos do produto (limites e recursos), não números de uso.
  const productFacts = [
    { value: formatInt(0, locale), text: t("facts.apps") },
    { value: maxParticipants, text: t("facts.participants") },
    { value: formatInt(6, locale), text: t("facts.types") },
    { value: formatInt(1, locale), text: t("facts.screen") },
  ];
  const chartValues = new Intl.ListFormat(locale, { type: "conjunction" }).format(PULSE.map((p) => `${Math.round(p.rate * 100)}%`));
  const chartMax = 60;
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="site-header sticky top-0 z-30">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <Logo />
          <nav className="flex items-center gap-1 sm:gap-2">
            <a href="#como-funciona" className={cn(buttonVariants({ variant: "ghost" }), "hidden md:inline-flex")}>
              {t("nav.howItWorks")}
            </a>
            <a href="#recursos" className={cn(buttonVariants({ variant: "ghost" }), "hidden md:inline-flex")}>
              {t("nav.features")}
            </a>
            <a href="#ia" className={cn(buttonVariants({ variant: "ghost" }), "hidden lg:inline-flex")}>
              {t("nav.withAi")}
            </a>
            <Link href={href("/palestrantes")} className={cn(buttonVariants({ variant: "ghost" }), "hidden md:inline-flex")}>
              {t("nav.speakers")}
            </Link>
            <LocaleSwitcher compact />
            <ThemeToggle />
            <Link href={href("/login")} className={buttonVariants({ variant: "ghost" })}>
              {t("nav.signIn")}
            </Link>
            <Link href={href("/signup")} className={cn(buttonVariants(), "hidden sm:inline-flex")}>
              {t("nav.signUp")}
            </Link>
          </nav>
        </header>
      </div>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:px-6 md:pb-20">
          <div className="flex flex-col gap-10 rounded-sm bg-card p-6 text-card-foreground shadow-[0_24px_48px_-28px_color-mix(in_oklch,var(--foreground)_35%,transparent)] dark:border sm:p-10 lg:gap-14 lg:p-14">
            <h1
              className="script-line max-w-5xl text-balance font-display text-[clamp(2.4rem,5.6vw,5rem)] font-extrabold leading-[1.02] tracking-[-0.025em]"
              style={line(0)}
            >
              {t.rich("hero.title", {
                mark: (chunks) => (
                  <mark className="highlighter box-decoration-clone rounded-md px-1.5 text-highlight-foreground">{chunks}</mark>
                ),
              })}
            </h1>

            <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:gap-14">
              <div className="flex flex-col gap-6">
                <p className="script-line max-w-[58ch] text-lg leading-relaxed text-muted-foreground" style={line(1)}>
                  {t("hero.lead")}
                </p>
                <div className="script-line flex flex-wrap items-center gap-x-5 gap-y-3" style={line(2)}>
                  <Link href={href("/signup")} className={buttonVariants({ size: "lg" })}>
                    {t("hero.cta")}
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    {t.rich("hero.beta", {
                      link: (chunks) => (
                        <Link href={href("/login")} className="font-medium text-foreground underline-offset-4 hover:underline">
                          {chunks}
                        </Link>
                      ),
                    })}
                  </span>
                </div>
              </div>
              <ul className="script-line flex flex-col gap-2.5" style={line(3)}>
                {HERO_FACTS.map((fact) => (
                  <li key={fact} className="flex items-start gap-2.5">
                    <CheckIcon className="mt-1 shrink-0 text-primary" />
                    <span>{t(`hero.facts.${fact}`)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="slide-in-right mx-auto w-full max-w-4xl">
              {/* A área landing não vai ao navegador por padrão: o palco (cliente) recebe só o que usa. */}
              <IntlProvider namespaces={["common", "domain", "landing"]}>
                <StageDemo />
              </IntlProvider>
            </div>

            <div className="script-line flex flex-col gap-3 border-t border-dashed pt-6 sm:flex-row sm:items-center sm:justify-between" style={line(4)}>
              <p className="text-sm font-medium">{t("hero.joinPrompt")}</p>
              <div className="w-full sm:max-w-sm">
                <JoinCodeForm />
              </div>
            </div>
          </div>
        </section>

        {/* Fatos do produto. */}
        <section aria-label={t("facts.ariaLabel")} className="mx-auto w-full max-w-6xl px-4 pb-16 md:px-6 md:pb-20">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
            {productFacts.map((fact, index) => (
              <div key={fact.text} className="reveal flex flex-col gap-1 border-t-2 border-foreground pt-4" style={stagger(index)}>
                <dt className="sr-only">{fact.text}</dt>
                <dd className="font-display text-[clamp(2.4rem,5vw,3.75rem)] font-bold leading-none tabular-nums">{fact.value}</dd>
                <dd className="text-muted-foreground">{fact.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Como funciona: três passos (a ordem importa). */}
        <section id="como-funciona" className="border-t">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-20 md:px-6 md:py-24">
            <SectionHeading title={t("steps.title")}>{t("steps.lead")}</SectionHeading>
            <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
              {STEPS.map((step, index) => (
                <li key={step} className="reveal flex flex-col gap-3 border-t-2 border-foreground pt-5" style={stagger(index)}>
                  <span className="font-display text-5xl font-bold leading-none tabular-nums" aria-hidden>
                    {index + 1}
                  </span>
                  <h3 className="text-xl font-semibold">{t(`steps.${step}.title`)}</h3>
                  <p className="leading-relaxed text-muted-foreground">{t(`steps.${step}.text`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Tipos de pergunta. */}
        <section className="border-t bg-muted/40">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 md:px-6 md:py-24 lg:grid-cols-[2fr_3fr] lg:gap-16">
            <div className="flex flex-col gap-10">
              <SectionHeading title={t("questionTypes.title")}>{t("questionTypes.lead")}</SectionHeading>
              <dl className="flex flex-col gap-5">
                {AUDIENCE_TOOLS.map((tool, index) => (
                  <div key={tool} className="reveal flex flex-col gap-1 border-t pt-4" style={stagger(index)}>
                    <dt className="font-display text-lg font-bold">{t(`audienceTools.${tool}.title`)}</dt>
                    <dd className="leading-relaxed text-muted-foreground">{t(`audienceTools.${tool}.text`)}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <ol className="flex flex-col">
              {QUESTION_TYPES.map((item, index) => (
                <li
                  key={item.type}
                  className={cn(
                    "reveal-page group relative -mt-2 first:mt-0 rounded-sm px-5 pb-5 pt-4 text-rev-foreground shadow-[0_10px_24px_-18px_color-mix(in_oklch,var(--foreground)_45%,transparent)] transition-transform duration-200 ease-out hover:-translate-y-1 dark:border dark:border-foreground/10",
                    item.paper,
                  )}
                  style={{ marginLeft: `${index * 0.75}rem`, zIndex: QUESTION_TYPES.length - index }}
                >
                  <h3 className="font-display text-xl font-bold">{tDomain(`interactionTypes.${item.type}.label`)}</h3>
                  <p className="mt-1 max-w-[52ch] text-sm leading-relaxed">{t(`questionTypes.${item.type}.text`)}</p>
                  <p className="mt-2 font-display text-sm italic opacity-80">
                    {t("questionTypes.example", { text: t(`questionTypes.${item.type}.example`) })}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Slides e perguntas na mesma sequência. */}
        <section id="recursos" className="border-t">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 md:px-6 md:py-24 lg:grid-cols-[2fr_3fr] lg:gap-16">
            <div className="flex flex-col gap-8">
              <SectionHeading title={t("slides.title")}>{t("slides.lead")}</SectionHeading>
              <ul className="reveal flex flex-col gap-4 leading-relaxed">
                {SLIDE_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-2.5">
                    <CheckIcon className="mt-1 shrink-0 text-primary" />
                    <span>{t(`slides.points.${point}`)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <figure className={cn("reveal flex flex-col gap-6 self-center rounded-sm bg-card p-6 dark:border sm:p-8", paperShadow)}>
              <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label={t("slides.deckLabel")}>
                {DECK.map((item, index) =>
                  item.kind === "slide" ? (
                    <li key={`s${item.n}`} className="flex flex-col gap-1.5">
                      <span className="dark flex aspect-video flex-col justify-between rounded-sm border bg-background p-2 text-foreground">
                        <span className="text-xs font-semibold leading-tight">{t(`slides.deck.${item.title}`)}</span>
                        <span aria-hidden className="flex flex-col gap-1">
                          <span className="h-0.5 w-3/4 rounded-full bg-foreground/30" />
                          <span className="h-0.5 w-1/2 rounded-full bg-foreground/30" />
                        </span>
                      </span>
                      <span className="font-display text-xs text-muted-foreground">{t("slides.slideNumber", { n: item.n })}</span>
                    </li>
                  ) : (
                    <li key={`q${index}`} className="flex flex-col gap-1.5">
                      <span className={cn("flex aspect-video flex-col justify-between rounded-sm p-2 text-rev-foreground", item.paper)}>
                        <span className="font-display text-[0.65rem] font-bold uppercase tracking-wider">
                          {item.type === "poll"
                            ? tDomain("interactionTypes.multiple_choice.label")
                            : item.type === "cloud"
                              ? t("slides.deck.cloudType")
                              : tDomain("interactionTypes.quiz.label")}
                        </span>
                        <span className="text-xs font-medium leading-tight">{t(`slides.deck.${item.type}Question`)}</span>
                      </span>
                      <span className="font-display text-xs text-muted-foreground">{t("slides.question")}</span>
                    </li>
                  ),
                )}
              </ol>
              <figcaption className="flex flex-wrap items-center gap-3 border-t border-dashed pt-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  {t.rich("slides.advance", { kbd: (chunks) => <Kbd>{chunks}</Kbd> })}
                </span>
                <span aria-hidden>·</span>
                <span>{t("slides.reorder")}</span>
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Gamificação e sorteio. */}
        <section className="border-t bg-muted/40">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-20 md:px-6 md:py-24">
            <SectionHeading title={t("game.title")}>{t("game.lead")}</SectionHeading>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Celular: alternativas com forma e cor. */}
              <div className={cn("reveal flex flex-col gap-3 rounded-sm bg-card p-5 dark:border", paperShadow)} style={stagger(0)}>
                <p className="font-semibold leading-snug">{t("game.quizQuestion")}</p>
                <div className="grid grid-cols-2 gap-2" aria-hidden>
                  {QUIZ_TILES.map((label, i) => (
                    <span
                      key={label}
                      className={cn(
                        "flex min-h-14 items-center gap-2 rounded-lg px-3 font-semibold text-white",
                        shapeBg(i),
                        i === 0 && "ring-4 ring-foreground ring-offset-2 ring-offset-card",
                      )}
                    >
                      <ShapeGlyph index={i} className="size-5 text-white" />
                      {label}
                    </span>
                  ))}
                </div>
                <p className="rounded-md bg-primary/15 py-2 text-center text-sm font-semibold text-primary">
                  {t("game.correct", { points: formatInt(950, locale) })}
                </p>
                <p className="mt-auto text-xs text-muted-foreground">{t("game.onPhone")}</p>
              </div>

              {/* Telão: ranking. */}
              <div className="reveal dark flex flex-col gap-3 rounded-sm border bg-background p-5 text-foreground" style={stagger(1)}>
                <p className="text-center text-lg font-semibold">{t("game.leaderboard")}</p>
                <ol className="flex flex-col gap-2">
                  {RANKING.map((r, i) => (
                    <li
                      key={r.name}
                      className={cn("flex items-center gap-3 rounded-md px-3 py-2", i === 0 ? "bg-primary/20" : "bg-muted")}
                    >
                      <span className="w-6 font-display font-bold tabular-nums">{t("game.place", { n: i + 1 })}</span>
                      <span aria-hidden className="text-xl leading-none">
                        {r.avatar}
                      </span>
                      <span className="flex-1 font-semibold">{r.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{r.move}</span>
                      <span className="font-display font-bold tabular-nums">{formatInt(r.points, locale)}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-auto text-xs text-muted-foreground">{t("game.onScreen")}</p>
              </div>

              {/* Sorteio. */}
              <div className="reveal dark flex flex-col items-center gap-3 rounded-sm border bg-background p-5 text-center text-foreground" style={stagger(2)}>
                <p className="text-sm text-muted-foreground">{t("game.drawing", { prize: t("game.prize") })}</p>
                <span className="rounded-xl border-4 border-dashed border-primary px-6 font-display text-6xl font-bold leading-tight text-primary tabular-nums">
                  042
                </span>
                <p className="flex items-center gap-2 text-lg font-semibold">
                  <span aria-hidden className="text-2xl leading-none">
                    🦉
                  </span>
                  {t("game.winner", { name: "Carla" })}
                </p>
                <p className="mt-auto text-xs text-muted-foreground">{t("game.onScreen")}</p>
              </div>
            </div>

            <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {GAME_POINTS.map((point, index) => (
                <div key={point} className="reveal flex flex-col gap-1 border-t pt-4" style={stagger(index % 3)}>
                  <dt className="font-display text-lg font-bold">{t(`game.points.${point}.title`)}</dt>
                  <dd className="leading-relaxed text-muted-foreground">{t(`game.points.${point}.text`)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* IA: Claude, ChatGPT e outros assistentes via MCP. */}
        <section id="ia" className="border-t">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 md:px-6 md:py-24 lg:grid-cols-[5fr_6fr] lg:items-center lg:gap-16">
            <div className="flex flex-col gap-8">
              <SectionHeading title={t("ai.title")}>{t("ai.lead")}</SectionHeading>
              <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                {AI_POINTS.map((point, index) => (
                  <div key={point} className="reveal flex flex-col gap-1 border-t pt-4" style={stagger(index % 2)}>
                    <dt className="font-display text-lg font-bold">{t(`ai.points.${point}.title`)}</dt>
                    <dd className="leading-relaxed text-muted-foreground">{t(`ai.points.${point}.text`)}</dd>
                  </div>
                ))}
              </dl>
              <p className="reveal text-sm text-muted-foreground">{t("ai.compat")}</p>
            </div>

            <figure className={cn("reveal flex flex-col gap-4 rounded-sm bg-card p-5 dark:border sm:p-6", paperShadow)}>
              <div className="ml-auto flex max-w-[85%] flex-col items-end gap-2">
                <span className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
                  <span className="grid size-8 place-items-center rounded-md bg-destructive/15 text-[10px] font-bold text-destructive">
                    PDF
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="font-medium">{t("ai.fileName")}</span>
                    <span className="text-xs text-muted-foreground">{t("ai.pages", { count: 18 })}</span>
                  </span>
                </span>
                <p className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">{t("ai.request")}</p>
              </div>

              <div className="flex max-w-[92%] flex-col gap-3 rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm">
                <p>{t("ai.proposal")}</p>
                <ol className="flex flex-col gap-2">
                  {AI_PLAN.map((item) => (
                    <li key={item.text} className={cn("flex flex-col gap-0.5 rounded-md px-3 py-2 text-rev-foreground", item.paper)}>
                      <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                        {item.slide === null ? t("ai.atEnd") : t("ai.afterSlide", { n: item.slide })} ·{" "}
                        {tDomain(`interactionTypes.${item.type}.label`)}
                      </span>
                      <span className="font-medium leading-snug">{t(`ai.plan.${item.text}`)}</span>
                    </li>
                  ))}
                </ol>
                <p>{t("ai.confirmQuestion")}</p>
              </div>

              <p className="ml-auto rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                {t("ai.confirmAnswer")}
              </p>

              <p className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium">
                <CheckIcon className="text-primary" /> {t("ai.saved", { count: AI_PLAN.length })}
              </p>
              <figcaption className="text-xs text-muted-foreground">{t("ai.caption")}</figcaption>
            </figure>
          </div>
        </section>

        {/* Depois: o relatório. */}
        <section className="border-t">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 md:px-6 md:py-24 lg:grid-cols-[2fr_3fr] lg:gap-16">
            <div className="flex flex-col gap-6">
              <SectionHeading title={t("report.title")}>{t("report.lead")}</SectionHeading>
              <p className="reveal text-sm leading-relaxed text-muted-foreground">{t("report.note")}</p>
            </div>

            <article className={cn("reveal flex flex-col gap-8 rounded-sm bg-card p-6 dark:border sm:p-8", paperShadow)}>
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-4">
                <h3 className="font-display text-lg font-bold uppercase">
                  {t("report.heading", { title: t("report.sampleTitle") })}
                </h3>
                <span className="text-xs text-muted-foreground">{t("report.simulated")}</span>
              </header>

              <figure className="flex flex-col gap-3">
                <figcaption className="text-sm font-semibold">{t("report.chartTitle")}</figcaption>
                <svg
                  viewBox="0 0 300 120"
                  role="img"
                  aria-label={t("report.chartAria", { values: chartValues })}
                  className="h-auto w-full font-display"
                >
                  {[0.25, 0.5, 0.75, 1].map((g) => (
                    <line key={g} x1="0" x2="300" y1={100 - g * 90} y2={100 - g * 90} stroke="var(--border)" strokeWidth="1" />
                  ))}
                  <line x1="0" x2="300" y1="100" y2="100" stroke="var(--foreground)" strokeOpacity="0.35" strokeWidth="1" />
                  {PULSE.map((p) => {
                    const x = 14 + (p.minute / chartMax) * 270;
                    const h = p.rate * 90;
                    const low = p.rate < 0.6;
                    return (
                      <g key={p.minute}>
                        <rect
                          className="reveal-bar"
                          x={x - 9}
                          y={100 - h}
                          width="18"
                          height={h}
                          rx="2"
                          fill={low ? "var(--standby)" : "var(--primary)"}
                        />
                        <text x={x} y={94 - h} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--foreground)">
                          {Math.round(p.rate * 100)}%
                        </text>
                        <text x={x} y="113" textAnchor="middle" fontSize="8" fill="var(--muted-foreground)">
                          {t("report.minute", { minute: p.minute })}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </figure>

              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold">{t("report.suggestions")}</p>
                <ol className="flex flex-col gap-4">
                  {NOTES.map((note, index) => (
                    <li key={note.id} className="grid grid-cols-[1.5rem_1fr] gap-x-2">
                      <span className="font-display font-bold tabular-nums">{index + 1}.</span>
                      <div className="flex flex-col gap-1">
                        <p
                          className={cn(
                            "leading-relaxed underline decoration-2 underline-offset-[6px]",
                            note.confidence === "high" && "decoration-foreground",
                            note.confidence === "medium" && "decoration-foreground/50",
                            note.confidence === "low" && "decoration-foreground/40 decoration-dashed decoration-1",
                          )}
                        >
                          {t(`report.notes.${note.id}`)}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {t(`report.confidence.${note.confidence}`)} · {t(`report.${note.sample.kind}`, { count: note.sample.count })}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex flex-col gap-3 border-t pt-5">
                <p className="text-sm font-semibold">{t("report.rating")}</p>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 xl:grid-cols-5">
                  {SCORECARD.map((s) => (
                    <div key={s.dimension} className="flex flex-col">
                      <dt className="text-xs text-muted-foreground">{tDomain(`dimensions.${s.dimension}`)}</dt>
                      <dd className="font-display text-xl font-bold tabular-nums">
                        {formatScore(s.value, locale)}
                        <span className="text-sm font-normal text-muted-foreground">{s.scale}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </article>
          </div>
        </section>

        {/* Para quem é. */}
        <section className="border-t bg-muted/40">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-20 md:px-6 md:py-24">
            <SectionHeading title={t("audiences.title")}>{t("audiences.lead")}</SectionHeading>
            <dl className="grid gap-10 sm:grid-cols-2 md:gap-8 lg:grid-cols-4">
              {AUDIENCES.map((a, index) => (
                <div key={a} className="reveal flex flex-col gap-2 border-t pt-5" style={stagger(index)}>
                  <dt className="font-display text-xl font-bold">{t(`audiences.${a}.who`)}</dt>
                  <dd className="leading-relaxed text-muted-foreground">{t(`audiences.${a}.text`)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Perguntas frequentes. */}
        <section className="border-t">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 md:px-6 md:py-24 lg:grid-cols-[2fr_3fr] lg:gap-16">
            <SectionHeading title={t("faq.title")}>{t("faq.lead")}</SectionHeading>
            <div className="reveal flex flex-col divide-y rounded-sm bg-card dark:border">
              {FAQ.map((item) => (
                <details key={item} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                    {t(`faq.items.${item}.q`)}
                    <span
                      aria-hidden
                      className="grid size-6 shrink-0 place-items-center rounded-full border text-sm transition-transform duration-200 ease-out group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-[60ch] leading-relaxed text-muted-foreground">
                    {item === "capacity" ? t("faq.items.capacity.a", { max: maxParticipants }) : t(`faq.items.${item}.a`)}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Chamada final: o palco escuro, como o telão. */}
        <section className="dark border-t bg-background text-foreground">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-8 px-4 py-24 md:px-6 md:py-32">
            <h2 className="reveal max-w-4xl font-display text-[clamp(2.6rem,6vw,5.5rem)] font-bold leading-[0.98] tracking-[-0.025em] text-balance">
              {t("cta.title")}
            </h2>
            <p className="reveal max-w-xl text-lg leading-relaxed text-muted-foreground">{t("cta.lead")}</p>
            <div className="reveal flex flex-wrap items-center gap-4">
              <Link href={href("/signup")} className={buttonVariants({ size: "lg" })}>
                {t("cta.primary")}
              </Link>
              <Link href={href("/login")} className={buttonVariants({ size: "lg", variant: "outline" })}>
                {t("cta.signIn")}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground md:px-6">
          <span>{t("footer.tagline")}</span>
          <span className="flex flex-wrap items-center gap-4">
            <Link href={href("/palestrantes")} className="underline-offset-4 hover:text-foreground hover:underline">
              {t("footer.findSpeaker")}
            </Link>
            <Link href={href("/privacidade")} className="underline-offset-4 hover:text-foreground hover:underline">
              {t("footer.privacy")}
            </Link>
            <LocaleSwitcher />
          </span>
        </div>
      </footer>
    </div>
  );
}
