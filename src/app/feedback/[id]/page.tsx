import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicSession, getSessionSurvey } from "@/lib/data/public";
import { getParticipantIdFromCookie, hasSentFeedback } from "@/lib/participant/token";
import { isUuid } from "@/lib/action-result";
import { SessionIntl } from "@/i18n/session-intl";
import { Logo } from "@/components/logo";
import { SurveyForm } from "@/components/participant/survey-form";
import { RaffleTicketLive } from "@/components/participant/raffle-ticket";
import { getSurveyPromo } from "@/lib/data/speaker-profile";
import { SpeakerPromoCard } from "@/components/speaker-profile/speaker-promo-card";

// Uma leitura por requisição, compartilhada entre os metadados e a página.
const loadSession = cache((id: string) => (isUuid(id) ? getPublicSession(createAdminClient(), id) : Promise.resolve(null)));

// A pesquisa fala o idioma da sessão (as perguntas vêm do modelo escolhido nesse idioma).
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const session = await loadSession((await params).id);
  const t = await getTranslations({ locale: session?.locale ?? (await getLocale()), namespace: "participant.feedback" });
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function FeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const admin = createAdminClient();
  const session = await loadSession(id);
  if (!session) notFound();
  const t = await getTranslations({ locale: session.locale, namespace: "participant.feedback" });

  const [survey, raffle, promo] = await Promise.all([
    session.status === "completed" ? getSessionSurvey(admin, id) : Promise.resolve(null),
    admin.from("sessions").select("raffle_eligibility").eq("id", id).maybeSingle(),
    session.status === "completed" ? getSurveyPromo(admin, id) : Promise.resolve(null),
  ]);
  const raffleMode = raffle.data?.raffle_eligibility ?? null;
  let alreadySent = await hasSentFeedback(id);
  const participantId = await getParticipantIdFromCookie(id);
  if (!alreadySent && participantId) {
    const { count } = await admin
      .from("survey_responses")
      .select("id", { count: "exact", head: true })
      .eq("session_id", id)
      .eq("participant_id", participantId);
    alreadySent = (count ?? 0) > 0;
  }

  const ticket = raffleMode && participantId ? <RaffleTicketLive sessionId={id} className="mt-4 w-full" /> : null;
  // Depois de responder (nunca antes, para não influenciar a avaliação).
  const afterSurvey =
    ticket || promo ? (
      <>
        {ticket}
        {promo ? <SpeakerPromoCard promo={promo} locale={session.locale} className="mt-4 w-full" /> : null}
      </>
    ) : null;

  return (
    <SessionIntl locale={session.locale}>
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 py-8">
        <Logo />
        <div>
          <p className="text-sm text-muted-foreground">{t("eyebrow")}</p>
          <h1 className="mt-1 text-2xl font-semibold">{session.title}</h1>
        </div>
        {session.status !== "completed" ? (
          <p className="rounded-lg bg-muted p-4 text-muted-foreground">{t("notOpen")}</p>
        ) : alreadySent ? (
          <>
            <p className="rounded-lg bg-muted p-4">{t("alreadySent")}</p>
            {afterSurvey}
          </>
        ) : (
          survey && survey.questions.length > 0 ? (
            <>
              {raffleMode === "survey" ? (
                <p className="rounded-lg border border-dashed p-4 text-sm">
                  {participantId ? t("raffleJoined") : t("raffleNotJoined")}
                </p>
              ) : null}
              <SurveyForm sessionId={id} questions={survey.questions} after={afterSurvey} />
            </>
          ) : (
            <p className="rounded-lg bg-muted p-4 text-muted-foreground">{t("unavailable")}</p>
          )
        )}
      </main>
    </SessionIntl>
  );
}
