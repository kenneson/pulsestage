import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getQuizResult } from "@/lib/data/quiz-result";
import { getParticipantIdFromCookie } from "@/lib/participant/token";
import { isUuid } from "@/lib/action-result";

const noStore = { "Cache-Control": "no-store" };

/**
 * Resultado de um quiz para quem participa: acertou, pontos, resposta certa e a própria posição.
 * Só depois que o quiz fecha (ou o tempo acaba); antes disso responde `pending`.
 */
export async function GET(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const interactionId = new URL(request.url).searchParams.get("interaction");
  if (!isUuid(sessionId) || !isUuid(interactionId)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: noStore });
  }

  const participantId = await getParticipantIdFromCookie(sessionId);
  if (!participantId) return NextResponse.json({ error: "not_joined" }, { status: 401, headers: noStore });

  try {
    const result = await getQuizResult(createAdminClient(), sessionId, participantId, interactionId);
    if (!result) return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });
    return NextResponse.json(result, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
