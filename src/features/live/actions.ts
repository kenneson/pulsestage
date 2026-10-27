"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { hasDbErrorCode } from "@/lib/supabase/errors";
import { fail, isUuid, ok, type ActionResult } from "@/lib/action-result";

/** Mostra (fechando a pergunta ativa) ou tira do telão o ranking do quiz. */
export async function showLeaderboardAction(sessionId: string, show: boolean): Promise<ActionResult> {
  if (!isUuid(sessionId) || !z.boolean().safeParse(show).success) {
    return fail((await getTranslations("errors"))("invalidData"));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("show_leaderboard", { p_session_id: sessionId, p_show: show });
  if (error) {
    const t = await getTranslations("live.errors");
    if (hasDbErrorCode(error, "session_not_live")) return fail(t("leaderboardNotLive"));
    return fail(t("leaderboardFailed"));
  }
  return ok(null);
}

/** Revela (ou volta a esconder) no telão os resultados de uma pergunta com "Esconder resultados". */
export async function revealResultsAction(sessionId: string, reveal: boolean): Promise<ActionResult> {
  return revealRpc("reveal_results", sessionId, reveal);
}

/** Revela a resposta certa no telão (quiz, quiz de digitar, adivinhe o número); também revela os resultados. */
export async function revealAnswerAction(sessionId: string, reveal: boolean): Promise<ActionResult> {
  return revealRpc("reveal_answer", sessionId, reveal);
}

async function revealRpc(fn: "reveal_results" | "reveal_answer", sessionId: string, reveal: boolean): Promise<ActionResult> {
  if (!isUuid(sessionId) || !z.boolean().safeParse(reveal).success) {
    return fail((await getTranslations("errors"))("invalidData"));
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, { p_session_id: sessionId, p_reveal: reveal });
  if (error) {
    const t = await getTranslations("live.errors");
    if (hasDbErrorCode(error, "session_not_live")) return fail(t("screenNotLive"));
    return fail(t("revealFailed"));
  }
  return ok(null);
}

/** Filtro "comparar grupos" do telão: alternativa de uma enquete de perfil (null = todos). */
export async function setSegmentFilterAction(sessionId: string, optionId: string | null): Promise<ActionResult> {
  if (!isUuid(sessionId) || (optionId !== null && !isUuid(optionId))) {
    return fail((await getTranslations("errors"))("invalidData"));
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_segment_filter", { p_session_id: sessionId, p_option_id: optionId ?? undefined });
  if (error) {
    const t = await getTranslations("live.errors");
    if (hasDbErrorCode(error, "session_not_live")) return fail(t("screenNotLive"));
    return fail(t("segmentFailed"));
  }
  return ok(null);
}

const leaderboardModeSchema = z.enum(["people", "teams"]);

/** Ranking do telão por pessoas ou por equipes. */
export async function setLeaderboardModeAction(sessionId: string, mode: "people" | "teams"): Promise<ActionResult> {
  if (!isUuid(sessionId) || !leaderboardModeSchema.safeParse(mode).success) {
    return fail((await getTranslations("errors"))("invalidData"));
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_leaderboard_mode", { p_session_id: sessionId, p_mode: mode });
  if (error) {
    const t = await getTranslations("live.errors");
    if (hasDbErrorCode(error, "session_not_live")) return fail(t("leaderboardNotLive"));
    return fail(t("leaderboardFailed"));
  }
  return ok(null);
}
