import { NextResponse } from "next/server";
import { jsonError, noStore, ownedLiveSession } from "@/lib/live/route-auth";
import { selfPaceProgress } from "@/lib/domain/live-room";
import { acceptsResponses, isInteractionType } from "@/lib/domain/interactions";
import { fetchAllRows } from "../fetch-all";

/** Ritmo próprio: quantas pessoas começaram e quantas responderam todas as perguntas. Só o dono da sessão. */
export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const owned = await ownedLiveSession((await context.params).sessionId);
  if ("response" in owned) return owned.response;
  const { supabase, session } = owned;
  try {
    const { data: interactions, error } = await supabase.from("interactions").select("id, type").eq("session_id", session.id);
    if (error) throw error;
    const answerable = interactions.filter((i) => isInteractionType(i.type) && acceptsResponses(i.type)).map((i) => i.id);
    const rows = await fetchAllRows((from, to) =>
      supabase.from("responses").select("participant_id, interaction_id").eq("session_id", session.id).order("id").range(from, to),
    );
    return NextResponse.json({ ...selfPaceProgress(rows, answerable), questions: answerable.length }, { headers: noStore });
  } catch {
    return jsonError("unavailable", 503);
  }
}
