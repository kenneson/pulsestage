// Ranking do quiz por equipes, para o telão. Regra pura (sem I/O).
// Cada equipe vale a média de pontos por pessoa (quem está na equipe, respondendo ou não), para que uma
// equipe grande não ganhe só por ser grande; o total desempata. Pontos já vêm do servidor (seção 0.3).

import { rankQuiz, type LeaderboardResponse } from "./leaderboard.ts";

export type TeamInfo = { id: string; name: string; color: number; position: number };
export type TeamMember = { id: string; team_id: string | null };

export type TeamLeaderboardEntry = {
  /** chave estável para a animação (id inteiro da equipe: começos iguais não colidem) */
  key: string;
  name: string;
  /** cor da equipe (1–8, a mesma paleta das formas) */
  color: number;
  /** pessoas na equipe */
  people: number;
  /** média de pontos por pessoa */
  average: number;
  total: number;
  rank: number;
  /** posição antes do último quiz; null = ninguém tinha pontos antes (primeiro quiz) */
  previousRank: number | null;
  previousAverage: number;
};

type TeamScore = { team: TeamInfo; people: number; total: number; average: number };

function scores(
  responses: readonly LeaderboardResponse[],
  members: readonly TeamMember[],
  teams: readonly TeamInfo[],
): TeamScore[] {
  const { totals } = rankQuiz(responses);
  const byTeam = new Map(teams.map((team) => [team.id, { team, people: 0, total: 0, average: 0 }]));
  for (const member of members) {
    const score = member.team_id ? byTeam.get(member.team_id) : undefined;
    if (!score) continue;
    score.people += 1;
    score.total += totals.get(member.id)?.points ?? 0;
  }
  // Equipe sem ninguém não disputa.
  const list = [...byTeam.values()].filter((s) => s.people > 0);
  for (const s of list) s.average = s.total / s.people;
  return list.sort(
    (a, b) =>
      b.average - a.average || b.total - a.total || a.team.position - b.team.position || a.team.id.localeCompare(b.team.id),
  );
}

export function teamLeaderboard(
  responses: readonly LeaderboardResponse[],
  members: readonly TeamMember[],
  teams: readonly TeamInfo[],
  latestQuizId: string | null,
): TeamLeaderboardEntry[] {
  const now = scores(responses, members, teams);
  const before = scores(
    responses.filter((r) => r.interactionId !== latestQuizId),
    members,
    teams,
  );
  const hadPoints = before.some((s) => s.total > 0);
  const beforeOrder = before.map((s) => s.team.id);
  const beforeAverage = new Map(before.map((s) => [s.team.id, s.average]));

  return now.map((s, index) => {
    const previousIndex = beforeOrder.indexOf(s.team.id);
    return {
      key: s.team.id,
      name: s.team.name,
      color: s.team.color,
      people: s.people,
      average: s.average,
      total: s.total,
      rank: index + 1,
      previousRank: hadPoints && previousIndex >= 0 ? previousIndex + 1 : null,
      previousAverage: hadPoints ? (beforeAverage.get(s.team.id) ?? 0) : 0,
    };
  });
}
