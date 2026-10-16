import { NextResponse } from "next/server";
import { listSessionQuestions } from "@/lib/data/engagement";
import { jsonError, noStore, ownedLiveSession } from "@/lib/live/route-auth";

/** Perguntas da plateia para o card da sala ao vivo (todas, com status de moderação). */
export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const owned = await ownedLiveSession((await context.params).sessionId);
  if ("response" in owned) return owned.response;
  try {
    return NextResponse.json(await listSessionQuestions(owned.supabase, owned.session.id), { headers: noStore });
  } catch {
    return jsonError("unavailable", 503);
  }
}
