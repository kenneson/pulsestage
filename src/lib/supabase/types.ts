import type { Database } from "./database.types";

type Tables = Database["public"]["Tables"];

export type ProfileRow = Tables["profiles"]["Row"];
export type SessionRow = Tables["sessions"]["Row"];
export type InteractionRow = Tables["interactions"]["Row"];
export type InteractionOptionRow = Tables["interaction_options"]["Row"];
export type ParticipantRow = Tables["participants"]["Row"];
export type ResponseRow = Tables["responses"]["Row"];
export type FeedbackRow = Tables["feedback"]["Row"];
export type InsightRow = Tables["insights"]["Row"];
export type SessionLiveStateRow = Tables["session_live_state"]["Row"];
export type InteractionResultRow = Tables["interaction_results"]["Row"];
