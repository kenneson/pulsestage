import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicLobby } from "@/lib/data/public";
import { isUuid } from "@/lib/action-result";

const noStore = { "Cache-Control": "no-store" };

/** Sala de espera do telão (quem entrou). 404 quando o QR Code de entrada não está no telão. */
export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  if (!isUuid(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400, headers: noStore });
  try {
    const lobby = await getPublicLobby(createAdminClient(), sessionId);
    if (!lobby) return NextResponse.json({ error: "not_shown" }, { status: 404, headers: noStore });
    return NextResponse.json(lobby, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
