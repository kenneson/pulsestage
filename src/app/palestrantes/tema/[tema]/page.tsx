import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
  return {
    title: `Palestrantes de ${found.topic.label}`,
    description: `Palestrantes de ${found.topic.label} para universidades, escolas, empresas e eventos, com sessões verificadas pelo PulseStage.`,
    alternates: { canonical: `/palestrantes/tema/${found.topic.key}` },
  };
}

export default async function TopicPage({ params, searchParams }: Props) {
  const { tema } = await params;
  const found = await findTopic(tema);
  if (!found) notFound();
  const { pagina, ...filters } = parseDirectoryParams(await searchParams);

  return (
    <PublicShell>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-6 md:py-12">
        <div className="max-w-3xl">
          <Link href="/palestrantes" className="text-sm text-muted-foreground hover:text-foreground">
            ← Todos os palestrantes
          </Link>
          <h1 className="mt-2 text-balance font-display text-3xl font-extrabold tracking-[-0.02em] sm:text-4xl">
            Palestrantes de <mark className="highlighter box-decoration-clone rounded-md px-1.5 text-highlight-foreground">{found.topic.label}</mark>
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Com sessões e notas da plateia verificadas pelo PulseStage. Abra um perfil para ver as sessões e enviar um
            convite.
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
