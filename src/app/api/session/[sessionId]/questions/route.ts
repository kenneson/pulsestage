import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDisplayQuestions } from "@/lib/data/engagement";
import { isUuid } from "@/lib/action-result";

const noStore = { "Cache-Control": "no-store" };

/** Perguntas da plateia para o telão. 404 quando o palestrante não está mostrando as perguntas. */
export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  if (!isUuid(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400, headers: noStore });

  const data = await getDisplayQuestions(createAdminClient(), sessionId);
  if (!data) return NextResponse.json({ error: "not_shown" }, { status: 404, headers: noStore });
  return NextResponse.json(data, { headers: noStore });
}
