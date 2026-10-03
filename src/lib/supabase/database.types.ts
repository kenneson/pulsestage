// Gerado a partir do banco (Supabase gen types). Não edite à mão: rode `npm run db:types`.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      feedback: {
        Row: {
          applicability_rating: number | null
          clarity_rating: number | null
          comment: string | null
          content_rating: number | null
          created_at: string
          engagement_rating: number | null
          id: string
          improvement: string | null
          most_valuable_part: string | null
          overall_rating: number
          participant_id: string | null
          session_id: string
        }
        Insert: {
          applicability_rating?: number | null
          clarity_rating?: number | null
          comment?: string | null
          content_rating?: number | null
          created_at?: string
          engagement_rating?: number | null
          id?: string
          improvement?: string | null
          most_valuable_part?: string | null
          overall_rating: number
          participant_id?: string | null
          session_id: string
        }
        Update: {
          applicability_rating?: number | null
          clarity_rating?: number | null
          comment?: string | null
          content_rating?: number | null
          created_at?: string
          engagement_rating?: number | null
          id?: string
          improvement?: string | null
          most_valuable_part?: string | null
          overall_rating?: number
          participant_id?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      insights: {
        Row: {
          confidence: string
          created_at: string
          description: string
          evidence: Json
          generation_id: string
          id: string
          model: string | null
          priority: string | null
          provider: string | null
          recommendation: string | null
          session_id: string
          title: string
          type: string
        }
        Insert: {
          confidence?: string
          created_at?: string
          description: string
          evidence?: Json
          generation_id: string
          id?: string
          model?: string | null
          priority?: string | null
          provider?: string | null
          recommendation?: string | null
          session_id: string
          title: string
          type: string
        }
        Update: {
          confidence?: string
          created_at?: string
          description?: string
          evidence?: Json
          generation_id?: string
          id?: string
          model?: string | null
          priority?: string | null
          provider?: string | null
          recommendation?: string | null
          session_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      interaction_options: {
        Row: {
          created_at: string
          id: string
          interaction_id: string
          is_correct: boolean
          label: string
          points: number
          position: number
        }
        Insert: {
          created_at?: string
          id?: string
          interaction_id: string
          is_correct?: boolean
          label: string
          points?: number
          position: number
        }
        Update: {
          created_at?: string
          id?: string
          interaction_id?: string
          is_correct?: boolean
          label?: string
          points?: number
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "interaction_options_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
        ]
      }
      interaction_results: {
        Row: {
          counts: Json
          interaction_id: string
          recent: Json
          session_id: string
          total: number
          type: string
          updated_at: string
        }
        Insert: {
          counts?: Json
          interaction_id: string
          recent?: Json
          session_id: string
          total?: number
          type: string
          updated_at?: string
        }
        Update: {
          counts?: Json
          interaction_id?: string
          recent?: Json
          session_id?: string
          total?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interaction_results_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: true
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          activated_at: string | null
          closed_at: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          position: number
          session_id: string
          settings: Json
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          position: number
          session_id: string
          settings?: Json
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          position?: number
          session_id?: string
          settings?: Json
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_contacts: {
        Row: {
          consent_given_at: string
          consent_purpose: string
          created_at: string
          email: string | null
          participant_id: string
          phone: string | null
        }
        Insert: {
          consent_given_at: string
          consent_purpose: string
          created_at?: string
          email?: string | null
          participant_id: string
          phone?: string | null
        }
        Update: {
          consent_given_at?: string
          consent_purpose?: string
          created_at?: string
          email?: string | null
          participant_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participant_contacts_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          anonymous: boolean
          created_at: string
          display_name: string | null
          id: string
          session_id: string
        }
        Insert: {
          anonymous?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          session_id: string
        }
        Update: {
          anonymous?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      responses: {
        Row: {
          aggregate_key: string | null
          created_at: string
          id: string
          interaction_id: string
          metadata: Json
          participant_id: string
          session_id: string
          value: Json
        }
        Insert: {
          aggregate_key?: string | null
          created_at?: string
          id?: string
          interaction_id: string
          metadata?: Json
          participant_id: string
          session_id: string
          value: Json
        }
        Update: {
          aggregate_key?: string | null
          created_at?: string
          id?: string
          interaction_id?: string
          metadata?: Json
          participant_id?: string
          session_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "responses_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_live_state: {
        Row: {
          active_interaction_activated_at: string | null
          active_interaction_id: string | null
          participant_count: number
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          active_interaction_activated_at?: string | null
          active_interaction_id?: string | null
          participant_count?: number
          session_id: string
          status: string
          updated_at?: string
        }
        Update: {
          active_interaction_activated_at?: string | null
          active_interaction_id?: string | null
          participant_count?: number
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_live_state_active_interaction_id_fkey"
            columns: ["active_interaction_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_live_state_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_survey_questions: {
        Row: {
          dimension: string | null
          id: string
          kind: string
          label: string
          position: number
          required: boolean
          session_id: string
          settings: Json
        }
        Insert: {
          dimension?: string | null
          id?: string
          kind: string
          label: string
          position: number
          required?: boolean
          session_id: string
          settings?: Json
        }
        Update: {
          dimension?: string | null
          id?: string
          kind?: string
          label?: string
          position?: number
          required?: boolean
          session_id?: string
          settings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "session_survey_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_surveys"
            referencedColumns: ["session_id"]
          },
        ]
      }
      session_surveys: {
        Row: {
          created_at: string
          name: string
          session_id: string
          template_id: string | null
        }
        Insert: {
          created_at?: string
          name: string
          session_id: string
          template_id?: string | null
        }
        Update: {
          created_at?: string
          name?: string
          session_id?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_surveys_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_surveys_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          description: string | null
          ended_at: string | null
          estimated_duration_minutes: number | null
          id: string
          join_code: string
          scheduled_at: string | null
          speaker_id: string
          started_at: string | null
          status: string
          survey_template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ended_at?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          join_code?: string
          scheduled_at?: string | null
          speaker_id: string
          started_at?: string | null
          status?: string
          survey_template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ended_at?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          join_code?: string
          scheduled_at?: string | null
          speaker_id?: string
          started_at?: string | null
          status?: string
          survey_template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_survey_template_id_fkey"
            columns: ["survey_template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_answers: {
        Row: {
          question_id: string
          response_id: string
          value_int: number | null
          value_text: string | null
        }
        Insert: {
          question_id: string
          response_id: string
          value_int?: number | null
          value_text?: string | null
        }
        Update: {
          question_id?: string
          response_id?: string
          value_int?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "session_survey_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "survey_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          created_at: string
          id: string
          participant_id: string | null
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          participant_id?: string | null
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          participant_id?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_template_questions: {
        Row: {
          dimension: string | null
          id: string
          kind: string
          label: string
          position: number
          required: boolean
          settings: Json
          template_id: string
        }
        Insert: {
          dimension?: string | null
          id?: string
          kind: string
          label: string
          position: number
          required?: boolean
          settings?: Json
          template_id: string
        }
        Update: {
          dimension?: string | null
          id?: string
          kind?: string
          label?: string
          position?: number
          required?: boolean
          settings?: Json
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_template_questions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_templates_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      convert_legacy_feedback: { Args: never; Returns: undefined }
      generate_join_code: { Args: { len?: number }; Returns: string }
      is_session_owner: { Args: { p_session_id: string }; Returns: boolean }
      reorder_interactions: {
        Args: { p_ids: string[]; p_session_id: string }
        Returns: undefined
      }
      set_active_interaction: {
        Args: { p_interaction_id?: string; p_session_id: string }
        Returns: undefined
      }
      take_survey_snapshot: {
        Args: { p_session_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
