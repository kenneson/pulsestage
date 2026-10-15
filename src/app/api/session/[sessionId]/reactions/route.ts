import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReactionsSince } from "@/lib/data/engagement";
import { isUuid } from "@/lib/action-result";

const noStore = { "Cache-Control": "no-store" };
// Sem "after" = só o ponto de partida (nada de reações antigas no primeiro pedido).
const afterSchema = z
  .string()
  .regex(/^\d{1,15}$/)
  .transform(Number)
  .nullable();

/** Reações novas para o telão (só contagens por tipo). 404 com a sessão fora do ar ou reações desligadas. */
export async function GET(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  if (!isUuid(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400, headers: noStore });

  const after = afterSchema.safeParse(new URL(request.url).searchParams.get("after"));
  if (!after.success) return NextResponse.json({ error: "invalid_after" }, { status: 400, headers: noStore });

  const data = await getReactionsSince(createAdminClient(), sessionId, after.data);
  if (!data) return NextResponse.json({ error: "off" }, { status: 404, headers: noStore });
  return NextResponse.json(data, { headers: noStore });
}
