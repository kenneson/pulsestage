import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicSession, getSessionSurvey } from "@/lib/data/public";
import { getParticipantIdFromCookie, hasSentFeedback } from "@/lib/participant/token";
import { isUuid } from "@/lib/action-result";
import { Logo } from "@/components/logo";
import { SurveyForm } from "@/components/participant/survey-form";
import { RaffleTicketLive } from "@/components/participant/raffle-ticket";

export const metadata: Metadata = { title: "Pesquisa da sessão", robots: { index: false } };

export default async function FeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const admin = createAdminClient();
  const session = await getPublicSession(admin, id);
  if (!session) notFound();

  const [survey, raffle] = await Promise.all([
    session.status === "completed" ? getSessionSurvey(admin, id) : Promise.resolve(null),
    admin.from("sessions").select("raffle_eligibility").eq("id", id).maybeSingle(),
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

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 py-8">
      <Logo />
      <div>
        <p className="text-sm text-muted-foreground">Pesquisa sobre a sessão</p>
        <h1 className="mt-1 text-2xl font-semibold">{session.title}</h1>
      </div>
      {session.status !== "completed" ? (
        <p className="rounded-lg bg-muted p-4 text-muted-foreground">
          A pesquisa abre assim que a sessão terminar. Volte a este link depois.
        </p>
      ) : alreadySent ? (
        <>
          <p className="rounded-lg bg-muted p-4">Você já respondeu esta pesquisa. Obrigado!</p>
          {ticket}
        </>
      ) : (
        survey && survey.questions.length > 0 ? (
          <>
            {raffleMode === "survey" ? (
              <p className="rounded-lg border border-dashed p-4 text-sm">
                {participantId
                  ? "Tem sorteio! Ao enviar a pesquisa, você recebe seu número da sorte."
                  : "Tem sorteio, mas ele vale só para quem entrou na sessão pelo celular, com o código ou o QR Code."}
              </p>
            ) : null}
            <SurveyForm sessionId={id} questions={survey.questions} after={ticket} />
          </>
        ) : (
          <p className="rounded-lg bg-muted p-4 text-muted-foreground">A pesquisa desta sessão não está disponível.</p>
        )
      )}
    </main>
  );
}
