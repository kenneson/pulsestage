import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentForParticipant } from "@/lib/data/public";
import { getParticipantIdFromCookie } from "@/lib/participant/token";
import { isUuid } from "@/lib/action-result";

const noStore = { "Cache-Control": "no-store" };

/** Interaction ativa (sanitizada) + se o participante do cookie já respondeu. */
export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  if (!isUuid(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400, headers: noStore });

  const participantId = await getParticipantIdFromCookie(sessionId);
  if (!participantId) return NextResponse.json({ error: "not_joined" }, { status: 401, headers: noStore });

  const current = await getCurrentForParticipant(createAdminClient(), sessionId, participantId);
  return NextResponse.json(current, { headers: noStore });
}
