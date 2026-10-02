import { z } from "zod";

// Payloads do realtime chegam sem tipo: validamos antes de usar.

export const liveStateSchema = z.object({
  session_id: z.string(),
  status: z.string(),
  active_interaction_id: z.string().nullable(),
  active_interaction_activated_at: z.string().nullable(),
  participant_count: z.number(),
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
