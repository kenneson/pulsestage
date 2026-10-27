import { NextResponse } from "next/server";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicLeaderboard, getPublicSession } from "@/lib/data/public";
import { getTeamLeaderboard } from "@/lib/data/display";
import { isUuid } from "@/lib/action-result";

const noStore = { "Cache-Control": "no-store" };
const modeSchema = z.enum(["people", "teams"]).nullable();

/**
 * Ranking do quiz para a tela do projetor: por pessoas (padrão) ou, com `?mode=teams`, por equipes.
 * 404 quando o palestrante não está mostrando o ranking.
 */
export async function GET(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  if (!isUuid(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400, headers: noStore });
  const mode = modeSchema.safeParse(new URL(request.url).searchParams.get("mode"));
  if (!mode.success) return NextResponse.json({ error: "invalid_mode" }, { status: 400, headers: noStore });

  const admin = createAdminClient();
  if (mode.data === "teams") {
    const teams = await getTeamLeaderboard(admin, sessionId);
    if (!teams) return NextResponse.json({ error: "not_shown" }, { status: 404, headers: noStore });
    return NextResponse.json({ teams }, { headers: noStore });
  }

  const session = await getPublicSession(admin, sessionId);
  if (!session) return NextResponse.json({ error: "not_shown" }, { status: 404, headers: noStore });
  // "Participante XXXX" no idioma da sessão (o telão fala a língua da plateia).
  const t = await getTranslations({ locale: session.locale, namespace: "domain" });
  const entries = await getPublicLeaderboard(admin, sessionId, t("anonymousParticipant"));
  if (!entries) return NextResponse.json({ error: "not_shown" }, { status: 404, headers: noStore });
  return NextResponse.json({ entries }, { headers: noStore });
}
