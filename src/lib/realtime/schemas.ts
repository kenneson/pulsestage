import { z } from "zod";

// Payloads do realtime chegam sem tipo: validamos antes de usar.

export const liveStateSchema = z.object({
  session_id: z.string(),
  status: z.string(),
  active_interaction_id: z.string().nullable(),
  active_interaction_activated_at: z.string().nullable(),
  participant_count: z.number(),
  // Slide no telão (deck); ausente em payloads antigos.
  current_slide: z.number().nullable().default(null),
  current_slide_changed_at: z.string().nullable().default(null),
  // Ranking do quiz no telão.
  show_leaderboard: z.boolean().default(false),
  leaderboard_at: z.string().nullable().default(null),
  // Sorteio no telão: prêmio da vez e o último ganhador (os dados vêm do servidor).
  show_raffle: z.boolean().default(false),
  raffle_at: z.string().nullable().default(null),
  raffle_prize_id: z.string().nullable().default(null),
  raffle_winner_id: z.string().nullable().default(null),
  raffle_drawn_at: z.string().nullable().default(null),
  // Perguntas da plateia no telão (lista ou uma em destaque).
  show_questions: z.boolean().default(false),
  questions_at: z.string().nullable().default(null),
  question_id: z.string().nullable().default(null),
  // Revelar resultados/resposta no telão (zeram ao abrir outra pergunta).
  results_revealed: z.boolean().default(false),
  answer_revealed: z.boolean().default(false),
  // Ranking do telão por pessoas ou por equipes.
  leaderboard_mode: z.enum(["people", "teams"]).catch("people").default("people"),
  // Filtro "comparar grupos": alternativa de uma enquete de perfil (null = todos).
  segment_option_id: z.string().nullable().default(null),
  updated_at: z.string(),
});

export type LiveState = z.infer<typeof liveStateSchema>;

export const resultRowSchema = z.object({
  interaction_id: z.string(),
  session_id: z.string(),
  type: z.string(),
  total: z.number(),
  counts: z.unknown(),
  recent: z.unknown(),
  updated_at: z.string(),
});
