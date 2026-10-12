import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicProfile } from "@/lib/data/speaker-profile";
import { APP_TIME_ZONE } from "@/lib/datetime";
import { formatInt, formatScore } from "@/lib/format";
import {
  AUDIENCE_LABEL,
  FORMAT_LABEL,
  RATING_MIN_PROFILE,
  RATING_MIN_SESSION,
  SLUG_RE,
  topicKey,
  VERIFY_MIN_RESPONDERS,
  VERIFY_MIN_TALK_SECONDS,
} from "@/lib/domain/speaker-profile";
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
  const description =
    profile.headline ?? profile.bio ?? `Perfil de ${profile.name} no PulseStage, com sessões e números verificados.`;
  return {
    title: `${profile.name} · Palestrante`,
    description,
    alternates: { canonical: `/p/${profile.slug}` },
    // Sem sessão verificada, o perfil existe para quem tem o link, mas não vai para buscadores.
    robots: profile.listed ? undefined : { index: false, follow: false },
    openGraph: { type: "profile", title: profile.name, description },
  };
}

const monthYear = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: APP_TIME_ZONE });
const fullDate = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: APP_TIME_ZONE });

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
  const { stats } = profile;
  const place = [profile.city, profile.state].filter(Boolean).join(" · ");

  return (
    <PublicShell>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 md:px-6 md:py-12">
        <section className="flex flex-col gap-6 rounded-md bg-card p-6 shadow-[0_18px_40px_-26px_color-mix(in_oklch,var(--foreground)_35%,transparent)] dark:border sm:flex-row sm:items-start sm:p-8">
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
              {profile.formats.length > 0 ? <span>{profile.formats.map((f) => FORMAT_LABEL[f]).join(" e ")}</span> : null}
            </div>
            {profile.topics.length > 0 ? (
              <ul className="flex flex-wrap gap-2" aria-label="Temas">
                {profile.topics.map((topic) => (
                  <li key={topic}>
                    {profile.listed ? (
                      <Link
                        href={`/palestrantes/tema/${topicKey(topic)}`}
                        className="inline-flex rounded-full bg-highlight px-3 py-1 text-sm font-medium text-highlight-foreground hover:brightness-95"
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
                <a href="#convite" className={buttonVariants()}>
                  <SendIcon /> Convidar para palestrar
                </a>
              ) : null}
              {profile.websiteUrl ? (
                <a href={profile.websiteUrl} target="_blank" rel="nofollow ugc noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
                  Site <ExternalIcon />
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

        <section aria-labelledby="verificado" className="flex flex-col gap-4 rounded-md border-2 border-primary/25 bg-primary/5 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="verificado" className="inline-flex items-center gap-2 font-semibold">
              <BadgeCheckIcon className="text-primary" width={20} height={20} /> Dados verificados pelo PulseStage
            </h2>
            {stats.since ? (
              <span className="text-sm text-muted-foreground">desde {monthYear.format(new Date(stats.since))}</span>
            ) : null}
          </div>
          {stats.verifiedSessions === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda não há sessões verificadas. Os números aparecem aqui depois da primeira sessão realizada com o
              PulseStage que cumpre o critério abaixo.
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-6 sm:grid-cols-3">
              <Stat value={formatInt(stats.verifiedSessions)} label={stats.verifiedSessions === 1 ? "sessão realizada" : "sessões realizadas"} />
              <Stat value={formatInt(stats.peopleReached)} label="pessoas na plateia" />
              {stats.rating !== null ? (
                <Stat value={formatScore(stats.rating)} label={`nota da plateia (0 a 10), ${formatInt(stats.ratingResponses)} avaliações`} />
              ) : null}
            </dl>
          )}
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">Como verificamos</summary>
            <p className="mt-2 max-w-2xl">
              Contam só as sessões que aconteceram no PulseStage, já encerradas, com pelo menos {VERIFY_MIN_RESPONDERS}{" "}
              pessoas diferentes respondendo e {VERIFY_MIN_TALK_SECONDS / 60} minutos de apresentação. A nota é a média
              das respostas de 0 a 10 da pesquisa ao fim de cada sessão (utilidade, satisfação e recomendação) e aparece
              com pelo menos {RATING_MIN_PROFILE} avaliações. O palestrante não edita esses números; ele pode escolher
              não mostrar a nota.
            </p>
          </details>
        </section>

        {profile.bio || profile.audiences.length > 0 ? (
          <section aria-labelledby="sobre" className="flex flex-col gap-3">
            <h2 id="sobre" className="font-display text-xl font-bold">
              Sobre
            </h2>
            {profile.bio ? <p className="max-w-2xl whitespace-pre-line break-words">{profile.bio}</p> : null}
            {profile.audiences.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Atende:</span>
                {profile.audiences.map((a) => (
                  <Badge key={a} variant="outline">
                    {AUDIENCE_LABEL[a]}
                  </Badge>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {profile.sessions.length > 0 ? (
          <section aria-labelledby="sessoes" className="flex flex-col gap-3">
            <h2 id="sessoes" className="font-display text-xl font-bold">
              Sessões realizadas
            </h2>
            <ul className="divide-y rounded-md border bg-card">
              {profile.sessions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{s.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {fullDate.format(new Date(s.date))} · {s.audience}
                    </span>
                  </div>
                  {s.rating !== null ? (
                    <span className="text-sm">
                      nota <span className="font-display font-bold tabular-nums">{formatScore(s.rating)}</span>
                    </span>
                  ) : null}
                  <Badge variant="secondary" className="gap-1">
                    <BadgeCheckIcon className="text-primary" /> Verificada
                  </Badge>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Faixa de público pelo número de participantes. Nota por sessão com pelo menos {RATING_MIN_SESSION} respostas.
            </p>
          </section>
        ) : null}

        {profile.experience ? (
          <section aria-labelledby="experiencia" className="flex flex-col gap-2">
            <h2 id="experiencia" className="font-display text-xl font-bold">
              Experiência anterior <span className="text-base font-medium text-muted-foreground">(declarada)</span>
            </h2>
            <p className="max-w-2xl whitespace-pre-line break-words">{profile.experience}</p>
            <p className="text-xs text-muted-foreground">Informada pelo palestrante; não verificada pelo PulseStage.</p>
          </section>
        ) : null}

        {profile.contactEnabled ? (
          <section id="convite" aria-labelledby="convite-titulo" className="flex scroll-mt-6 flex-col gap-4 rounded-md bg-card p-6 shadow-[0_18px_40px_-26px_color-mix(in_oklch,var(--foreground)_35%,transparent)] dark:border sm:p-8">
            <div>
              <h2 id="convite-titulo" className="font-display text-xl font-bold">
                Convidar para palestrar
              </h2>
              <p className="text-sm text-muted-foreground">
                Para universidades, escolas, empresas e eventos. O pedido chega direto para {profile.name}.
              </p>
            </div>
            <ContactForm slug={profile.slug} speakerName={profile.name} />
          </section>
        ) : null}
      </div>
    </PublicShell>
  );
}
