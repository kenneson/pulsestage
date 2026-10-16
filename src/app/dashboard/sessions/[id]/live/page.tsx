import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnedSession, getSessionInteractions } from "@/lib/data/sessions";
import { toPublicInteraction } from "@/lib/domain/interactions";
import { liveStateSchema } from "@/lib/realtime/schemas";
import { toResultsMap } from "@/lib/domain/results";
import { joinUrl } from "@/lib/env";
import { isUuid } from "@/lib/action-result";
import { ControlRoom, type ControlRoomInteraction } from "@/components/live/control-room";
import { RehearsalBanner } from "@/components/live/rehearsal-banner";
import { getSlideUrls } from "@/lib/data/slides";
import { buildDeck } from "@/lib/domain/deck";
import { sessionClock } from "@/lib/domain/timing";
import { getRaffleState } from "@/lib/data/raffle";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("live.page");
  return { title: t("metaTitle") };
}

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const session = await getOwnedSession(supabase, id);
  if (!session) notFound();

  // Nome de quem não escolheu apelido ("Participante XXXX") no idioma do painel.
  const tDomain = await getTranslations("domain");
  const [interactions, liveResult, resultsResult, slideUrls, raffle] = await Promise.all([
    getSessionInteractions(supabase, id),
    supabase.from("session_live_state").select("*").eq("session_id", id).maybeSingle(),
    supabase.from("interaction_results").select("*").eq("session_id", id),
    getSlideUrls(supabase, session),
    session.raffle_eligibility ? getRaffleState(supabase, id, session.raffle_eligibility, tDomain("anonymousParticipant")) : Promise.resolve(null),
  ]);

  const controlInteractions: ControlRoomInteraction[] = interactions.flatMap((row) => {
    const pub = toPublicInteraction(row, row.options);
    return pub ? [{ ...pub, correctOptionId: row.options.find((o) => o.is_correct)?.id ?? null }] : [];
  });

  const live = liveStateSchema.safeParse(liveResult.data);

  return (
    <div className="flex flex-col gap-4">
      {/* Ensaio: nada conta nas estatísticas nem no perfil público. */}
      {session.is_test ? <RehearsalBanner sessionId={id} /> : null}
      <ControlRoom
        session={{ id, title: session.title, status: session.status, joinCode: session.join_code }}
        interactions={controlInteractions}
        deck={buildDeck(slideUrls.length, controlInteractions)}
        slideUrls={slideUrls}
        initialLive={live.success ? live.data : null}
        initialResults={toResultsMap(resultsResult.data ?? [])}
        joinUrl={joinUrl(session.join_code)}
        clock={sessionClock(session)}
        plannedMinutes={session.estimated_duration_minutes}
        raffle={raffle}
        engagement={{
          qa_enabled: session.qa_enabled,
          qa_moderated: session.qa_moderated,
          reactions_enabled: session.reactions_enabled,
          profanity_filter: session.profanity_filter,
          moderate_open_text: session.moderate_open_text,
        }}
      />
    </div>
  );
}
