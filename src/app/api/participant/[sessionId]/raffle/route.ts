import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getParticipantRaffle } from "@/lib/data/raffle";
import { getParticipantIdFromCookie } from "@/lib/participant/token";
import { isUuid } from "@/lib/action-result";

const noStore = { "Cache-Control": "no-store" };

/** Número do sorteio do participante do cookie e, depois da revelação no telão, o prêmio que ganhou. */
export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  if (!isUuid(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400, headers: noStore });

  const participantId = await getParticipantIdFromCookie(sessionId);
  if (!participantId) return NextResponse.json({ error: "not_joined" }, { status: 401, headers: noStore });

  const ticket = await getParticipantRaffle(createAdminClient(), sessionId, participantId);
  return NextResponse.json(ticket, { headers: noStore });
}
