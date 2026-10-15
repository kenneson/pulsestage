import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicLeaderboard, getPublicSession } from "@/lib/data/public";
import { isUuid } from "@/lib/action-result";

const noStore = { "Cache-Control": "no-store" };

/** Ranking do quiz para a tela do projetor. 404 quando o palestrante não está mostrando o ranking. */
export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  if (!isUuid(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400, headers: noStore });

  const admin = createAdminClient();
  const session = await getPublicSession(admin, sessionId);
  if (!session) return NextResponse.json({ error: "not_shown" }, { status: 404, headers: noStore });
  // "Participante XXXX" no idioma da sessão (o telão fala a língua da plateia).
  const t = await getTranslations({ locale: session.locale, namespace: "domain" });
  const entries = await getPublicLeaderboard(admin, sessionId, t("anonymousParticipant"));
  if (!entries) return NextResponse.json({ error: "not_shown" }, { status: 404, headers: noStore });
  return NextResponse.json({ entries }, { headers: noStore });
}
