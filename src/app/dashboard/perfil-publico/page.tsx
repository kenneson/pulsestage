import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSpeakerProfile } from "@/lib/data/profile";
import { getOwnPublicProfile, getOwnSessionFacts } from "@/lib/data/speaker-profile";
import { publicEnv } from "@/lib/env";
import { formatDate } from "@/lib/datetime";
import { formatInt, formatScore } from "@/lib/format";
import {
  DIRECTORY_MIN_VERIFIED,
  profileStats,
  RATING_MIN_PROFILE,
  sessionRating,
  slugify,
  VERIFY_MIN_RESPONDERS,
  VERIFY_MIN_TALK_SECONDS,
  verifySession,
} from "@/lib/domain/speaker-profile";
import { audienceRangeText } from "@/i18n/text";
import { getMessageTranslator } from "@/i18n/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState } from "@/components/ui/misc";
import { BadgeCheckIcon } from "@/components/icons";
import {
  PublicProfileForm,
  SessionVisibilityList,
  ShareProfileLink,
} from "@/components/speaker-profile/public-profile-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile.settings");
  return { title: t("metaTitle") };
}

export default async function PublicProfileSettingsPage() {
  const [t, tDomain, tr, locale, profile] = await Promise.all([
    getTranslations("profile.settings"),
    getTranslations("domain"),
    getMessageTranslator(),
    getLocale(),
    getSpeakerProfile(),
  ]);
  const supabase = await createClient();
  const [settings, facts] = await Promise.all([
    getOwnPublicProfile(supabase, profile.id),
    getOwnSessionFacts(supabase, profile.id),
  ]);
  if (!settings) throw new Error("Perfil não encontrado.");

  const stats = profileStats(facts, true);
  const url = settings.slug ? `${publicEnv.appUrl}/p/${settings.slug}` : null;
  const suggestedSlug = settings.slug ?? (slugify(profile.name ?? "") || slugify(profile.email.split("@")[0] ?? ""));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t.rich("intro", {
            link: (c) => (
              <Link href="/palestrantes" className="font-medium text-primary hover:underline">
                {c}
              </Link>
            ),
          })}
        </p>
      </div>

      {settings.publicEnabled && url ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("liveTitle")}</CardTitle>
            <CardDescription>
              {stats.verifiedSessions >= DIRECTORY_MIN_VERIFIED
                ? t("liveListed")
                : t("liveUnlisted")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ShareProfileLink url={url} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgeCheckIcon className="text-primary" /> {t("verifiedTitle")}
          </CardTitle>
          <CardDescription>
            {t("verifiedDescription", { responders: VERIFY_MIN_RESPONDERS, minutes: VERIFY_MIN_TALK_SECONDS / 60 })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted-foreground">{t("verifiedSessions")}</dt>
              <dd className="font-display text-3xl font-bold tabular-nums">{formatInt(stats.verifiedSessions, locale)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{t("peopleReached")}</dt>
              <dd className="font-display text-3xl font-bold tabular-nums">{formatInt(stats.peopleReached, locale)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{t("rating")}</dt>
              <dd className="font-display text-3xl font-bold tabular-nums">
                {stats.rating !== null ? formatScore(stats.rating, locale) : "—"}
              </dd>
              {stats.rating === null ? (
                <p className="text-xs text-muted-foreground">
                  {t("ratingPending", { min: RATING_MIN_PROFILE, count: stats.ratingResponses })}
                </p>
              ) : !settings.showRatings ? (
                <p className="text-xs text-muted-foreground">{t("ratingHidden")}</p>
              ) : null}
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("dataTitle")}</CardTitle>
          <CardDescription>
            {t.rich("dataDescription", {
              link: (c) => (
                <Link href="/dashboard/conta#perfil" className="font-medium text-primary hover:underline">
                  {c}
                </Link>
              ),
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!profile.name ? <Alert className="mb-4">{t("nameMissing")}</Alert> : null}
          <PublicProfileForm
            profileUrlBase={publicEnv.appUrl.replace(/^https?:\/\//, "")}
            initialValues={{
              publicEnabled: settings.publicEnabled,
              slug: suggestedSlug,
              headline: settings.headline ?? "",
              topics: settings.topics.join(", "),
              city: settings.city ?? "",
              state: settings.state ?? "",
              experience: settings.experience ?? "",
              websiteUrl: settings.websiteUrl ?? "",
              linkedinUrl: settings.linkedinUrl ?? "",
              contactEnabled: settings.contactEnabled,
              showRatings: settings.showRatings,
              promoteOnSurvey: settings.promoteOnSurvey,
              formats: settings.formats,
              audiences: settings.audiences,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sessionsTitle")}</CardTitle>
          <CardDescription>
            {t("sessionsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {facts.length === 0 ? (
            <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
          ) : (
            <SessionVisibilityList
              sessions={facts.map((f) => {
                const check = verifySession(f);
                const rating = sessionRating(f);
                return {
                  id: f.sessionId,
                  title: f.title,
                  date: formatDate(f.startedAt, profile.timeZone, locale),
                  audience: audienceRangeText(tDomain, f.participants),
                  rating: rating !== null ? formatScore(rating, locale) : null,
                  listed: f.publicListed,
                  verified: check.verified,
                  reason: check.verified ? null : tr.message(check.reason),
                };
              })}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
