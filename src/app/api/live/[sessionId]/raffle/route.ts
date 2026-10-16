import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { getRaffleState } from "@/lib/data/raffle";
import { jsonError, noStore, ownedLiveSession } from "@/lib/live/route-auth";

/** Estado do sorteio para o card da sala ao vivo (no idioma do painel). */
export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const owned = await ownedLiveSession((await context.params).sessionId);
  if ("response" in owned) return owned.response;
  try {
    const anonymous = (await getTranslations("domain"))("anonymousParticipant");
    const state = await getRaffleState(owned.supabase, owned.session.id, owned.session.raffle_eligibility, anonymous);
    return NextResponse.json(state, { headers: noStore });
  } catch {
    return jsonError("unavailable", 503);
  }
}
