// Ranking do quiz para o telão. Regra pura (sem I/O).
// Soma pontos e acertos por participante e compara com a posição de antes do último quiz,
// para o telão animar quem subiu. Pontos e acerto já vêm calculados pelo servidor (seção 0.3).

import { participantLabel, parseQuizValue } from "./metrics.ts";
import { avatarOf } from "./gamification.ts";

export type LeaderboardResponse = { participantId: string; interactionId: string; value: unknown };
export type LeaderboardParticipant = { id: string; display_name: string | null; avatar?: string | null };

export type LeaderboardEntry = {
  /** chave estável para a animação (não é o id do participante) */
  key: string;
  name: string;
  /** emoji do avatar escolhido ao entrar; null = sem avatar */
  avatar: string | null;
  rank: number;
  points: number;
  correct: number;
  /** posição antes do último quiz; null = entrou no ranking agora */
  previousRank: number | null;
  previousPoints: number;
};

type Totals = Map<string, { points: number; correct: number }>;

function totalsOf(responses: readonly LeaderboardResponse[], skipInteraction: string | null): Totals {
  const totals: Totals = new Map();
  for (const r of responses) {
    if (r.interactionId === skipInteraction) continue;
    const value = parseQuizValue(r.value);
    if (!value) continue;
    const entry = totals.get(r.participantId) ?? { points: 0, correct: 0 };
    entry.points += value.points;
    entry.correct += value.isCorrect ? 1 : 0;
    totals.set(r.participantId, entry);
  }
  return totals;
}

/** Ordem do ranking: pontos, depois acertos, depois quem entrou antes no ranking (id, para ser estável). */
function ranked(totals: Totals): string[] {
  return [...totals.entries()]
    .sort(([idA, a], [idB, b]) => b.points - a.points || b.correct - a.correct || idA.localeCompare(idB))
    .map(([id]) => id);
}

export function leaderboard(
  responses: readonly LeaderboardResponse[],
  participants: readonly LeaderboardParticipant[],
  latestQuizId: string | null,
  limit = 10,
): LeaderboardEntry[] {
  const now = totalsOf(responses, null);
  const before = totalsOf(responses, latestQuizId);
  const beforeOrder = ranked(before);
  const byId = new Map(participants.map((p) => [p.id, p]));

  return ranked(now)
    .slice(0, limit)
    .map((id, index) => {
      const current = now.get(id)!;
      const participant = byId.get(id);
      const previousIndex = beforeOrder.indexOf(id);
      return {
        key: id.slice(0, 8),
        name: participantLabel(participant, id),
        avatar: avatarOf(participant?.avatar)?.emoji ?? null,
        rank: index + 1,
        points: current.points,
        correct: current.correct,
        previousRank: previousIndex >= 0 ? previousIndex + 1 : null,
        previousPoints: before.get(id)?.points ?? 0,
      };
    });
}
