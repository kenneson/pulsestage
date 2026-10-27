import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSegmentResults } from "@/lib/data/display";
import { isUuid } from "@/lib/action-result";

const noStore = { "Cache-Control": "no-store" };
const querySchema = z.object({ interaction: z.uuid() });

/**
 * Resultados da pergunta no ar só do grupo escolhido em "Comparar grupos" (agregado, sem respostas
 * individuais além dos textos que o telão já mostra). 404 sem filtro ligado ou com a pergunta fora do ar.
 */
export async function GET(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  if (!isUuid(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400, headers: noStore });

  const query = querySchema.safeParse({ interaction: new URL(request.url).searchParams.get("interaction") });
  if (!query.success) return NextResponse.json({ error: "invalid_interaction" }, { status: 400, headers: noStore });

  const results = await getSegmentResults(createAdminClient(), sessionId, query.data.interaction);
  if (!results) return NextResponse.json({ error: "no_segment" }, { status: 404, headers: noStore });
  return NextResponse.json(results, { headers: noStore });
}
