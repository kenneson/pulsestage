import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLiveState, getPublicInteractions, getPublicSession, getSessionDeck, getSessionResults } from "@/lib/data/public";
import { getSlideUrls } from "@/lib/data/slides";
import { buildDeck } from "@/lib/domain/deck";
import { getCurrentUser } from "@/lib/supabase/server";
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

  const [interactions, live, results, deckSession, user] = await Promise.all([
    getPublicInteractions(admin, id),
    getLiveState(admin, id),
    getSessionResults(admin, id),
    getSessionDeck(admin, id),
    getCurrentUser(),
  ]);
  const slideUrls = deckSession ? await getSlideUrls(admin, deckSession) : [];
  const initialLive = liveStateSchema.safeParse(live);

  return (
    <DisplayView
      session={{ id, title: session.title, joinCode: session.joinCode }}
      interactions={interactions}
      initialLive={initialLive.success ? initialLive.data : null}
      initialResults={toResultsMap(results)}
      joinUrl={joinUrl(session.joinCode)}
      feedbackUrl={feedbackUrl(id)}
      deck={buildDeck(slideUrls.length, interactions)}
      slideUrls={slideUrls}
      canControl={Boolean(user && deckSession && user.id === deckSession.speaker_id)}
    />
  );
}
