import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { InteractionRow, SessionRow } from "@/lib/supabase/types";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { legacyEvents, type TimelineEvent } from "@/lib/domain/timeline";

const KINDS = new Set<TimelineEvent["kind"]>(["status", "slide", "interaction_open", "interaction_close"]);

/**
 * Eventos da apresentação (RLS: só o dono lê). Sessões de antes do registro de eventos
 * caem na reconstrução pelas perguntas; `recorded` diz qual dos dois casos é.
 */
export async function getTimelineEvents(
  supabase: ServerSupabase,
  session: Pick<SessionRow, "id" | "started_at" | "ended_at">,
  interactions: readonly Pick<InteractionRow, "id" | "activated_at" | "closed_at">[],
): Promise<{ events: TimelineEvent[]; recorded: boolean }> {
  const rows = await fetchAllRows<{
    at: string;
    kind: string;
    status: string | null;
    slide: number | null;
    interaction_id: string | null;
  }>((from, to) =>
    supabase
      .from("session_events")
      .select("at, kind, status, slide, interaction_id")
      .eq("session_id", session.id)
      .order("at")
      .order("id")
      .range(from, to),
  );

  const events: TimelineEvent[] = rows.flatMap((r) =>
    KINDS.has(r.kind as TimelineEvent["kind"])
      ? [{ at: r.at, kind: r.kind as TimelineEvent["kind"], status: r.status, slide: r.slide, interactionId: r.interaction_id }]
      : [],
  );
  if (events.some((e) => e.kind === "status" && e.status === "live")) return { events, recorded: true };

  return {
    events: legacyEvents(
      { startedAt: session.started_at, endedAt: session.ended_at },
      interactions.map((i) => ({ id: i.id, activatedAt: i.activated_at, closedAt: i.closed_at })),
    ),
    recorded: false,
  };
}
