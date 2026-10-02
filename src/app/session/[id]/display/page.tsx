import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLiveState, getPublicInteractions, getPublicSession, getSessionResults } from "@/lib/data/public";
import { toResultsMap } from "@/lib/domain/results";
import { liveStateSchema } from "@/lib/realtime/schemas";
import { feedbackUrl, joinUrl } from "@/lib/env";
import { isUuid } from "@/lib/action-result";
import { DisplayView } from "@/components/display/display-view";

export const metadata: Metadata = { title: "Projetor", robots: { index: false } };

// Tela pública do projetor: o id (UUID) funciona como link não-adivinhável.
export default async function DisplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const admin = createAdminClient();
  const session = await getPublicSession(admin, id);
  if (!session) notFound();

  const [interactions, live, results] = await Promise.all([
    getPublicInteractions(admin, id),
    getLiveState(admin, id),
    getSessionResults(admin, id),
  ]);
  const initialLive = liveStateSchema.safeParse(live);

  return (
    <DisplayView
      session={{ id, title: session.title, joinCode: session.joinCode }}
      interactions={interactions}
      initialLive={initialLive.success ? initialLive.data : null}
      initialResults={toResultsMap(results)}
      joinUrl={joinUrl(session.joinCode)}
      feedbackUrl={feedbackUrl(id)}
    />
  );
}
