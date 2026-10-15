import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPublicHref, localeAlternates, ogLocale } from "@/i18n/seo";
import { createAdminClient } from "@/lib/supabase/admin";
import { listPublicProfiles } from "@/lib/data/speaker-profile";
import { parseDirectoryParams, topTopics } from "@/lib/domain/speaker-profile";
import { PublicShell } from "@/components/speaker-profile/public-shell";
import { DirectoryView } from "@/components/speaker-profile/directory-view";

type Props = {
  params: Promise<{ tema: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const TOPIC_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function findTopic(key: string) {
  if (!TOPIC_RE.test(key) || key.length > 60) return null;
  const entries = await listPublicProfiles(createAdminClient());
  const topic = topTopics(entries, Number.MAX_SAFE_INTEGER).find((t) => t.key === key);
  return topic ? { topic, entries } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tema } = await params;
  const found = await findTopic(tema);
  // Inexistente: o Next mostra a página 404 e marca noindex (o status fica 200 pelo streaming do loading.tsx).
  if (!found) notFound();
  const t = await getTranslations("profile.topic");
  return {
    title: t("metaTitle", { topic: found.topic.label }),
    description: t("metaDescription", { topic: found.topic.label }),
    alternates: await localeAlternates(`/palestrantes/tema/${found.topic.key}`),
    openGraph: { locale: await ogLocale() },
  };
}

export default async function TopicPage({ params, searchParams }: Props) {
  const { tema } = await params;
  const found = await findTopic(tema);
  if (!found) notFound();
  const { pagina, ...filters } = parseDirectoryParams(await searchParams);
  const [t, href] = await Promise.all([getTranslations("profile.topic"), getPublicHref()]);

  return (
    <PublicShell>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-6 md:py-12">
        <div className="max-w-3xl">
          <Link href={href("/palestrantes")} className="text-sm text-muted-foreground hover:text-foreground">
            {t("back")}
          </Link>
          <h1 className="mt-2 text-balance font-display text-3xl font-extrabold tracking-[-0.02em] sm:text-4xl">
            {t.rich("title", {
              topic: found.topic.label,
              mark: (c) => <mark className="highlighter box-decoration-clone rounded-md px-1.5 text-highlight-foreground">{c}</mark>,
            })}
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            {t("intro")}
          </p>
        </div>
        <DirectoryView
          entries={found.entries}
          filters={filters}
          page={pagina}
          basePath={`/palestrantes/tema/${found.topic.key}`}
          fixedTopic={found.topic.key}
        />
      </div>
    </PublicShell>
  );
}
