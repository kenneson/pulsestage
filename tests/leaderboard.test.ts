import { test } from "node:test";
import assert from "node:assert/strict";
import { leaderboard, type LeaderboardResponse } from "../src/lib/domain/leaderboard.ts";

const answer = (participantId: string, interactionId: string, points: number): LeaderboardResponse => ({
  participantId,
  interactionId,
  value: { optionId: "o", isCorrect: points > 0, points, responseTimeMs: 1000 },
});

const participants = [
  { id: "aaaaaaaa-1", display_name: "Ana", avatar: "raposa" },
  { id: "bbbbbbbb-2", display_name: "Bruno", avatar: "chave-antiga" },
  { id: "cccccccc-3", display_name: null },
];

test("ranking atual com a posição de antes do último quiz", () => {
  const responses = [
    answer("aaaaaaaa-1", "q1", 100),
    answer("bbbbbbbb-2", "q1", 0),
    answer("aaaaaaaa-1", "q2", 0),
    answer("bbbbbbbb-2", "q2", 200),
    answer("cccccccc-3", "q2", 100),
  ];
  const board = leaderboard(responses, participants, "q2");
  assert.deepEqual(
    board.map((e) => [e.name, e.rank, e.points, e.previousRank, e.previousPoints]),
    [
      ["Bruno", 1, 200, 2, 0], // subiu
      ["Ana", 2, 100, 1, 100], // caiu; empata com C em pontos e acertos (desempate estável)
      ["Participante CCCC", 3, 100, null, 0], // entrou agora
    ],
  );
  assert.equal(board[0]?.key, "bbbbbbbb");
  // Avatar vira emoji; chave desconhecida ou ausente, sem avatar.
  assert.deepEqual(
    board.map((e) => e.avatar),
    [null, "🦊", null],
  );
});

test("respostas inválidas são ignoradas e o limite corta o ranking", () => {
  const responses = [
    answer("aaaaaaaa-1", "q1", 100),
    { participantId: "bbbbbbbb-2", interactionId: "q1", value: { qualquer: 1 } },
    answer("cccccccc-3", "q1", 50),
  ];
  const board = leaderboard(responses, participants, "q1", 1);
  assert.deepEqual(
    board.map((e) => [e.name, e.previousRank]),
    [["Ana", null]],
  );
});
