// Tipos do banco escritos à mão a partir da migration inicial.
// Assim que o projeto estiver ligado ao Supabase, substitua por `npm run db:types`.
// O restante do código usa os aliases de ./types.ts, então a troca não quebra nada.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TableDef<Row, InsertRequired extends keyof Row> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, InsertRequired>;
  Update: Partial<Row>;
  Relationships: [];
};

type ProfileRow = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

type SessionRow = {
  id: string;
  speaker_id: string;
  title: string;
  description: string | null;
  status: string;
  join_code: string;
  scheduled_at: string | null;
  estimated_duration_minutes: number | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

type InteractionRow = {
  id: string;
  session_id: string;
  type: string;
  title: string;
  description: string | null;
  position: number;
  is_active: boolean;
  settings: Json;
  activated_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

type InteractionOptionRow = {
  id: string;
  interaction_id: string;
  label: string;
  position: number;
  is_correct: boolean;
  points: number;
  created_at: string;
};

type ParticipantRow = {
  id: string;
  session_id: string;
  display_name: string | null;
  anonymous: boolean;
  created_at: string;
};

type ParticipantContactRow = {
  participant_id: string;
  email: string | null;
  phone: string | null;
  consent_given_at: string;
  consent_purpose: string;
  created_at: string;
};

type ResponseRow = {
  id: string;
  interaction_id: string;
  session_id: string;
  participant_id: string;
  value: Json;
  aggregate_key: string | null;
  metadata: Json;
  created_at: string;
};

type FeedbackRow = {
  id: string;
  session_id: string;
  participant_id: string | null;
  overall_rating: number;
  clarity_rating: number | null;
  engagement_rating: number | null;
  content_rating: number | null;
  applicability_rating: number | null;
  most_valuable_part: string | null;
  improvement: string | null;
  comment: string | null;
  created_at: string;
};

type InsightRow = {
  id: string;
  session_id: string;
  generation_id: string;
  type: string;
  title: string;
  description: string;
  evidence: Json;
  recommendation: string | null;
  priority: string | null;
  confidence: string;
  provider: string | null;
  model: string | null;
  created_at: string;
};

type SessionLiveStateRow = {
  session_id: string;
  status: string;
  active_interaction_id: string | null;
  active_interaction_activated_at: string | null;
  participant_count: number;
  updated_at: string;
};

type InteractionResultRow = {
  interaction_id: string;
  session_id: string;
  type: string;
  total: number;
  counts: Json;
  recent: Json;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow, "id">;
      sessions: TableDef<SessionRow, "speaker_id" | "title">;
      interactions: TableDef<InteractionRow, "session_id" | "type" | "title" | "position">;
      interaction_options: TableDef<InteractionOptionRow, "interaction_id" | "label" | "position">;
      participants: TableDef<ParticipantRow, "session_id">;
      participant_contacts: TableDef<
        ParticipantContactRow,
        "participant_id" | "consent_given_at" | "consent_purpose"
      >;
      responses: TableDef<ResponseRow, "interaction_id" | "session_id" | "participant_id" | "value">;
      feedback: TableDef<FeedbackRow, "session_id" | "overall_rating">;
      insights: TableDef<InsightRow, "session_id" | "generation_id" | "type" | "title" | "description">;
      session_live_state: TableDef<SessionLiveStateRow, "session_id" | "status">;
      interaction_results: TableDef<InteractionResultRow, "interaction_id" | "session_id" | "type">;
    };
    Views: { [_ in never]: never };
    Functions: {
      set_active_interaction: {
        Args: { p_session_id: string; p_interaction_id?: string };
        Returns: undefined;
      };
      reorder_interactions: {
        Args: { p_session_id: string; p_ids: string[] };
        Returns: undefined;
      };
      generate_join_code: {
        Args: { len?: number };
        Returns: string;
      };
      is_session_owner: {
        Args: { p_session_id: string };
        Returns: boolean;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
