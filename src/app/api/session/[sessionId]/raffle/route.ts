import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicRaffle } from "@/lib/data/raffle";
import { isUuid } from "@/lib/action-result";

const noStore = { "Cache-Control": "no-store" };

/** Sorteio para a tela do projetor. 404 quando o palestrante não está mostrando o sorteio. */
export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  if (!isUuid(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400, headers: noStore });

  const raffle = await getPublicRaffle(createAdminClient(), sessionId);
  if (!raffle) return NextResponse.json({ error: "not_shown" }, { status: 404, headers: noStore });
  return NextResponse.json(raffle, { headers: noStore });
}
