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
      audience_question_votes: {
        Row: {
          created_at: string
          participant_id: string
          question_id: string
        }
        Insert: {
          created_at?: string
          participant_id: string
          question_id: string
        }
        Update: {
          created_at?: string
          participant_id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audience_question_votes_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audience_question_votes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "audience_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      audience_questions: {
        Row: {
          answered_at: string | null
          author_name: string | null
          body: string
          created_at: string
          filtered: boolean
          id: string
          participant_id: string | null
          session_id: string
          status: string
          upvotes: number
        }
        Insert: {
          answered_at?: string | null
          author_name?: string | null
          body: string
          created_at?: string
          filtered?: boolean
          id?: string
          participant_id?: string | null
          session_id: string
          status?: string
          upvotes?: number
        }
        Update: {
          answered_at?: string | null
          author_name?: string | null
          body?: string
          created_at?: string
          filtered?: boolean
          id?: string
          participant_id?: string | null
          session_id?: string
          status?: string
          upvotes?: number
        }
        Relationships: [
          {
            foreignKeyName: "audience_questions_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audience_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_requests: {
        Row: {
          archived_at: string | null
          created_at: string
          email: string
          event_city: string | null
          event_date: string | null
          id: string
          ip_hash: string | null
          message: string
          name: string
          org_kind: string | null
          organization: string | null
          read_at: string | null
          speaker_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          email: string
          event_city?: string | null
          event_date?: string | null
          id?: string
          ip_hash?: string | null
          message: string
          name: string
          org_kind?: string | null
          organization?: string | null
          read_at?: string | null
          speaker_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          email?: string
          event_city?: string | null
          event_date?: string | null
          id?: string
          ip_hash?: string | null
          message?: string
          name?: string
          org_kind?: string | null
          organization?: string | null
          read_at?: string | null
          speaker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_requests_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
          image_path: string | null
          interaction_id: string
          is_correct: boolean
          label: string
          points: number
          position: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_path?: string | null
          interaction_id: string
          is_correct?: boolean
          label: string
          points?: number
          position: number
        }
        Update: {
          created_at?: string
          id?: string
          image_path?: string | null
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
          after_slide: number | null
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
          after_slide?: number | null
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
          after_slide?: number | null
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
          avatar: string | null
          created_at: string
          display_name: string | null
          id: string
          session_id: string
        }
        Insert: {
          anonymous?: boolean
          avatar?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          session_id: string
        }
        Update: {
          anonymous?: boolean
          avatar?: string | null
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
          audiences: string[]
          avatar_url: string | null
          bio: string | null
          city: string | null
          contact_enabled: boolean
          created_at: string
          default_duration_minutes: number | null
          default_survey_template_id: string | null
          experience: string | null
          formats: string[]
          headline: string | null
          id: string
          linkedin_url: string | null
          locale: string
          name: string | null
          promote_on_survey: boolean
          public_enabled: boolean
          public_slug: string | null
          show_ratings: boolean
          state: string | null
          time_zone: string
          topics: string[]
          updated_at: string
          website_url: string | null
        }
        Insert: {
          audiences?: string[]
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          contact_enabled?: boolean
          created_at?: string
          default_duration_minutes?: number | null
          default_survey_template_id?: string | null
          experience?: string | null
          formats?: string[]
          headline?: string | null
          id: string
          linkedin_url?: string | null
          locale?: string
          name?: string | null
          promote_on_survey?: boolean
          public_enabled?: boolean
          public_slug?: string | null
          show_ratings?: boolean
          state?: string | null
          time_zone?: string
          topics?: string[]
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          audiences?: string[]
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          contact_enabled?: boolean
          created_at?: string
          default_duration_minutes?: number | null
          default_survey_template_id?: string | null
          experience?: string | null
          formats?: string[]
          headline?: string | null
          id?: string
          linkedin_url?: string | null
          locale?: string
          name?: string | null
          promote_on_survey?: boolean
          public_enabled?: boolean
          public_slug?: string | null
          show_ratings?: boolean
          state?: string | null
          time_zone?: string
          topics?: string[]
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_survey_template_id_fkey"
            columns: ["default_survey_template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      raffle_entries: {
        Row: {
          created_at: string
          number: number
          participant_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          number: number
          participant_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          number?: number
          participant_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raffle_entries_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raffle_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      raffle_prizes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kind: string
          name: string
          position: number
          quantity: number
          session_id: string
          winner_message: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          name: string
          position?: number
          quantity?: number
          session_id: string
          winner_message?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          name?: string
          position?: number
          quantity?: number
          session_id?: string
          winner_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "raffle_prizes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      raffle_winners: {
        Row: {
          delivered_at: string | null
          drawn_at: string
          forfeited_at: string | null
          id: string
          number: number
          participant_id: string
          prize_id: string
          session_id: string
        }
        Insert: {
          delivered_at?: string | null
          drawn_at?: string
          forfeited_at?: string | null
          id?: string
          number: number
          participant_id: string
          prize_id: string
          session_id: string
        }
        Update: {
          delivered_at?: string | null
          drawn_at?: string
          forfeited_at?: string | null
          id?: string
          number?: number
          participant_id?: string
          prize_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raffle_winners_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raffle_winners_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "raffle_prizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raffle_winners_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          created_at: string
          id: number
          kind: string
          participant_id: string | null
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          kind: string
          participant_id?: string | null
          session_id: string
        }
        Update: {
          created_at?: string
          id?: number
          kind?: string
          participant_id?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      responses: {
        Row: {
          aggregate_key: string | null
          created_at: string
          id: string
          interaction_id: string
          metadata: Json
          moderation: string
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
          moderation?: string
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
          moderation?: string
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
      session_events: {
        Row: {
          at: string
          id: number
          interaction_id: string | null
          kind: string
          session_id: string
          slide: number | null
          status: string | null
        }
        Insert: {
          at?: string
          id?: never
          interaction_id?: string | null
          kind: string
          session_id: string
          slide?: number | null
          status?: string | null
        }
        Update: {
          at?: string
          id?: never
          interaction_id?: string | null
          kind?: string
          session_id?: string
          slide?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_events_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_events_session_id_fkey"
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
          current_slide: number | null
          current_slide_changed_at: string | null
          leaderboard_at: string | null
          participant_count: number
          question_id: string | null
          questions_at: string | null
          raffle_at: string | null
          raffle_drawn_at: string | null
          raffle_prize_id: string | null
          raffle_winner_id: string | null
          session_id: string
          show_leaderboard: boolean
          show_questions: boolean
          show_raffle: boolean
          status: string
          updated_at: string
        }
        Insert: {
          active_interaction_activated_at?: string | null
          active_interaction_id?: string | null
          current_slide?: number | null
          current_slide_changed_at?: string | null
          leaderboard_at?: string | null
          participant_count?: number
          question_id?: string | null
          questions_at?: string | null
          raffle_at?: string | null
          raffle_drawn_at?: string | null
          raffle_prize_id?: string | null
          raffle_winner_id?: string | null
          session_id: string
          show_leaderboard?: boolean
          show_questions?: boolean
          show_raffle?: boolean
          status: string
          updated_at?: string
        }
        Update: {
          active_interaction_activated_at?: string | null
          active_interaction_id?: string | null
          current_slide?: number | null
          current_slide_changed_at?: string | null
          leaderboard_at?: string | null
          participant_count?: number
          question_id?: string | null
          questions_at?: string | null
          raffle_at?: string | null
          raffle_drawn_at?: string | null
          raffle_prize_id?: string | null
          raffle_winner_id?: string | null
          session_id?: string
          show_leaderboard?: boolean
          show_questions?: boolean
          show_raffle?: boolean
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
          locale: string
          moderate_open_text: boolean
          paused_at: string | null
          paused_seconds: number
          profanity_filter: boolean
          public_listed: boolean
          qa_enabled: boolean
          qa_moderated: boolean
          raffle_eligibility: string | null
          reactions_enabled: boolean
          scheduled_at: string | null
          slide_count: number
          slides_batch: string | null
          slides_format: string | null
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
          locale?: string
          moderate_open_text?: boolean
          paused_at?: string | null
          paused_seconds?: number
          profanity_filter?: boolean
          public_listed?: boolean
          qa_enabled?: boolean
          qa_moderated?: boolean
          raffle_eligibility?: string | null
          reactions_enabled?: boolean
          scheduled_at?: string | null
          slide_count?: number
          slides_batch?: string | null
          slides_format?: string | null
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
          locale?: string
          moderate_open_text?: boolean
          paused_at?: string | null
          paused_seconds?: number
          profanity_filter?: boolean
          public_listed?: boolean
          qa_enabled?: boolean
          qa_moderated?: boolean
          raffle_eligibility?: string | null
          reactions_enabled?: boolean
          scheduled_at?: string | null
          slide_count?: number
          slides_batch?: string | null
          slides_format?: string | null
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
          locale: string
          name: string
          owner_id: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          locale?: string
          name: string
          owner_id?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          locale?: string
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
      arrange_interactions: {
        Args: { p_after_slides: number[]; p_ids: string[]; p_session_id: string }
        Returns: undefined
      }
      convert_legacy_feedback: { Args: never; Returns: undefined }
      draw_raffle: {
        Args: { p_prize_id: string; p_session_id: string }
        Returns: string
      }
      forfeit_raffle_winner: { Args: { p_winner_id: string }; Returns: undefined }
      generate_join_code: { Args: { len?: number }; Returns: string }
      is_session_owner: { Args: { p_session_id: string }; Returns: boolean }
      moderate_question: {
        Args: { p_question_id: string; p_status: string }
        Returns: undefined
      }
      moderate_response: {
        Args: { p_response_id: string; p_visible: boolean }
        Returns: undefined
      }
      raffle_is_eligible: {
        Args: { p_mode: string; p_participant_id: string; p_session_id: string }
        Returns: boolean
      }
      raffle_ticket: { Args: { p_participant_id: string }; Returns: number }
      reorder_interactions: {
        Args: { p_ids: string[]; p_session_id: string }
        Returns: undefined
      }
      set_active_interaction: {
        Args: { p_interaction_id?: string; p_session_id: string }
        Returns: undefined
      }
      set_term_visibility: {
        Args: { p_interaction_id: string; p_term: string; p_visible: boolean }
        Returns: undefined
      }
      show_leaderboard: {
        Args: { p_session_id: string; p_show: boolean }
        Returns: undefined
      }
      show_questions: {
        Args: { p_question_id?: string; p_session_id: string; p_show: boolean }
        Returns: undefined
      }
      show_raffle: {
        Args: { p_session_id: string; p_show: boolean }
        Returns: undefined
      }
      show_slide: {
        Args: { p_session_id: string; p_slide?: number }
        Returns: undefined
      }
      speaker_session_facts: {
        Args: { p_speaker_ids: string[] }
        Returns: {
          ended_at: string
          participants: number
          public_listed: boolean
          rating_count: number
          rating_sum: number
          responders: number
          session_id: string
          speaker_id: string
          started_at: string
          survey_responses: number
          talk_seconds: number
          title: string
        }[]
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
