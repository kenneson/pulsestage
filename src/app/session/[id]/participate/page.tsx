import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentForParticipant, getLiveState, getPublicSession } from "@/lib/data/public";
import { getParticipantIdFromCookie } from "@/lib/participant/token";
import { liveStateSchema } from "@/lib/realtime/schemas";
import { isUuid } from "@/lib/action-result";
import { ParticipateView } from "@/components/participant/participate-view";

export const metadata: Metadata = { title: "Participar", robots: { index: false } };

export default async function ParticipatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const admin = createAdminClient();
  const session = await getPublicSession(admin, id);
  if (!session) notFound();

  const participantId = await getParticipantIdFromCookie(id);
  if (!participantId) {
    redirect(session.status === "completed" ? `/feedback/${id}` : `/join/${session.joinCode}`);
  }

  const [live, current] = await Promise.all([getLiveState(admin, id), getCurrentForParticipant(admin, id, participantId)]);
  const initialLive = liveStateSchema.safeParse(live);

  return (
    <ParticipateView
      sessionId={id}
      title={session.title}
      initialLive={initialLive.success ? initialLive.data : null}
      initialCurrent={current}
    />
  );
}
