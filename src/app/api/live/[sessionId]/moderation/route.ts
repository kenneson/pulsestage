import { NextResponse } from "next/server";
import { getModerationQueue } from "@/lib/data/engagement";
import { isUuid } from "@/lib/action-result";
import { jsonError, noStore, ownedLiveSession } from "@/lib/live/route-auth";

/** Fila de moderação (respostas aguardando ou ocultas) de uma pergunta de texto: ?interaction=<id>. */
export async function GET(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const interactionId = new URL(request.url).searchParams.get("interaction");
  if (!isUuid(interactionId)) return jsonError("invalid_interaction", 400);
  const owned = await ownedLiveSession((await context.params).sessionId);
  if ("response" in owned) return owned.response;

  const { data: interaction } = await owned.supabase
    .from("interactions")
    .select("id")
    .eq("id", interactionId)
    .eq("session_id", owned.session.id)
    .maybeSingle();
  if (!interaction) return jsonError("not_found", 404);
  try {
    return NextResponse.json(await getModerationQueue(owned.supabase, interactionId), { headers: noStore });
  } catch {
    return jsonError("unavailable", 503);
  }
}
