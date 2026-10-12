"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import { getOwnedSession } from "@/lib/data/sessions";
import { getRaffleState, type RaffleState } from "@/lib/data/raffle";
import { hasDbErrorCode } from "@/lib/supabase/errors";
import { MAX_PRIZES, prizeInputSchema, raffleSettingsSchema } from "@/lib/domain/raffle";
import { fail, firstIssue, isUuid, ok, type ActionResult } from "@/lib/action-result";

function revalidateRaffle(sessionId: string) {
  revalidatePath(`/dashboard/sessions/${sessionId}`, "layout");
  revalidatePath("/dashboard/sorteios");
}

// ---------------------------------------------------------------------------
// Configuração e prêmios (aba "Sorteio")
// ---------------------------------------------------------------------------

/** Liga/desliga o sorteio e escolhe quem concorre. Pode mudar a qualquer momento. */
export async function saveRaffleSettingsAction(sessionId: string, raw: unknown): Promise<ActionResult> {
  if (!isUuid(sessionId)) return fail("Sessão inválida.");
  const parsed = raffleSettingsSchema.safeParse(raw);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return fail("Sessão não encontrada.");

  if (parsed.data.eligibility === null && session.raffle_eligibility !== null && session.status !== "draft") {
    // Sorteio desligado não fica no telão (antes de desligar: a função exige o sorteio ativo).
    await supabase.rpc("show_raffle", { p_session_id: sessionId, p_show: false });
  }
  const { error } = await supabase
    .from("sessions")
    .update({ raffle_eligibility: parsed.data.eligibility })
    .eq("id", sessionId);
  if (error) return fail("Não foi possível salvar o sorteio.");
  revalidateRaffle(sessionId);
  return ok(null);
}

export async function savePrizeAction(
  sessionId: string,
  prizeId: string | null,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  if (!isUuid(sessionId) || (prizeId !== null && !isUuid(prizeId))) return fail("Dados inválidos.");
  const parsed = prizeInputSchema.safeParse(raw);
  if (!parsed.success) return fail(firstIssue(parsed.error));
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
  if (!session) return fail("Sessão não encontrada.");

  if (prizeId) {
    const { data, error } = await supabase
      .from("raffle_prizes")
      .update(fields)
      .eq("id", prizeId)
      .eq("session_id", sessionId)
      .select("id")
      .maybeSingle();
    if (error || !data) return fail("Não foi possível salvar o prêmio.");
    revalidateRaffle(sessionId);
    return ok({ id: data.id });
  }

  const { data: existing, error: listError } = await supabase
    .from("raffle_prizes")
    .select("position")
    .eq("session_id", sessionId)
    .order("position", { ascending: false });
  if (listError) return fail("Não foi possível salvar o prêmio.");
  if (existing.length >= MAX_PRIZES) return fail(`No máximo ${MAX_PRIZES} prêmios por sessão.`);

  const { data, error } = await supabase
    .from("raffle_prizes")
    .insert({ ...fields, session_id: sessionId, position: (existing[0]?.position ?? -1) + 1 })
    .select("id")
    .single();
  if (error) return fail("Não foi possível salvar o prêmio.");
  revalidateRaffle(sessionId);
  return ok({ id: data.id });
}

/** Excluir o prêmio também apaga os ganhadores dele. */
export async function deletePrizeAction(sessionId: string, prizeId: string): Promise<ActionResult> {
  if (!isUuid(sessionId) || !isUuid(prizeId)) return fail("Dados inválidos.");
  const supabase = await createClient();
  const { error } = await supabase.from("raffle_prizes").delete().eq("id", prizeId).eq("session_id", sessionId);
  if (error) return fail("Não foi possível excluir o prêmio.");
  revalidateRaffle(sessionId);
  return ok(null);
}

/** Troca o prêmio de lugar com o vizinho (a ordem é a do sorteio). */
export async function movePrizeAction(sessionId: string, prizeId: string, direction: -1 | 1): Promise<ActionResult> {
  if (!isUuid(sessionId) || !isUuid(prizeId) || (direction !== -1 && direction !== 1)) return fail("Dados inválidos.");
  const supabase = await createClient();
  const { data: prizes, error } = await supabase
    .from("raffle_prizes")
    .select("id, position")
    .eq("session_id", sessionId)
    .order("position")
    .order("created_at");
  if (error) return fail("Não foi possível mudar a ordem.");
  const index = prizes.findIndex((p) => p.id === prizeId);
  const neighbor = prizes[index + direction];
  if (index < 0 || !neighbor) return ok(null);

  // Renumera tudo na nova ordem (posições antigas podem ter empates).
  const order = prizes.map((p) => p.id);
  [order[index], order[index + direction]] = [order[index + direction]!, order[index]!];
  for (const [position, id] of order.entries()) {
    const { error: updateError } = await supabase.from("raffle_prizes").update({ position }).eq("id", id);
    if (updateError) return fail("Não foi possível mudar a ordem.");
  }
  revalidateRaffle(sessionId);
  return ok(null);
}

// ---------------------------------------------------------------------------
// Sorteio (sala ao vivo, também depois de encerrar)
// ---------------------------------------------------------------------------

function drawError(error: { message?: string }): string {
  if (hasDbErrorCode(error, "no_entrants")) return "Ninguém mais está concorrendo.";
  if (hasDbErrorCode(error, "prize_full")) return "Todos os ganhadores deste prêmio já foram sorteados.";
  if (hasDbErrorCode(error, "raffle_disabled")) return "Esta sessão não tem sorteio.";
  if (hasDbErrorCode(error, "session_not_started")) return "Inicie a sessão antes de sortear.";
  return "Não foi possível sortear agora.";
}

async function draw(supabase: ServerSupabase, sessionId: string, prizeId: string): Promise<ActionResult<{ id: string }>> {
  const { data, error } = await supabase.rpc("draw_raffle", { p_session_id: sessionId, p_prize_id: prizeId });
  if (error) return fail(drawError(error));
  revalidatePath("/dashboard/sorteios");
  return ok({ id: data });
}

export async function drawRaffleAction(sessionId: string, prizeId: string): Promise<ActionResult<{ id: string }>> {
  if (!isUuid(sessionId) || !isUuid(prizeId)) return fail("Dados inválidos.");
  return draw(await createClient(), sessionId, prizeId);
}

/** Ganhador ausente: sai do sorteio e outra pessoa é sorteada para o mesmo prêmio. */
export async function redrawRaffleAction(sessionId: string, winnerId: string): Promise<ActionResult<{ id: string }>> {
  if (!isUuid(sessionId) || !isUuid(winnerId)) return fail("Dados inválidos.");
  const supabase = await createClient();
  const { data: winner } = await supabase
    .from("raffle_winners")
    .select("prize_id")
    .eq("id", winnerId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!winner) return fail("Ganhador não encontrado.");

  const { error } = await supabase.rpc("forfeit_raffle_winner", { p_winner_id: winnerId });
  if (error) return fail("Não foi possível tirar o ganhador.");
  return draw(supabase, sessionId, winner.prize_id);
}

export async function showRaffleAction(sessionId: string, show: boolean): Promise<ActionResult> {
  if (!isUuid(sessionId) || !z.boolean().safeParse(show).success) return fail("Dados inválidos.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("show_raffle", { p_session_id: sessionId, p_show: show });
  if (error) {
    if (hasDbErrorCode(error, "raffle_unavailable")) return fail("Inicie a sessão e configure o sorteio antes.");
    return fail("Não foi possível mudar o sorteio no telão.");
  }
  return ok(null);
}

/** Controle de entrega do prêmio (página Sorteios e aba da sessão). */
export async function setPrizeDeliveredAction(winnerId: string, delivered: boolean): Promise<ActionResult> {
  if (!isUuid(winnerId) || !z.boolean().safeParse(delivered).success) return fail("Dados inválidos.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("raffle_winners")
    .update({ delivered_at: delivered ? new Date().toISOString() : null })
    .eq("id", winnerId)
    .select("session_id")
    .maybeSingle();
  if (error || !data) return fail("Não foi possível marcar a entrega.");
  revalidateRaffle(data.session_id);
  return ok(null);
}

/** Estado do sorteio para a sala ao vivo (relido periodicamente enquanto a pesquisa recebe respostas). */
export async function raffleStateAction(sessionId: string): Promise<ActionResult<RaffleState>> {
  if (!isUuid(sessionId)) return fail("Sessão inválida.");
  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return fail("Sessão não encontrada.");
  try {
    return ok(await getRaffleState(supabase, sessionId, session.raffle_eligibility));
  } catch {
    return fail("Não foi possível carregar o sorteio.");
  }
}
