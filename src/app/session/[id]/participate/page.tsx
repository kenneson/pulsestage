import type { Metadata } from "next";
import { cache } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { SessionIntl } from "@/i18n/session-intl";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentForParticipant, getLiveState, getParticipantBadge, getPublicSession } from "@/lib/data/public";
import { getParticipantIdFromCookie } from "@/lib/participant/token";
import { liveStateSchema } from "@/lib/realtime/schemas";
import { isUuid } from "@/lib/action-result";
import { ParticipateView } from "@/components/participant/participate-view";
import { getParticipantTeam } from "@/lib/data/participant-teams";
import { getJourneyForParticipant } from "@/lib/data/participant-journey";

// Uma leitura por requisição, compartilhada entre os metadados e a página.
const loadSession = cache((id: string) => (isUuid(id) ? getPublicSession(createAdminClient(), id) : Promise.resolve(null)));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const session = await loadSession((await params).id);
  const t = await getTranslations({ locale: session?.locale ?? (await getLocale()), namespace: "participant.participate" });
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ParticipatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const admin = createAdminClient();
  const session = await loadSession(id);
  if (!session) notFound();

  const participantId = await getParticipantIdFromCookie(id);
  if (!participantId) {
    redirect(session.status === "completed" ? `/feedback/${id}` : `/join/${session.joinCode}`);
  }

  const [live, current, me, team] = await Promise.all([
    getLiveState(admin, id),
    getCurrentForParticipant(admin, id, participantId),
    getParticipantBadge(admin, participantId),
    getParticipantTeam(admin, participantId),
  ]);
  const initialLive = liveStateSchema.safeParse(live);
  // Ritmo próprio: o roteiro vem junto com a página (sem tela de carregamento).
  const journey = current.pace === "self" ? await getJourneyForParticipant(admin, id, participantId) : null;

  return (
    <SessionIntl locale={session.locale}>
      <ParticipateView
        sessionId={id}
        title={session.title}
        initialLive={initialLive.success ? initialLive.data : null}
        initialCurrent={current}
        initialJourney={journey}
        me={{ ...me, team }}
      />
    </SessionIntl>
  );
}
