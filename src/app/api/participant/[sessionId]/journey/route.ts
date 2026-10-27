import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getJourneyForParticipant } from "@/lib/data/participant-journey";
import { getParticipantIdFromCookie } from "@/lib/participant/token";
import { isUuid } from "@/lib/action-result";

const noStore = { "Cache-Control": "no-store" };

/** Ritmo próprio: o roteiro inteiro (sem gabarito) e o que o participante do cookie já respondeu. */
export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  if (!isUuid(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400, headers: noStore });

  const participantId = await getParticipantIdFromCookie(sessionId);
  if (!participantId) return NextResponse.json({ error: "not_joined" }, { status: 401, headers: noStore });

  try {
    const journey = await getJourneyForParticipant(createAdminClient(), sessionId, participantId);
    if (!journey) return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });
    return NextResponse.json(journey, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
