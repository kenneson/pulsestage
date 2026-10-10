"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hasDbErrorCode } from "@/lib/supabase/errors";
import { fail, isUuid, ok, type ActionResult } from "@/lib/action-result";

/** Mostra (fechando a pergunta ativa) ou tira do telão o ranking do quiz. */
export async function showLeaderboardAction(sessionId: string, show: boolean): Promise<ActionResult> {
  if (!isUuid(sessionId) || !z.boolean().safeParse(show).success) return fail("Dados inválidos.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("show_leaderboard", { p_session_id: sessionId, p_show: show });
  if (error) {
    if (hasDbErrorCode(error, "session_not_live")) return fail("Inicie ou retome a sessão para mostrar o ranking.");
    return fail("Não foi possível mudar o ranking no telão.");
  }
  return ok(null);
}
