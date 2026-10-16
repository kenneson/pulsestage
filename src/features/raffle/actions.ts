"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import { getOwnedSession } from "@/lib/data/sessions";
import { hasDbErrorCode } from "@/lib/supabase/errors";
import { MAX_PRIZES, prizeInputSchema, raffleSettingsSchema } from "@/lib/domain/raffle";
import { getMessageTranslator } from "@/i18n/server";
import { fail, isUuid, ok, type ActionResult } from "@/lib/action-result";

type RaffleErrorsT = Awaited<ReturnType<typeof getTranslations<"session.raffle.errors">>>;

/** Textos de erro: sessão (inválida, não encontrada), sorteio e genéricos, no idioma do painel. */
async function translators() {
  const [t, tSession, tErrors] = await Promise.all([
    getTranslations("session.raffle.errors"),
    getTranslations("session.errors"),
    getTranslations("errors"),
  ]);
  return { t, tSession, invalidData: tErrors("invalidData") };
}

function revalidateRaffle(sessionId: string) {
  revalidatePath(`/dashboard/sessions/${sessionId}`, "layout");
  revalidatePath("/dashboard/sorteios");
}

// ---------------------------------------------------------------------------
// Configuração e prêmios (aba "Sorteio")
// ---------------------------------------------------------------------------

/** Liga/desliga o sorteio e escolhe quem concorre. Pode mudar a qualquer momento. */
export async function saveRaffleSettingsAction(sessionId: string, raw: unknown): Promise<ActionResult> {
  const { t, tSession } = await translators();
  if (!isUuid(sessionId)) return fail(tSession("invalidSession"));
  const parsed = raffleSettingsSchema.safeParse(raw);
  if (!parsed.success) return fail((await getMessageTranslator()).issue(parsed.error));

  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return fail(tSession("sessionNotFound"));

  if (parsed.data.eligibility === null && session.raffle_eligibility !== null && session.status !== "draft") {
    // Sorteio desligado não fica no telão (antes de desligar: a função exige o sorteio ativo).
    await supabase.rpc("show_raffle", { p_session_id: sessionId, p_show: false });
  }
  const { error } = await supabase
    .from("sessions")
    .update({ raffle_eligibility: parsed.data.eligibility })
    .eq("id", sessionId);
  if (error) return fail(t("saveSettingsFailed"));
  revalidateRaffle(sessionId);
  return ok(null);
}

export async function savePrizeAction(
  sessionId: string,
  prizeId: string | null,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { t, tSession, invalidData } = await translators();
  if (!isUuid(sessionId) || (prizeId !== null && !isUuid(prizeId))) return fail(invalidData);
  const parsed = prizeInputSchema.safeParse(raw);
  if (!parsed.success) return fail((await getMessageTranslator()).issue(parsed.error));
  const input = parsed.data;
  const fields = {
    name: input.name,
    description: input.description,
    kind: input.kind,
    quantity: input.quantity,
    winner_message: input.winnerMessage,
  };

  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return fail(tSession("sessionNotFound"));

  if (prizeId) {
    const { data, error } = await supabase
      .from("raffle_prizes")
      .update(fields)
      .eq("id", prizeId)
      .eq("session_id", sessionId)
      .select("id")
      .maybeSingle();
    if (error || !data) return fail(t("savePrizeFailed"));
    revalidateRaffle(sessionId);
    return ok({ id: data.id });
  }

  const { data: existing, error: listError } = await supabase
    .from("raffle_prizes")
    .select("position")
    .eq("session_id", sessionId)
    .order("position", { ascending: false });
  if (listError) return fail(t("savePrizeFailed"));
  if (existing.length >= MAX_PRIZES) return fail(t("maxPrizes", { max: MAX_PRIZES }));

  const { data, error } = await supabase
    .from("raffle_prizes")
    .insert({ ...fields, session_id: sessionId, position: (existing[0]?.position ?? -1) + 1 })
    .select("id")
    .single();
  if (error) return fail(t("savePrizeFailed"));
  revalidateRaffle(sessionId);
  return ok({ id: data.id });
}

/** Excluir o prêmio também apaga os ganhadores dele. */
export async function deletePrizeAction(sessionId: string, prizeId: string): Promise<ActionResult> {
  const { t, invalidData } = await translators();
  if (!isUuid(sessionId) || !isUuid(prizeId)) return fail(invalidData);
  const supabase = await createClient();
  const { error } = await supabase.from("raffle_prizes").delete().eq("id", prizeId).eq("session_id", sessionId);
  if (error) return fail(t("deletePrizeFailed"));
  revalidateRaffle(sessionId);
  return ok(null);
}

/** Troca o prêmio de lugar com o vizinho (a ordem é a do sorteio). */
export async function movePrizeAction(sessionId: string, prizeId: string, direction: -1 | 1): Promise<ActionResult> {
  const { t, invalidData } = await translators();
  if (!isUuid(sessionId) || !isUuid(prizeId) || (direction !== -1 && direction !== 1)) return fail(invalidData);
  const supabase = await createClient();
  const { data: prizes, error } = await supabase
    .from("raffle_prizes")
    .select("id, position")
    .eq("session_id", sessionId)
    .order("position")
    .order("created_at");
  if (error) return fail(t("reorderFailed"));
  const index = prizes.findIndex((p) => p.id === prizeId);
  const neighbor = prizes[index + direction];
  if (index < 0 || !neighbor) return ok(null);

  // Renumera tudo na nova ordem (posições antigas podem ter empates).
  const order = prizes.map((p) => p.id);
  [order[index], order[index + direction]] = [order[index + direction]!, order[index]!];
  for (const [position, id] of order.entries()) {
    const { error: updateError } = await supabase.from("raffle_prizes").update({ position }).eq("id", id);
    if (updateError) return fail(t("reorderFailed"));
  }
  revalidateRaffle(sessionId);
  return ok(null);
}

// ---------------------------------------------------------------------------
// Sorteio (sala ao vivo, também depois de encerrar)
// ---------------------------------------------------------------------------

function drawError(t: RaffleErrorsT, error: { message?: string }): string {
  if (hasDbErrorCode(error, "no_entrants")) return t("noEntrants");
  if (hasDbErrorCode(error, "prize_full")) return t("prizeFull");
  if (hasDbErrorCode(error, "raffle_disabled")) return t("raffleDisabled");
  if (hasDbErrorCode(error, "session_not_started")) return t("notStarted");
  return t("drawFailed");
}

async function draw(supabase: ServerSupabase, sessionId: string, prizeId: string): Promise<ActionResult<{ id: string }>> {
  const { data, error } = await supabase.rpc("draw_raffle", { p_session_id: sessionId, p_prize_id: prizeId });
  if (error) return fail(drawError(await getTranslations("session.raffle.errors"), error));
  revalidatePath("/dashboard/sorteios");
  return ok({ id: data });
}

export async function drawRaffleAction(sessionId: string, prizeId: string): Promise<ActionResult<{ id: string }>> {
  if (!isUuid(sessionId) || !isUuid(prizeId)) return fail((await translators()).invalidData);
  return draw(await createClient(), sessionId, prizeId);
}

/** Ganhador ausente: sai do sorteio e outra pessoa é sorteada para o mesmo prêmio. */
export async function redrawRaffleAction(sessionId: string, winnerId: string): Promise<ActionResult<{ id: string }>> {
  const { t, invalidData } = await translators();
  if (!isUuid(sessionId) || !isUuid(winnerId)) return fail(invalidData);
  const supabase = await createClient();
  const { data: winner } = await supabase
    .from("raffle_winners")
    .select("prize_id")
    .eq("id", winnerId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!winner) return fail(t("winnerNotFound"));

  const { error } = await supabase.rpc("forfeit_raffle_winner", { p_winner_id: winnerId });
  if (error) return fail(t("forfeitFailed"));
  return draw(supabase, sessionId, winner.prize_id);
}

export async function showRaffleAction(sessionId: string, show: boolean): Promise<ActionResult> {
  const { t, invalidData } = await translators();
  if (!isUuid(sessionId) || !z.boolean().safeParse(show).success) return fail(invalidData);
  const supabase = await createClient();
  const { error } = await supabase.rpc("show_raffle", { p_session_id: sessionId, p_show: show });
  if (error) {
    if (hasDbErrorCode(error, "raffle_unavailable")) return fail(t("unavailable"));
    return fail(t("showFailed"));
  }
  return ok(null);
}

/** Controle de entrega do prêmio (página Sorteios e aba da sessão). */
export async function setPrizeDeliveredAction(winnerId: string, delivered: boolean): Promise<ActionResult> {
  const { t, invalidData } = await translators();
  if (!isUuid(winnerId) || !z.boolean().safeParse(delivered).success) return fail(invalidData);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("raffle_winners")
    .update({ delivered_at: delivered ? new Date().toISOString() : null })
    .eq("id", winnerId)
    .select("session_id")
    .maybeSingle();
  if (error || !data) return fail(t("deliveryFailed"));
  revalidateRaffle(data.session_id);
  return ok(null);
}
