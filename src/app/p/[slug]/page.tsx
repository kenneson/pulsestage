import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getPublicHref, localeAlternates, ogLocale } from "@/i18n/seo";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicProfile } from "@/lib/data/speaker-profile";
import { APP_TIME_ZONE } from "@/lib/datetime";
import { formatInt, formatScore } from "@/lib/format";
import {
  RATING_MIN_PROFILE,
  RATING_MIN_SESSION,
  SLUG_RE,
  topicKey,
  VERIFY_MIN_RESPONDERS,
  VERIFY_MIN_TALK_SECONDS,
} from "@/lib/domain/speaker-profile";
import { audienceRangeText } from "@/i18n/text";
import { Avatar } from "@/components/avatar";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BadgeCheckIcon, ExternalIcon, MapPinIcon, SendIcon } from "@/components/icons";
import { PublicShell } from "@/components/speaker-profile/public-shell";
import { ContactForm } from "@/components/speaker-profile/contact-form";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  if (!SLUG_RE.test(slug)) return null;
  return getPublicProfile(createAdminClient(), slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await load(slug);
  // Inexistente: o Next mostra a página 404 e marca noindex (o status fica 200 pelo streaming do loading.tsx).
  if (!profile) notFound();
  const t = await getTranslations("profile.public");
  const description = profile.headline ?? profile.bio ?? t("metaDescription", { name: profile.name });
  return {
    title: t("metaTitle", { name: profile.name }),
    description,
    alternates: await localeAlternates(`/p/${profile.slug}`),
    // Sem sessão verificada, o perfil existe para quem tem o link, mas não vai para buscadores.
    robots: profile.listed ? undefined : { index: false, follow: false },
    openGraph: { type: "profile", title: profile.name, description, locale: await ogLocale() },
  };
}


function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dd className="font-display text-4xl font-extrabold tabular-nums tracking-tight">{value}</dd>
      <dt className="order-last text-sm text-muted-foreground">{label}</dt>
    </div>
  );
}

export default async function SpeakerProfilePage({ params }: Props) {
  const { slug } = await params;
  const profile = await load(slug);
  if (!profile) notFound();
  const [t, tDomain, locale, href] = await Promise.all([
    getTranslations("profile.public"),
    getTranslations("domain"),
    getLocale(),
    getPublicHref(),
  ]);
  const monthYear = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: APP_TIME_ZONE });
  const fullDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: APP_TIME_ZONE });
  const formats = new Intl.ListFormat(locale, { type: "conjunction" });
  const { stats } = profile;
  const place = [profile.city, profile.state].filter(Boolean).join(" · ");

  return (
    <PublicShell>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 md:px-6 md:py-12">
        <section className="flex flex-col gap-6 rounded-md bg-card p-6 max-sm:gap-5 max-sm:p-5 shadow-[0_18px_40px_-26px_color-mix(in_oklch,var(--foreground)_35%,transparent)] dark:border sm:flex-row sm:items-start sm:p-8">
          <Avatar src={profile.avatarUrl} name={profile.name} email={profile.name} size={112} />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div>
              <h1 className="text-balance font-display text-3xl font-extrabold tracking-[-0.02em] sm:text-4xl">{profile.name}</h1>
              {profile.headline ? <p className="mt-1 text-lg text-muted-foreground">{profile.headline}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {place ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPinIcon /> {place}
                </span>
              ) : null}
              {profile.formats.length > 0 ? <span>{formats.format(profile.formats.map((f) => tDomain(`formats.${f}`)))}</span> : null}
            </div>
            {profile.topics.length > 0 ? (
              <ul className="flex flex-wrap gap-2" aria-label={t("topics")}>
                {profile.topics.map((topic) => (
                  <li key={topic}>
                    {profile.listed ? (
                      <Link
                        href={href(`/palestrantes/tema/${topicKey(topic)}`)}
                        className="inline-flex rounded-full bg-highlight px-3 py-1 text-sm font-medium text-highlight-foreground hover:brightness-95 max-md:py-1.5"
                      >
                        {topic}
                      </Link>
                    ) : (
                      <span className="inline-flex rounded-full bg-highlight px-3 py-1 text-sm font-medium text-highlight-foreground">{topic}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {profile.contactEnabled ? (
                <a href="#convite" className={buttonVariants({ className: "max-sm:w-full" })}>
                  <SendIcon /> {t("invite")}
                </a>
              ) : null}
              {profile.websiteUrl ? (
                <a href={profile.websiteUrl} target="_blank" rel="nofollow ugc noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
                  {t("website")} <ExternalIcon />
                </a>
              ) : null}
              {profile.linkedinUrl ? (
                <a href={profile.linkedinUrl} target="_blank" rel="nofollow ugc noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
                  LinkedIn <ExternalIcon />
                </a>
              ) : null}
            </div>
          </div>
        </section>

        <section aria-labelledby="verificado" className="flex flex-col gap-4 rounded-md border-2 border-primary/25 bg-primary/5 p-6 max-sm:p-5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="verificado" className="inline-flex items-center gap-2 font-semibold">
              <BadgeCheckIcon className="text-primary" width={20} height={20} /> {t("verifiedTitle")}
            </h2>
            {stats.since ? (
              <span className="text-sm text-muted-foreground">{t("since", { date: monthYear.format(new Date(stats.since)) })}</span>
            ) : null}
          </div>
          {stats.verifiedSessions === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("noVerified")}
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-6 sm:grid-cols-3">
              <Stat value={formatInt(stats.verifiedSessions, locale)} label={t("sessionsDone", { count: stats.verifiedSessions })} />
              <Stat value={formatInt(stats.peopleReached, locale)} label={t("peopleInAudience")} />
              {stats.rating !== null ? (
                <Stat value={formatScore(stats.rating, locale)} label={t("ratingLabel", { count: stats.ratingResponses })} />
              ) : null}
            </dl>
          )}
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground max-md:py-3">{t("howTitle")}</summary>
            <p className="mt-2 max-w-2xl max-md:mt-0">
              {t("howBody", {
                responders: VERIFY_MIN_RESPONDERS,
                minutes: VERIFY_MIN_TALK_SECONDS / 60,
                ratings: RATING_MIN_PROFILE,
              })}
            </p>
          </details>
        </section>

        {profile.bio || profile.audiences.length > 0 ? (
          <section aria-labelledby="sobre" className="flex flex-col gap-3">
            <h2 id="sobre" className="font-display text-xl font-bold">
              {t("about")}
            </h2>
            {profile.bio ? <p className="max-w-2xl whitespace-pre-line break-words">{profile.bio}</p> : null}
            {profile.audiences.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t("serves")}</span>
                {profile.audiences.map((a) => (
                  <Badge key={a} variant="outline">
                    {tDomain(`audiences.${a}`)}
                  </Badge>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {profile.sessions.length > 0 ? (
          <section aria-labelledby="sessoes" className="flex flex-col gap-3">
            <h2 id="sessoes" className="font-display text-xl font-bold">
              {t("sessionsTitle")}
            </h2>
            <ul className="divide-y rounded-md border bg-card">
              {profile.sessions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <div className="flex min-w-0 flex-1 flex-col max-sm:basis-full">
                    <span className="font-medium">{s.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {fullDate.format(new Date(s.date))} · {audienceRangeText(tDomain, s.participants)}
                    </span>
                  </div>
                  {s.rating !== null ? (
                    <span className="text-sm">
                      {t.rich("sessionRating", {
                        rating: formatScore(s.rating, locale),
                        b: (c) => <span className="font-display font-bold tabular-nums">{c}</span>,
                      })}
                    </span>
                  ) : null}
                  <Badge variant="secondary" className="gap-1">
                    <BadgeCheckIcon className="text-primary" /> {t("verified")}
                  </Badge>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              {t("sessionsFootnote", { min: RATING_MIN_SESSION })}
            </p>
          </section>
        ) : null}

        {profile.experience ? (
          <section aria-labelledby="experiencia" className="flex flex-col gap-2">
            <h2 id="experiencia" className="font-display text-xl font-bold">
              {t.rich("experienceTitle", {
                muted: (c) => <span className="text-base font-medium text-muted-foreground">{c}</span>,
              })}
            </h2>
            <p className="max-w-2xl whitespace-pre-line break-words">{profile.experience}</p>
            <p className="text-xs text-muted-foreground">{t("experienceNote")}</p>
          </section>
        ) : null}

        {profile.contactEnabled ? (
          <section id="convite" aria-labelledby="convite-titulo" className="flex scroll-mt-6 flex-col gap-4 rounded-md bg-card p-6 max-sm:p-5 shadow-[0_18px_40px_-26px_color-mix(in_oklch,var(--foreground)_35%,transparent)] dark:border sm:p-8">
            <div>
              <h2 id="convite-titulo" className="font-display text-xl font-bold">
                {t("inviteTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("inviteDescription", { name: profile.name })}
              </p>
            </div>
            <ContactForm slug={profile.slug} speakerName={profile.name} privacyHref={href("/privacidade")} />
          </section>
        ) : null}
      </div>
    </PublicShell>
  );
}
