import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOwnedSession, getSessionInteractions } from "@/lib/data/sessions";
import { toPublicInteraction } from "@/lib/domain/interactions";
import { liveStateSchema } from "@/lib/realtime/schemas";
import { toResultsMap } from "@/lib/domain/results";
import { joinUrl } from "@/lib/env";
import { isUuid } from "@/lib/action-result";
import { ControlRoom, type ControlRoomInteraction } from "@/components/live/control-room";

export const metadata: Metadata = { title: "Sala ao vivo" };

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const session = await getOwnedSession(supabase, id);
  if (!session) notFound();

  const [interactions, liveResult, resultsResult] = await Promise.all([
    getSessionInteractions(supabase, id),
    supabase.from("session_live_state").select("*").eq("session_id", id).maybeSingle(),
    supabase.from("interaction_results").select("*").eq("session_id", id),
  ]);

  const controlInteractions: ControlRoomInteraction[] = interactions.flatMap((row) => {
    const pub = toPublicInteraction(row, row.options);
    return pub ? [{ ...pub, correctOptionId: row.options.find((o) => o.is_correct)?.id ?? null }] : [];
  });

  const live = liveStateSchema.safeParse(liveResult.data);

  return (
    <ControlRoom
      session={{ id, title: session.title, status: session.status, joinCode: session.join_code }}
      interactions={controlInteractions}
      initialLive={live.success ? live.data : null}
      initialResults={toResultsMap(resultsResult.data ?? [])}
      joinUrl={joinUrl(session.join_code)}
    />
  );
}
