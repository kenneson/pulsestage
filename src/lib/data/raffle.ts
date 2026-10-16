import "server-only";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { participantLabel } from "@/lib/domain/metrics";
import { avatarOf } from "@/lib/domain/gamification";
import {
  eligibleParticipants,
  isRaffleEligibility,
  RAFFLE_REVEAL_MS,
  raffleOnPublicScreen,
  toPrizeKind,
  winnerRevealed,
  winnerVisibleToDisplay,
  type PrizeKind,
  type RaffleDisplay,
  type RaffleEligibility,
  type RaffleTicket,
  type RaffleWinnerView,
} from "@/lib/domain/raffle";

// Sorteio: leituras do painel (cliente do speaker, RLS), do telão e do celular (secret key, sanitizadas).

type Client = ServerSupabase | AdminSupabase;

export type RaffleWinnerAdmin = RaffleWinnerView & {
  prizeId: string;
  drawnAt: string;
  forfeitedAt: string | null;
  deliveredAt: string | null;
};

export type RafflePrizeAdmin = {
  id: string;
  name: string;
  description: string | null;
  kind: PrizeKind;
  quantity: number;
  winnerMessage: string | null;
  winners: RaffleWinnerAdmin[];
};

export type RaffleState = {
  eligibility: RaffleEligibility | null;
  prizes: RafflePrizeAdmin[];
  /** quem ainda pode ser sorteado */
  entrants: number;
  participants: number;
};

type WinnerRow = {
  id: string;
  prize_id: string;
  participant_id: string;
  number: number;
  drawn_at: string;
  forfeited_at: string | null;
  delivered_at: string | null;
  participants: { display_name: string | null; avatar: string | null } | null;
};

/** `anonymous`: palavra de "Participante XXXX" no idioma de quem lê (domain.anonymousParticipant). */
function winnerView(row: WinnerRow, anonymous?: string): RaffleWinnerView {
  return {
    id: row.id,
    number: row.number,
    name: participantLabel(
      { id: row.participant_id, display_name: row.participants?.display_name ?? null },
      row.participant_id,
      anonymous,
    ),
    avatar: avatarOf(row.participants?.avatar)?.emoji ?? null,
  };
}

async function loadPrizes(client: Client, sessionId: string) {
  const { data, error } = await client
    .from("raffle_prizes")
    .select("*")
    .eq("session_id", sessionId)
    .order("position")
    .order("created_at");
  if (error) throw new Error(error.message);
  return data;
}

async function loadWinners(client: Client, sessionId: string): Promise<WinnerRow[]> {
  const { data, error } = await client
    .from("raffle_winners")
    .select("id, prize_id, participant_id, number, drawn_at, forfeited_at, delivered_at, participants(display_name, avatar)")
    .eq("session_id", sessionId)
    .order("drawn_at");
  if (error) throw new Error(error.message);
  return data;
}

/** Quem pode concorrer (ids), lendo participantes e quem respondeu a pesquisa. */
async function eligibleIds(client: Client, sessionId: string, mode: RaffleEligibility): Promise<string[]> {
  const [participants, respondents] = await Promise.all([
    fetchAllRows<{ id: string }>((from, to) =>
      client.from("participants").select("id").eq("session_id", sessionId).range(from, to),
    ),
    mode === "survey"
      ? fetchAllRows<{ participant_id: string | null }>((from, to) =>
          client
            .from("survey_responses")
            .select("participant_id")
            .eq("session_id", sessionId)
            .not("participant_id", "is", null)
            .range(from, to),
        )
      : Promise.resolve([]),
  ]);
  const respondentIds = new Set(respondents.map((r) => r.participant_id).filter((id): id is string => id !== null));
  return eligibleParticipants(
    mode,
    participants.map((p) => p.id),
    respondentIds,
  );
}

/**
 * Painel do speaker: prêmios, ganhadores (inclusive ausentes) e quantos ainda concorrem.
 * `anonymous`: palavra de "Participante XXXX" no idioma do painel (domain.anonymousParticipant).
 */
export async function getRaffleState(
  client: Client,
  sessionId: string,
  eligibility: string | null,
  anonymous?: string,
): Promise<RaffleState> {
  const mode = isRaffleEligibility(eligibility) ? eligibility : null;
  const [prizes, winners, participantsCount] = await Promise.all([
    loadPrizes(client, sessionId),
    loadWinners(client, sessionId),
    client.from("participants").select("id", { count: "exact", head: true }).eq("session_id", sessionId),
  ]);
  const won = new Set(winners.map((w) => w.participant_id));
  const entrants = mode ? (await eligibleIds(client, sessionId, mode)).filter((id) => !won.has(id)).length : 0;

  return {
    eligibility: mode,
    participants: participantsCount.count ?? 0,
    entrants,
    prizes: prizes.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      kind: toPrizeKind(p.kind),
      quantity: p.quantity,
      winnerMessage: p.winner_message,
      winners: winners
        .filter((w) => w.prize_id === p.id)
        .map((w) => ({
          ...winnerView(w, anonymous),
          prizeId: w.prize_id,
          drawnAt: w.drawn_at,
          forfeitedAt: w.forfeited_at,
          deliveredAt: w.delivered_at,
        })),
    })),
  };
}

/**
 * Sorteio no telão. Só existe enquanto o palestrante o mostra; o ganhador mais recente só sai
 * depois do suspense (o telão anima a roleta enquanto isso). Mensagens dos prêmios nunca saem daqui.
 * `anonymous`: palavra de "Participante XXXX" no idioma da sessão (domain.anonymousParticipant).
 */
export async function getPublicRaffle(
  admin: AdminSupabase,
  sessionId: string,
  anonymous?: string,
): Promise<RaffleDisplay | null> {
  const [session, live] = await Promise.all([
    admin.from("sessions").select("status, raffle_eligibility, ended_at").eq("id", sessionId).maybeSingle(),
    admin.from("session_live_state").select("*").eq("session_id", sessionId).maybeSingle(),
  ]);
  if (session.error) throw new Error(session.error.message);
  if (live.error) throw new Error(live.error.message);
  const mode = session.data?.raffle_eligibility;
  if (!session.data || !live.data?.show_raffle || !isRaffleEligibility(mode)) return null;

  const now = Date.now();
  // O sorteio costuma ser no fim: o telão segue funcionando por um dia, depois para de expor nomes.
  if (!raffleOnPublicScreen(session.data.ended_at, now)) return null;
  const state = live.data;
  const pending =
    state.raffle_drawn_at && !winnerVisibleToDisplay(state.raffle_drawn_at, now) ? state.raffle_winner_id : null;

  const [prizes, winners, entries, eligible] = await Promise.all([
    loadPrizes(admin, sessionId),
    loadWinners(admin, sessionId),
    fetchAllRows<{ participant_id: string; number: number }>((from, to) =>
      admin.from("raffle_entries").select("participant_id, number").eq("session_id", sessionId).range(from, to),
    ),
    eligibleIds(admin, sessionId, mode),
  ]);
  const won = new Set(winners.map((w) => w.participant_id));
  const eligibleSet = new Set(eligible);
  const active = winners.filter((w) => !w.forfeited_at && w.id !== pending);

  const showsDraw =
    state.raffle_drawn_at && state.raffle_prize_id && state.raffle_at
      ? Date.parse(state.raffle_drawn_at) >= Date.parse(state.raffle_at)
      : false;
  const latestRow = winners.find((w) => w.id === state.raffle_winner_id);

  return {
    eligibility: mode,
    status: session.data.status,
    entrants: eligible.filter((id) => !won.has(id)).length,
    numbers: entries
      .filter((e) => eligibleSet.has(e.participant_id) && (!won.has(e.participant_id) || e.participant_id === latestRow?.participant_id))
      .map((e) => e.number)
      .slice(0, 600),
    prizes: prizes.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      kind: toPrizeKind(p.kind),
      quantity: p.quantity,
      winners: active.filter((w) => w.prize_id === p.id).map((w) => winnerView(w, anonymous)),
    })),
    latest:
      showsDraw && state.raffle_drawn_at && state.raffle_prize_id
        ? {
            prizeId: state.raffle_prize_id,
            drawnAt: state.raffle_drawn_at,
            winner: latestRow && !pending ? winnerView(latestRow, anonymous) : null,
          }
        : null,
    serverNow: now,
  };
}

/**
 * Celular do participante: número (criado na primeira vez em que pode concorrer), prêmios e,
 * depois da revelação no telão, o que ganhou com a mensagem do prêmio.
 */
export async function getParticipantRaffle(
  admin: AdminSupabase,
  sessionId: string,
  participantId: string,
): Promise<RaffleTicket> {
  const { data: session, error } = await admin.from("sessions").select("raffle_eligibility").eq("id", sessionId).maybeSingle();
  if (error) throw new Error(error.message);
  const mode = session?.raffle_eligibility;
  if (!isRaffleEligibility(mode)) return { enabled: false };

  const [prizes, respondent, live, win] = await Promise.all([
    loadPrizes(admin, sessionId),
    mode === "survey"
      ? admin
          .from("survey_responses")
          .select("id", { count: "exact", head: true })
          .eq("session_id", sessionId)
          .eq("participant_id", participantId)
      : Promise.resolve({ count: 1, error: null }),
    admin.from("session_live_state").select("raffle_drawn_at").eq("session_id", sessionId).maybeSingle(),
    admin
      .from("raffle_winners")
      .select("drawn_at, raffle_prizes(name, kind, winner_message)")
      .eq("participant_id", participantId)
      .is("forfeited_at", null)
      .maybeSingle(),
  ]);
  if (respondent.error) throw new Error(respondent.error.message);

  let ticket: number | null = null;
  if ((respondent.count ?? 0) > 0) {
    const { data, error: ticketError } = await admin.rpc("raffle_ticket", { p_participant_id: participantId });
    if (ticketError) throw new Error(ticketError.message);
    ticket = data;
  }

  const now = Date.now();
  const drawnAt = live.data?.raffle_drawn_at ?? null;
  const prize = win.data?.raffle_prizes;
  return {
    enabled: true,
    eligibility: mode,
    prizes: prizes.map((p) => ({ name: p.name, quantity: p.quantity })),
    ticket,
    won:
      win.data && prize && winnerRevealed(win.data.drawn_at, now)
        ? { prize: prize.name, kind: toPrizeKind(prize.kind), message: prize.winner_message }
        : null,
    // Sorteio em suspense (de qualquer pessoa): o celular confere de novo quando o telão revelar.
    recheckInMs: drawnAt && !winnerRevealed(drawnAt, now) ? Date.parse(drawnAt) + RAFFLE_REVEAL_MS - now + 300 : null,
  };
}
