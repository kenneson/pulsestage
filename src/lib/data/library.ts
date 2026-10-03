import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { buildLibrary, type LibraryItem } from "@/lib/domain/library";

/** Biblioteca do speaker logado (RLS: só as próprias sessões). */
export async function loadLibrary(supabase: ServerSupabase): Promise<LibraryItem[]> {
  const [interactions, results, liveStates] = await Promise.all([
    fetchAllRows<{
      id: string;
      session_id: string;
      type: string;
      title: string;
      created_at: string;
      interaction_options: { label: string; position: number }[];
    }>((from, to) =>
      supabase
        .from("interactions")
        .select("id, session_id, type, title, created_at, interaction_options(label, position)")
        .order("created_at")
        .range(from, to),
    ),
    fetchAllRows<{ interaction_id: string; total: number }>((from, to) =>
      supabase.from("interaction_results").select("interaction_id, total").range(from, to),
    ),
    fetchAllRows<{ session_id: string; participant_count: number }>((from, to) =>
      supabase.from("session_live_state").select("session_id, participant_count").range(from, to),
    ),
  ]);

  const totals = new Map(results.map((r) => [r.interaction_id, r.total]));
  const participants = new Map(liveStates.map((s) => [s.session_id, s.participant_count]));

  return buildLibrary(
    interactions.map((i) => {
      const people = participants.get(i.session_id) ?? 0;
      return {
        id: i.id,
        sessionId: i.session_id,
        type: i.type,
        title: i.title,
        createdAt: i.created_at,
        optionLabels: [...i.interaction_options].sort((a, b) => a.position - b.position).map((o) => o.label),
        participation: people > 0 ? (totals.get(i.id) ?? 0) / people : null,
      };
    }),
  );
}
