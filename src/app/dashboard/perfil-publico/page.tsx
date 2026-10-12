import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSpeakerProfile } from "@/lib/data/profile";
import { getOwnPublicProfile, getOwnSessionFacts } from "@/lib/data/speaker-profile";
import { publicEnv } from "@/lib/env";
import { formatDate } from "@/lib/datetime";
import { formatInt, formatScore } from "@/lib/format";
import {
  audienceRange,
  DIRECTORY_MIN_VERIFIED,
  profileStats,
  RATING_MIN_PROFILE,
  sessionRating,
  slugify,
  VERIFY_MIN_RESPONDERS,
  VERIFY_MIN_TALK_SECONDS,
  verifySession,
} from "@/lib/domain/speaker-profile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState } from "@/components/ui/misc";
import { BadgeCheckIcon } from "@/components/icons";
import {
  PublicProfileForm,
  SessionVisibilityList,
  ShareProfileLink,
} from "@/components/speaker-profile/public-profile-form";

export const metadata: Metadata = { title: "Perfil público" };

export default async function PublicProfileSettingsPage() {
  const profile = await getSpeakerProfile();
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
        <h1 className="text-2xl font-semibold tracking-tight">Perfil público</h1>
        <p className="text-muted-foreground">
          Um portfólio com números que o PulseStage confere: sessões realizadas, pessoas alcançadas e a nota da plateia.
          Instituições e empresas encontram você no{" "}
          <Link href="/palestrantes" className="font-medium text-primary hover:underline">
            diretório de palestrantes
          </Link>{" "}
          e enviam convites.
        </p>
      </div>

      {settings.publicEnabled && url ? (
        <Card>
          <CardHeader>
            <CardTitle>Seu perfil está no ar</CardTitle>
            <CardDescription>
              {stats.verifiedSessions >= DIRECTORY_MIN_VERIFIED
                ? "Ele aparece no diretório e pode ser encontrado por buscadores."
                : "Ele ainda não aparece no diretório: falta uma sessão verificada. Quem tem o link já consegue ver."}
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
            <BadgeCheckIcon className="text-primary" /> Números verificados
          </CardTitle>
          <CardDescription>
            Contam as sessões encerradas com pelo menos {VERIFY_MIN_RESPONDERS} pessoas respondendo e{" "}
            {VERIFY_MIN_TALK_SECONDS / 60} minutos de palestra. Não dá para editar esses números.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted-foreground">Sessões verificadas</dt>
              <dd className="font-display text-3xl font-bold tabular-nums">{formatInt(stats.verifiedSessions)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Pessoas alcançadas</dt>
              <dd className="font-display text-3xl font-bold tabular-nums">{formatInt(stats.peopleReached)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Nota da plateia</dt>
              <dd className="font-display text-3xl font-bold tabular-nums">
                {stats.rating !== null ? formatScore(stats.rating) : "—"}
              </dd>
              {stats.rating === null ? (
                <p className="text-xs text-muted-foreground">
                  Aparece com {RATING_MIN_PROFILE} respostas de pesquisa (você tem {stats.ratingResponses}).
                </p>
              ) : !settings.showRatings ? (
                <p className="text-xs text-muted-foreground">Oculta no perfil (veja as opções abaixo).</p>
              ) : null}
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados do perfil</CardTitle>
          <CardDescription>
            Nome, foto e mini-bio vêm de{" "}
            <Link href="/dashboard/conta#perfil" className="font-medium text-primary hover:underline">
              Conta
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!profile.name ? <Alert className="mb-4">Preencha seu nome em Conta antes de publicar o perfil.</Alert> : null}
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
          <CardTitle>Sessões no perfil</CardTitle>
          <CardDescription>
            Marque as sessões verificadas que aparecem no perfil (título, data, faixa de público e nota). Todas as
            verificadas contam nos números, marcadas ou não; as que não cumprem o critério ficam só aqui.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {facts.length === 0 ? (
            <EmptyState title="Nenhuma sessão encerrada ainda" description="Depois de encerrar uma sessão, ela aparece aqui." />
          ) : (
            <SessionVisibilityList
              sessions={facts.map((f) => {
                const check = verifySession(f);
                const rating = sessionRating(f);
                return {
                  id: f.sessionId,
                  title: f.title,
                  date: formatDate(f.startedAt, profile.timeZone),
                  audience: audienceRange(f.participants),
                  rating: rating !== null ? formatScore(rating) : null,
                  listed: f.publicListed,
                  verified: check.verified,
                  reason: check.verified ? null : check.reason,
                };
              })}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
