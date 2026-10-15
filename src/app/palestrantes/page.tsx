import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getPublicHref, localeAlternates, ogLocale } from "@/i18n/seo";
import { createAdminClient } from "@/lib/supabase/admin";
import { listPublicProfiles } from "@/lib/data/speaker-profile";
import { parseDirectoryParams, VERIFY_MIN_RESPONDERS, VERIFY_MIN_TALK_SECONDS } from "@/lib/domain/speaker-profile";
import { PublicShell } from "@/components/speaker-profile/public-shell";
import { DirectoryView } from "@/components/speaker-profile/directory-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile.directory");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: await localeAlternates("/palestrantes"),
    openGraph: { locale: await ogLocale() },
  };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DirectoryPage({ searchParams }: Props) {
  const { pagina, ...filters } = parseDirectoryParams(await searchParams);
  const [t, href, entries] = await Promise.all([
    getTranslations("profile.directory"),
    getPublicHref(),
    listPublicProfiles(createAdminClient()),
  ]);

  return (
    <PublicShell>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-6 md:py-12">
        <div className="max-w-3xl">
          <h1 className="text-balance font-display text-3xl font-extrabold tracking-[-0.02em] sm:text-4xl">
            {t.rich("title", {
              mark: (c) => <mark className="highlighter box-decoration-clone rounded-md px-1.5 text-highlight-foreground">{c}</mark>,
            })}
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            {t("intro", { responders: VERIFY_MIN_RESPONDERS, minutes: VERIFY_MIN_TALK_SECONDS / 60 })}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t.rich("signupHint", {
              link: (c) => (
                <Link href={href("/signup")} className="font-medium text-primary hover:underline">
                  {c}
                </Link>
              ),
            })}
          </p>
        </div>
        <DirectoryView entries={entries} filters={filters} page={pagina} basePath="/palestrantes" />
      </div>
    </PublicShell>
  );
}
