import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, noStore, ownedLiveSession } from "@/lib/live/route-auth";
import { segmentMembers, segmentSnapshot } from "@/lib/domain/segment-results";
import { normalizeSettings, isInteractionType } from "@/lib/domain/interactions";
import { fetchAllRows } from "../fetch-all";

const querySchema = z.object({ interaction: z.uuid(), option: z.uuid() });

/**
 * "Comparar grupos" na sala ao vivo: resultado da pergunta só com quem escolheu a alternativa da enquete de
 * perfil. Recalculado das respostas brutas (mesmas regras do agregado público). Só o dono da sessão.
 */
export async function GET(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const owned = await ownedLiveSession((await context.params).sessionId);
  if ("response" in owned) return owned.response;
  const url = new URL(request.url);
  const query = querySchema.safeParse({ interaction: url.searchParams.get("interaction"), option: url.searchParams.get("option") });
  if (!query.success) return jsonError("invalid_query", 400);
  const { supabase, session } = owned;

  try {
    // A alternativa tem de ser de uma enquete de perfil desta sessão.
    const { data: option } = await supabase
      .from("interaction_options")
      .select("id, interaction_id, interactions!inner(session_id, type, settings)")
      .eq("id", query.data.option)
      .maybeSingle();
    const segment = option?.interactions;
    if (
      !option ||
      !segment ||
      segment.session_id !== session.id ||
      !isInteractionType(segment.type) ||
      segment.type !== "multiple_choice" ||
      !normalizeSettings(segment.type, segment.settings).isSegment
    ) {
      return jsonError("segment_not_found", 404);
    }

    const [segmentRows, rows] = await Promise.all([
      fetchAllRows((from, to) =>
        supabase
          .from("responses")
          .select("participant_id, value")
          .eq("interaction_id", option.interaction_id)
          .order("id")
          .range(from, to),
      ),
      fetchAllRows((from, to) =>
        supabase
          .from("responses")
          .select("id, participant_id, aggregate_key, value, created_at, moderation")
          .eq("interaction_id", query.data.interaction)
          .eq("session_id", session.id)
          .order("id")
          .range(from, to),
      ),
    ]);
    const members = segmentMembers(segmentRows, query.data.option);
    const snapshot = segmentSnapshot(rows, members);
    return NextResponse.json({ snapshot, people: members.size }, { headers: noStore });
  } catch {
    return jsonError("unavailable", 503);
  }
}
