import { NextResponse } from "next/server";
import { getReactionTotals } from "@/lib/data/engagement";
import { jsonError, noStore, ownedLiveSession } from "@/lib/live/route-auth";

/** Total de reações por tipo (contado no banco). */
export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const owned = await ownedLiveSession((await context.params).sessionId);
  if ("response" in owned) return owned.response;
  try {
    return NextResponse.json(await getReactionTotals(owned.supabase, owned.session.id), { headers: noStore });
  } catch {
    return jsonError("unavailable", 503);
  }
}
