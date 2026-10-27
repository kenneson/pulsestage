import "server-only";
import type { AdminSupabase } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { getLiveState, getPublicInteraction } from "@/lib/data/public";
import { SCORED_TYPES, isInteractionType, normalizeSettings } from "@/lib/domain/interactions";
import { answerRevealAllowed, revealedAnswerOf, type RevealedAnswer } from "@/lib/domain/answer-reveal";
import { segmentApplies, segmentMembers, segmentSnapshot, type SegmentResponse } from "@/lib/domain/segment-results";
import type { ResultsSnapshot } from "@/lib/domain/results";
import { teamLeaderboard, type TeamLeaderboardEntry } from "@/lib/domain/team-leaderboard";

// Leituras do telão feitas com a secret key (revelar resposta, comparar grupos, ranking por equipes).
// Cada uma só responde enquanto o palestrante liga o recurso na sala ao vivo; fora disso, null (404).

/** Resposta certa da pergunta no ar, só com "Revelar resposta" ligado. */
export async function getRevealedAnswer(
  admin: AdminSupabase,
  sessionId: string,
  interactionId: string,
): Promise<RevealedAnswer | null> {
  const state = await getLiveState(admin, sessionId);
  if (!answerRevealAllowed(state, interactionId)) return null;

  const [{ data: interaction, error }, { data: options, error: optionsError }] = await Promise.all([
    admin.from("interactions").select("type, answer_key, session_id").eq("id", interactionId).maybeSingle(),
    admin.from("interaction_options").select("id, is_correct").eq("interaction_id", interactionId),
  ]);
  if (error) throw new Error(error.message);
  if (optionsError) throw new Error(optionsError.message);
  if (!interaction || interaction.session_id !== sessionId || !isInteractionType(interaction.type)) return null;
  return revealedAnswerOf({ type: interaction.type, options, answerKey: interaction.answer_key });
}

export type SegmentResults = { snapshot: ResultsSnapshot; group: string };

/**
 * Resultados da pergunta no ar só de quem escolheu a alternativa do filtro "comparar grupos".
 * Respeita "esconder resultados" (nada antes de revelar) e "mostrar no telão" da pergunta aberta.
 */
export async function getSegmentResults(
  admin: AdminSupabase,
  sessionId: string,
  interactionId: string,
): Promise<SegmentResults | null> {
  const state = await getLiveState(admin, sessionId);
  const optionId = state?.segment_option_id ?? null;
  if (!state || !optionId || (state.status !== "live" && state.status !== "paused")) return null;
  if (state.active_interaction_id !== interactionId) return null;

  const [{ data: option, error }, interaction] = await Promise.all([
    admin.from("interaction_options").select("id, label, interaction_id").eq("id", optionId).maybeSingle(),
    getPublicInteraction(admin, interactionId),
  ]);
  if (error) throw new Error(error.message);
  if (!option || !interaction) return null;
  if (!segmentApplies({ segmentOptionId: optionId, segmentInteractionId: option.interaction_id, interactionId })) return null;
  if (interaction.settings.hideResults && !state.results_revealed) return null;

  const { data: segment, error: segmentError } = await admin
    .from("interactions")
    .select("session_id, type, settings")
    .eq("id", option.interaction_id)
    .maybeSingle();
  if (segmentError) throw new Error(segmentError.message);
  if (
    !segment ||
    segment.session_id !== sessionId ||
    segment.type !== "multiple_choice" ||
    !normalizeSettings("multiple_choice", segment.settings).isSegment
  ) {
    return null;
  }

  const [profile, responses] = await Promise.all([
    fetchAllRows<{ participant_id: string; value: unknown }>((from, to) =>
      admin.from("responses").select("participant_id, value").eq("interaction_id", option.interaction_id).range(from, to),
    ),
    fetchAllRows<SegmentResponse>((from, to) =>
      admin
        .from("responses")
        .select("id, participant_id, aggregate_key, value, created_at, moderation")
        .eq("interaction_id", interactionId)
        .range(from, to),
    ),
  ]);
  const snapshot = segmentSnapshot(responses, segmentMembers(profile, optionId));
  // Respostas abertas fora do telão continuam fora com o filtro.
  const hideTexts = interaction.type === "open_text" && !interaction.settings.showOnDisplay;
  return {
    snapshot: { ...snapshot, recent: hideTexts ? [] : snapshot.recent.slice(0, 50) },
    group: option.label,
  };
}

/**
 * Ranking do quiz por equipes, enquanto o ranking está no telão (mesma janela do ranking de pessoas).
 * Sai só nome e cor da equipe, quantas pessoas, média e total de pontos.
 */
export async function getTeamLeaderboard(admin: AdminSupabase, sessionId: string): Promise<TeamLeaderboardEntry[] | null> {
  const state = await getLiveState(admin, sessionId);
  if (!state || (state.status !== "live" && state.status !== "paused") || !state.show_leaderboard) return null;

  const [{ data: teams, error }, { data: quizzes, error: quizError }] = await Promise.all([
    admin.from("session_teams").select("id, name, color, position").eq("session_id", sessionId).order("position"),
    admin.from("interactions").select("id, activated_at").eq("session_id", sessionId).in("type", [...SCORED_TYPES]),
  ]);
  if (error) throw new Error(error.message);
  if (quizError) throw new Error(quizError.message);
  if (teams.length === 0) return [];

  const quizIds = quizzes.map((q) => q.id);
  const [responses, members] = await Promise.all([
    quizIds.length
      ? fetchAllRows<{ participant_id: string; interaction_id: string; value: unknown }>((from, to) =>
          admin.from("responses").select("participant_id, interaction_id, value").in("interaction_id", quizIds).range(from, to),
        )
      : Promise.resolve([]),
    fetchAllRows<{ id: string; team_id: string | null }>((from, to) =>
      admin.from("participants").select("id, team_id").eq("session_id", sessionId).range(from, to),
    ),
  ]);

  // "Antes do último quiz": o que pontua, respondido, aberto por último.
  const answered = new Set(responses.map((r) => r.interaction_id));
  const latest = quizzes
    .filter((q) => answered.has(q.id) && q.activated_at)
    .sort((a, b) => (b.activated_at ?? "").localeCompare(a.activated_at ?? ""))[0];

  return teamLeaderboard(
    responses.map((r) => ({ participantId: r.participant_id, interactionId: r.interaction_id, value: r.value })),
    members,
    teams,
    latest?.id ?? null,
  );
}

/** Ritmo da sessão: em ritmo próprio, o telão fica no QR Code de entrada. */
export async function getSessionPace(admin: AdminSupabase, sessionId: string): Promise<"live" | "self"> {
  const { data, error } = await admin.from("sessions").select("pace").eq("id", sessionId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.pace === "self" ? "self" : "live";
}
