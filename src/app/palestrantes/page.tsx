import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { listPublicProfiles } from "@/lib/data/speaker-profile";
import { parseDirectoryParams, VERIFY_MIN_RESPONDERS, VERIFY_MIN_TALK_SECONDS } from "@/lib/domain/speaker-profile";
import { PublicShell } from "@/components/speaker-profile/public-shell";
import { DirectoryView } from "@/components/speaker-profile/directory-view";

export const metadata: Metadata = {
  title: "Palestrantes",
  description:
    "Encontre palestrantes para universidades, escolas, empresas e eventos, com sessões e notas da plateia verificadas pelo PulseStage.",
  alternates: { canonical: "/palestrantes" },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DirectoryPage({ searchParams }: Props) {
  const { pagina, ...filters } = parseDirectoryParams(await searchParams);
  const entries = await listPublicProfiles(createAdminClient());

  return (
    <PublicShell>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-6 md:py-12">
        <div className="max-w-3xl">
          <h1 className="text-balance font-display text-3xl font-extrabold tracking-[-0.02em] sm:text-4xl">
            Palestrantes com <mark className="highlighter box-decoration-clone rounded-md px-1.5 text-highlight-foreground">plateia comprovada</mark>
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Cada número deste diretório vem de sessões reais feitas no PulseStage: pelo menos {VERIFY_MIN_RESPONDERS} pessoas
            respondendo e {VERIFY_MIN_TALK_SECONDS / 60} minutos de apresentação. Encontre alguém para a sua aula, escola,
            empresa ou evento e envie um convite pelo perfil.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            É palestrante?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Crie sua conta
            </Link>{" "}
            e publique o seu perfil depois da primeira sessão.
          </p>
        </div>
        <DirectoryView entries={entries} filters={filters} page={pagina} basePath="/palestrantes" />
      </div>
    </PublicShell>
  );
}
