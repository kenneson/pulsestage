import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getParticipantQuestions } from "@/lib/data/engagement";
import { getParticipantIdFromCookie } from "@/lib/participant/token";
import { isUuid } from "@/lib/action-result";

const noStore = { "Cache-Control": "no-store" };

/** Perguntas da plateia para o celular de quem participa (cookie assinado). */
export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  if (!isUuid(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400, headers: noStore });

  const participantId = await getParticipantIdFromCookie(sessionId);
  if (!participantId) return NextResponse.json({ error: "not_joined" }, { status: 401, headers: noStore });

  return NextResponse.json(await getParticipantQuestions(createAdminClient(), sessionId, participantId), { headers: noStore });
}
