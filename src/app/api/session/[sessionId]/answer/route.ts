import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRevealedAnswer } from "@/lib/data/display";
import { isUuid } from "@/lib/action-result";

const noStore = { "Cache-Control": "no-store" };
const querySchema = z.object({ interaction: z.uuid() });

/**
 * Resposta certa da pergunta no ar para o telão (alternativa, número ou respostas aceitas).
 * 404 enquanto o palestrante não liga "Revelar resposta" ou se a pergunta não está mais no ar.
 */
export async function GET(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  if (!isUuid(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400, headers: noStore });

  const query = querySchema.safeParse({ interaction: new URL(request.url).searchParams.get("interaction") });
  if (!query.success) return NextResponse.json({ error: "invalid_interaction" }, { status: 400, headers: noStore });

  const answer = await getRevealedAnswer(createAdminClient(), sessionId, query.data.interaction);
  if (!answer) return NextResponse.json({ error: "not_revealed" }, { status: 404, headers: noStore });
  return NextResponse.json({ answer }, { headers: noStore });
}
