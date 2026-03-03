export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_trail: {
        Row: {
          action_verb: string
          actor_id: string
          category: string
          changes: Json | null
          correlation_id: string | null
          created_at: string
          data: Json | null
          entity_id: string
          entity_label: string | null
          entity_type: string
          event: string
          id: number
          ip_address: unknown
          source: string | null
          workspace_id: string
        }
        Insert: {
          action_verb: string
          actor_id: string
          category: string
          changes?: Json | null
          correlation_id?: string | null
          created_at?: string
          data?: Json | null
          entity_id: string
          entity_label?: string | null
          entity_type: string
          event: string
          id?: number
          ip_address?: unknown
          source?: string | null
          workspace_id: string
        }
        Update: {
          action_verb?: string
          actor_id?: string
          category?: string
          changes?: Json | null
          correlation_id?: string | null
          created_at?: string
          data?: Json | null
          entity_id?: string
          entity_label?: string | null
          entity_type?: string
          event?: string
          id?: number
          ip_address?: unknown
          source?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_trail_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "activity_trail_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      agent_profile: {
        Row: {
          adapt_to_authority: boolean
          adapt_to_role: boolean
          adapt_to_situation: boolean
          assertiveness: number
          created_at: string
          default_voice: string
          display_name: string
          formality: number
          greeting: string
          humor: number
          id: string
          language: string
          updated_at: string
          updated_by: string | null
          verbosity: number
          voice_speed: number
          voice_stability: number
          voice_temperature: number
          warmth: number
          workspace_id: string
        }
        Insert: {
          adapt_to_authority?: boolean
          adapt_to_role?: boolean
          adapt_to_situation?: boolean
          assertiveness?: number
          created_at?: string
          default_voice?: string
          display_name?: string
          formality?: number
          greeting?: string
          humor?: number
          id?: string
          language?: string
          updated_at?: string
          updated_by?: string | null
          verbosity?: number
          voice_speed?: number
          voice_stability?: number
          voice_temperature?: number
          warmth?: number
          workspace_id: string
        }
        Update: {
          adapt_to_authority?: boolean
          adapt_to_role?: boolean
          adapt_to_situation?: boolean
          assertiveness?: number
          created_at?: string
          default_voice?: string
          display_name?: string
          formality?: number
          greeting?: string
          humor?: number
          id?: string
          language?: string
          updated_at?: string
          updated_by?: string | null
          verbosity?: number
          voice_speed?: number
          voice_stability?: number
          voice_temperature?: number
          warmth?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_profile_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "agent_profile_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      agent_relationship: {
        Row: {
          accuracy_score: number
          agent_profile_id: string
          created_at: string
          familiarity_score: number
          id: string
          last_interaction_at: string | null
          negative_count: number
          neutral_count: number
          positive_count: number
          profile_id: string
          protocols_assigned: number
          protocols_completed: number
          readiness_score: number
          relationship_score: number
          sentiment_score: number
          sentiment_trend: number
          total_conversations: number
          total_minutes: number
          trust_score: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          accuracy_score?: number
          agent_profile_id: string
          created_at?: string
          familiarity_score?: number
          id?: string
          last_interaction_at?: string | null
          negative_count?: number
          neutral_count?: number
          positive_count?: number
          profile_id: string
          protocols_assigned?: number
          protocols_completed?: number
          readiness_score?: number
          relationship_score?: number
          sentiment_score?: number
          sentiment_trend?: number
          total_conversations?: number
          total_minutes?: number
          trust_score?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          accuracy_score?: number
          agent_profile_id?: string
          created_at?: string
          familiarity_score?: number
          id?: string
          last_interaction_at?: string | null
          negative_count?: number
          neutral_count?: number
          positive_count?: number
          profile_id?: string
          protocols_assigned?: number
          protocols_completed?: number
          readiness_score?: number
          relationship_score?: number
          sentiment_score?: number
          sentiment_trend?: number
          total_conversations?: number
          total_minutes?: number
          trust_score?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_relationship_agent_profile_id_fkey"
            columns: ["agent_profile_id"]
            isOneToOne: false
            referencedRelation: "agent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_relationship_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "agent_relationship_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      asset: {
        Row: {
          asset_id: string
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at: string
          description: string | null
          icon: string | null
          is_active: boolean
          location_id: string
          name: string
          requires_routine: boolean
          requires_training: boolean
          season_id: string | null
          slug: string | null
          sort_order: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          asset_id?: string
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          description?: string | null
          icon?: string | null
          is_active?: boolean
          location_id: string
          name: string
          requires_routine?: boolean
          requires_training?: boolean
          season_id?: string | null
          slug?: string | null
          sort_order?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          asset_id?: string
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          description?: string | null
          icon?: string | null
          is_active?: boolean
          location_id?: string
          name?: string
          requires_routine?: boolean
          requires_training?: boolean
          season_id?: string | null
          slug?: string | null
          sort_order?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "season"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "fk_asset_location"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "fk_asset_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      clause_library: {
        Row: {
          category: string
          content_html: string
          contract_types: string[] | null
          created_at: string | null
          id: string
          is_active: boolean | null
          language: string
          sort_order: number | null
          summary: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category: string
          content_html: string
          contract_types?: string[] | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          language?: string
          sort_order?: number | null
          summary?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          content_html?: string
          contract_types?: string[] | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          language?: string
          sort_order?: number | null
          summary?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      communication_log: {
        Row: {
          channel: Database["public"]["Enums"]["communication_channel"]
          created_at: string
          error_message: string | null
          invitation_id: string | null
          log_id: string
          message_type: string
          metadata: Json | null
          profile_id: string | null
          provider_message_id: string | null
          recipient: string
          sent_at: string | null
          status: Database["public"]["Enums"]["communication_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["communication_channel"]
          created_at?: string
          error_message?: string | null
          invitation_id?: string | null
          log_id?: string
          message_type: string
          metadata?: Json | null
          profile_id?: string | null
          provider_message_id?: string | null
          recipient: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["communication_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["communication_channel"]
          created_at?: string
          error_message?: string | null
          invitation_id?: string | null
          log_id?: string
          message_type?: string
          metadata?: Json | null
          profile_id?: string | null
          provider_message_id?: string | null
          recipient?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["communication_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_comm_log_invitation"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitation"
            referencedColumns: ["invitation_id"]
          },
          {
            foreignKeyName: "fk_comm_log_profile"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "fk_comm_log_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      company: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          billing_email: string | null
          city: string | null
          company_id: string
          company_type: string | null
          country: Database["public"]["Enums"]["country"]
          created_at: string
          daglig_leder: string | null
          default_currency: Database["public"]["Enums"]["currency"]
          default_language: Database["public"]["Enums"]["preferred_language"]
          email: string | null
          industry: Database["public"]["Enums"]["industry"]
          is_active: boolean
          legal_name: string | null
          logo_url: string | null
          nace_code: string | null
          nace_description: string | null
          name: string
          onboarding_status: string | null
          org_number: string
          phone: string | null
          postal_code: string | null
          raw_scraped_data: Json | null
          registration_date: string | null
          subscription_plan: string | null
          subscription_status: string | null
          trial_ends_at: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          billing_email?: string | null
          city?: string | null
          company_id?: string
          company_type?: string | null
          country?: Database["public"]["Enums"]["country"]
          created_at?: string
          daglig_leder?: string | null
          default_currency?: Database["public"]["Enums"]["currency"]
          default_language?: Database["public"]["Enums"]["preferred_language"]
          email?: string | null
          industry?: Database["public"]["Enums"]["industry"]
          is_active?: boolean
          legal_name?: string | null
          logo_url?: string | null
          nace_code?: string | null
          nace_description?: string | null
          name: string
          onboarding_status?: string | null
          org_number: string
          phone?: string | null
          postal_code?: string | null
          raw_scraped_data?: Json | null
          registration_date?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          billing_email?: string | null
          city?: string | null
          company_id?: string
          company_type?: string | null
          country?: Database["public"]["Enums"]["country"]
          created_at?: string
          daglig_leder?: string | null
          default_currency?: Database["public"]["Enums"]["currency"]
          default_language?: Database["public"]["Enums"]["preferred_language"]
          email?: string | null
          industry?: Database["public"]["Enums"]["industry"]
          is_active?: boolean
          legal_name?: string | null
          logo_url?: string | null
          nace_code?: string | null
          nace_description?: string | null
          name?: string
          onboarding_status?: string | null
          org_number?: string
          phone?: string | null
          postal_code?: string | null
          raw_scraped_data?: Json | null
          registration_date?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      company_member: {
        Row: {
          company_id: string
          company_member_id: string
          created_at: string
          is_active: boolean
          joined_at: string
          role: Database["public"]["Enums"]["company_member_role"]
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          company_member_id?: string
          created_at?: string
          is_active?: boolean
          joined_at?: string
          role?: Database["public"]["Enums"]["company_member_role"]
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          company_member_id?: string
          created_at?: string
          is_active?: boolean
          joined_at?: string
          role?: Database["public"]["Enums"]["company_member_role"]
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_company_member_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fk_company_member_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      confirmation: {
        Row: {
          confirmation_id: string
          confirmation_text: string
          created_at: string
          is_active: boolean
          name: string
          protocol_id: string
          requires_signature: boolean
          updated_at: string
        }
        Insert: {
          confirmation_id?: string
          confirmation_text: string
          created_at?: string
          is_active?: boolean
          name: string
          protocol_id: string
          requires_signature?: boolean
          updated_at?: string
        }
        Update: {
          confirmation_id?: string
          confirmation_text?: string
          created_at?: string
          is_active?: boolean
          name?: string
          protocol_id?: string
          requires_signature?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_confirmation_protocol"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocol"
            referencedColumns: ["protocol_id"]
          },
        ]
      }
      contract: {
        Row: {
          audit_log_url: string | null
          auto_create_workspace: boolean | null
          company_id: string
          contract_id: string
          contract_number: string | null
          contract_type: string
          created_at: string
          created_by: string | null
          decline_reason: string | null
          declined_at: string | null
          document_url: string | null
          docuseal_embed_url: string | null
          docuseal_submission_id: string | null
          docuseal_submitter_id: number | null
          expires_at: string | null
          field_values: Json | null
          journey_type: string | null
          metadata: Json | null
          recipient_email: string | null
          recipient_name: string | null
          resolved_html: string | null
          resolved_values: Json
          sender_email: string | null
          sender_name: string | null
          sent_at: string | null
          signatories: Json
          signed_at: string | null
          signed_pdf_url: string | null
          signing_url: string | null
          status: string
          template_id: string | null
          title: string
          updated_at: string
          viewed_at: string | null
          workspace_id: string | null
        }
        Insert: {
          audit_log_url?: string | null
          auto_create_workspace?: boolean | null
          company_id: string
          contract_id?: string
          contract_number?: string | null
          contract_type?: string
          created_at?: string
          created_by?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          document_url?: string | null
          docuseal_embed_url?: string | null
          docuseal_submission_id?: string | null
          docuseal_submitter_id?: number | null
          expires_at?: string | null
          field_values?: Json | null
          journey_type?: string | null
          metadata?: Json | null
          recipient_email?: string | null
          recipient_name?: string | null
          resolved_html?: string | null
          resolved_values?: Json
          sender_email?: string | null
          sender_name?: string | null
          sent_at?: string | null
          signatories?: Json
          signed_at?: string | null
          signed_pdf_url?: string | null
          signing_url?: string | null
          status?: string
          template_id?: string | null
          title: string
          updated_at?: string
          viewed_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          audit_log_url?: string | null
          auto_create_workspace?: boolean | null
          company_id?: string
          contract_id?: string
          contract_number?: string | null
          contract_type?: string
          created_at?: string
          created_by?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          document_url?: string | null
          docuseal_embed_url?: string | null
          docuseal_submission_id?: string | null
          docuseal_submitter_id?: number | null
          expires_at?: string | null
          field_values?: Json | null
          journey_type?: string | null
          metadata?: Json | null
          recipient_email?: string | null
          recipient_name?: string | null
          resolved_html?: string | null
          resolved_values?: Json
          sender_email?: string | null
          sender_name?: string | null
          sent_at?: string | null
          signatories?: Json
          signed_at?: string | null
          signed_pdf_url?: string | null
          signing_url?: string | null
          status?: string
          template_id?: string | null
          title?: string
          updated_at?: string
          viewed_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_contract_instance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "platform_contract_instance_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "platform_contract_instance_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_template"
            referencedColumns: ["template_id"]
          },
          {
            foreignKeyName: "platform_contract_instance_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      contract_event: {
        Row: {
          actor_id: string | null
          actor_type: string
          contract_id: string
          created_at: string | null
          details: Json | null
          event_type: string
          id: string
          ip_address: unknown
          user_agent: string | null
          workspace_id: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_type: string
          contract_id: string
          created_at?: string | null
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          workspace_id?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          contract_id?: string
          created_at?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_event_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract"
            referencedColumns: ["contract_id"]
          },
        ]
      }
      contract_reminder: {
        Row: {
          contract_id: string
          created_at: string | null
          id: string
          language: string
          metadata: Json | null
          reminder_type: string
          scheduled_at: string
          sent_at: string | null
          skip_reason: string | null
          status: string | null
          template_key: string
          workspace_id: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string | null
          id?: string
          language?: string
          metadata?: Json | null
          reminder_type: string
          scheduled_at: string
          sent_at?: string | null
          skip_reason?: string | null
          status?: string | null
          template_key: string
          workspace_id?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string | null
          id?: string
          language?: string
          metadata?: Json | null
          reminder_type?: string
          scheduled_at?: string
          sent_at?: string | null
          skip_reason?: string | null
          status?: string | null
          template_key?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_reminder_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "contract_reminder_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      contract_template: {
        Row: {
          accent_color: string | null
          attachments: Json
          content_css: string | null
          content_html: string | null
          contract_type: string
          created_at: string
          created_by: string | null
          default_pricing: Json | null
          description: string | null
          docuseal_template_id: string | null
          footer_html: string | null
          header_html: string | null
          is_active: boolean | null
          is_system: boolean | null
          language: string
          last_synced_at: string | null
          locale: string
          name: string
          placeholders: Json
          status: string
          template_id: string
          template_type: string
          updated_at: string
          variable_fields: Json
          version: number | null
          watermark_url: string | null
          workspace_id: string | null
        }
        Insert: {
          accent_color?: string | null
          attachments?: Json
          content_css?: string | null
          content_html?: string | null
          contract_type?: string
          created_at?: string
          created_by?: string | null
          default_pricing?: Json | null
          description?: string | null
          docuseal_template_id?: string | null
          footer_html?: string | null
          header_html?: string | null
          is_active?: boolean | null
          is_system?: boolean | null
          language?: string
          last_synced_at?: string | null
          locale?: string
          name: string
          placeholders?: Json
          status?: string
          template_id?: string
          template_type: string
          updated_at?: string
          variable_fields?: Json
          version?: number | null
          watermark_url?: string | null
          workspace_id?: string | null
        }
        Update: {
          accent_color?: string | null
          attachments?: Json
          content_css?: string | null
          content_html?: string | null
          contract_type?: string
          created_at?: string
          created_by?: string | null
          default_pricing?: Json | null
          description?: string | null
          docuseal_template_id?: string | null
          footer_html?: string | null
          header_html?: string | null
          is_active?: boolean | null
          is_system?: boolean | null
          language?: string
          last_synced_at?: string | null
          locale?: string
          name?: string
          placeholders?: Json
          status?: string
          template_id?: string
          template_type?: string
          updated_at?: string
          variable_fields?: Json
          version?: number | null
          watermark_url?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_template_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "platform_contract_template_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      control_list: {
        Row: {
          assigned_to_ref: string | null
          assigned_to_type: Database["public"]["Enums"]["control_list_assigned_to_type"]
          control_list_id: string
          created_at: string
          description: string | null
          is_active: boolean
          items: Json
          name: string
          protocol_id: string
          updated_at: string
        }
        Insert: {
          assigned_to_ref?: string | null
          assigned_to_type: Database["public"]["Enums"]["control_list_assigned_to_type"]
          control_list_id?: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          items: Json
          name: string
          protocol_id: string
          updated_at?: string
        }
        Update: {
          assigned_to_ref?: string | null
          assigned_to_type?: Database["public"]["Enums"]["control_list_assigned_to_type"]
          control_list_id?: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          items?: Json
          name?: string
          protocol_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_control_list_protocol"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocol"
            referencedColumns: ["protocol_id"]
          },
        ]
      }
      custom_report: {
        Row: {
          config: Json
          created_at: string
          created_by: string
          description: string | null
          is_pinned: boolean
          name: string
          report_id: string
          updated_at: string
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          config: Json
          created_at?: string
          created_by: string
          description?: string | null
          is_pinned?: boolean
          name: string
          report_id?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          is_pinned?: boolean
          name?: string
          report_id?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_report_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "custom_report_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "custom_report_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      daily_reconciliation: {
        Row: {
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          department_id: string
          labor_percentage: number | null
          locked_at: string | null
          locked_by: string | null
          reconciliation_date: string
          reconciliation_id: string
          revenue_card: number | null
          revenue_cash: number | null
          revenue_per_worked_hour: number | null
          revenue_source: Database["public"]["Enums"]["revenue_source"] | null
          revenue_total: number | null
          revenue_transactions: number | null
          revenue_vat: number | null
          session_id: string | null
          settled_at: string | null
          settled_by: string | null
          status: Database["public"]["Enums"]["reconciliation_status"]
          total_actual_hours: number | null
          total_labor_cost: number | null
          total_planned_hours: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          department_id: string
          labor_percentage?: number | null
          locked_at?: string | null
          locked_by?: string | null
          reconciliation_date: string
          reconciliation_id?: string
          revenue_card?: number | null
          revenue_cash?: number | null
          revenue_per_worked_hour?: number | null
          revenue_source?: Database["public"]["Enums"]["revenue_source"] | null
          revenue_total?: number | null
          revenue_transactions?: number | null
          revenue_vat?: number | null
          session_id?: string | null
          settled_at?: string | null
          settled_by?: string | null
          status?: Database["public"]["Enums"]["reconciliation_status"]
          total_actual_hours?: number | null
          total_labor_cost?: number | null
          total_planned_hours?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          department_id?: string
          labor_percentage?: number | null
          locked_at?: string | null
          locked_by?: string | null
          reconciliation_date?: string
          reconciliation_id?: string
          revenue_card?: number | null
          revenue_cash?: number | null
          revenue_per_worked_hour?: number | null
          revenue_source?: Database["public"]["Enums"]["revenue_source"] | null
          revenue_total?: number | null
          revenue_transactions?: number | null
          revenue_vat?: number | null
          session_id?: string | null
          settled_at?: string | null
          settled_by?: string | null
          status?: Database["public"]["Enums"]["reconciliation_status"]
          total_actual_hours?: number | null
          total_labor_cost?: number | null
          total_planned_hours?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_reconciliation_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "daily_reconciliation_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "daily_reconciliation_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "daily_reconciliation_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "department_session"
            referencedColumns: ["department_session_id"]
          },
          {
            foreignKeyName: "daily_reconciliation_settled_by_fkey"
            columns: ["settled_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "daily_reconciliation_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      day_factor: {
        Row: {
          created_at: string
          day_factor_id: string
          factor: number
          season_budget_id: string
          updated_at: string
          weekday: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          day_factor_id?: string
          factor?: number
          season_budget_id: string
          updated_at?: string
          weekday: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          day_factor_id?: string
          factor?: number
          season_budget_id?: string
          updated_at?: string
          weekday?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_factor_season_budget_id_fkey"
            columns: ["season_budget_id"]
            isOneToOne: false
            referencedRelation: "season_budget"
            referencedColumns: ["season_budget_id"]
          },
          {
            foreignKeyName: "day_factor_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      department: {
        Row: {
          color: string | null
          created_at: string
          department_id: string
          description: string | null
          icon: string | null
          is_active: boolean
          manager_profile_id: string | null
          name: string
          slug: string
          sort_order: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          department_id?: string
          description?: string | null
          icon?: string | null
          is_active?: boolean
          manager_profile_id?: string | null
          name: string
          slug: string
          sort_order?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          department_id?: string
          description?: string | null
          icon?: string | null
          is_active?: boolean
          manager_profile_id?: string | null
          name?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_manager_profile_id_fkey"
            columns: ["manager_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "fk_department_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      department_session: {
        Row: {
          actual_shifts: number | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          department_id: string
          department_session_id: string
          handoff_notes: string | null
          opened_at: string | null
          opened_by: string | null
          planned_shifts: number | null
          season_id: string | null
          session_date: string
          signoff_notes: string | null
          status: Database["public"]["Enums"]["department_session_status"]
          tasks_completed: number | null
          tasks_total: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          actual_shifts?: number | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          department_id: string
          department_session_id?: string
          handoff_notes?: string | null
          opened_at?: string | null
          opened_by?: string | null
          planned_shifts?: number | null
          season_id?: string | null
          session_date: string
          signoff_notes?: string | null
          status?: Database["public"]["Enums"]["department_session_status"]
          tasks_completed?: number | null
          tasks_total?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          actual_shifts?: number | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          department_id?: string
          department_session_id?: string
          handoff_notes?: string | null
          opened_at?: string | null
          opened_by?: string | null
          planned_shifts?: number | null
          season_id?: string | null
          session_date?: string
          signoff_notes?: string | null
          status?: Database["public"]["Enums"]["department_session_status"]
          tasks_completed?: number | null
          tasks_total?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_session_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "department_session_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "department_session_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "department_session_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "season"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "department_session_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      deviation: {
        Row: {
          attachments: Json | null
          blocks_day_approval: boolean
          cost_impact: number | null
          created_at: string
          department_id: string | null
          description: string | null
          deviation_id: string
          domain: Database["public"]["Enums"]["deviation_domain"]
          linked_shift_id: string | null
          payroll_impact: boolean
          reconciliation_id: string | null
          reported_by: string | null
          requires_action: boolean
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          session_id: string | null
          severity: Database["public"]["Enums"]["deviation_severity"]
          status: Database["public"]["Enums"]["deviation_status"]
          subcategory: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attachments?: Json | null
          blocks_day_approval?: boolean
          cost_impact?: number | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          deviation_id?: string
          domain: Database["public"]["Enums"]["deviation_domain"]
          linked_shift_id?: string | null
          payroll_impact?: boolean
          reconciliation_id?: string | null
          reported_by?: string | null
          requires_action?: boolean
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          severity?: Database["public"]["Enums"]["deviation_severity"]
          status?: Database["public"]["Enums"]["deviation_status"]
          subcategory?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attachments?: Json | null
          blocks_day_approval?: boolean
          cost_impact?: number | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          deviation_id?: string
          domain?: Database["public"]["Enums"]["deviation_domain"]
          linked_shift_id?: string | null
          payroll_impact?: boolean
          reconciliation_id?: string | null
          reported_by?: string | null
          requires_action?: boolean
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          severity?: Database["public"]["Enums"]["deviation_severity"]
          status?: Database["public"]["Enums"]["deviation_status"]
          subcategory?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deviation_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "deviation_linked_shift_id_fkey"
            columns: ["linked_shift_id"]
            isOneToOne: false
            referencedRelation: "schedule_shift"
            referencedColumns: ["schedule_shift_id"]
          },
          {
            foreignKeyName: "deviation_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "daily_reconciliation"
            referencedColumns: ["reconciliation_id"]
          },
          {
            foreignKeyName: "deviation_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "deviation_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "deviation_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "department_session"
            referencedColumns: ["department_session_id"]
          },
          {
            foreignKeyName: "deviation_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      employee_roster: {
        Row: {
          created_at: string
          employee_roster_id: string
          is_active: boolean
          pattern: Json
          period_end: string | null
          period_start: string
          profile_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          employee_roster_id?: string
          is_active?: boolean
          pattern: Json
          period_end?: string | null
          period_start: string
          profile_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          employee_roster_id?: string
          is_active?: boolean
          pattern?: Json
          period_end?: string | null
          period_start?: string
          profile_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_roster_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "employee_roster_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      employment_contract: {
        Row: {
          contract_id: string
          created_at: string
          created_by: string | null
          document_url: string | null
          employment_category: string
          employment_percentage: number | null
          end_date: string | null
          hourly_rate: number | null
          monthly_salary: number | null
          position_title: string
          profile_id: string
          signature_id: string | null
          signed_at: string | null
          start_date: string
          status: Database["public"]["Enums"]["contract_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          contract_id?: string
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          employment_category: string
          employment_percentage?: number | null
          end_date?: string | null
          hourly_rate?: number | null
          monthly_salary?: number | null
          position_title: string
          profile_id: string
          signature_id?: string | null
          signed_at?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          employment_category?: string
          employment_percentage?: number | null
          end_date?: string | null
          hourly_rate?: number | null
          monthly_salary?: number | null
          position_title?: string
          profile_id?: string
          signature_id?: string | null
          signed_at?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_contract_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "fk_contract_profile"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "fk_contract_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      engine_authority_config: {
        Row: {
          capability: string
          created_at: string
          id: string
          level: string
          updated_at: string
          updated_by: string
          workspace_id: string
        }
        Insert: {
          capability: string
          created_at?: string
          id?: string
          level?: string
          updated_at?: string
          updated_by: string
          workspace_id: string
        }
        Update: {
          capability?: string
          created_at?: string
          id?: string
          level?: string
          updated_at?: string
          updated_by?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engine_authority_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "engine_authority_config_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      engine_delayed_trigger: {
        Row: {
          created_at: string
          event_id: string
          fire_at: string
          fired: boolean
          id: string
          trigger_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          fire_at: string
          fired?: boolean
          id?: string
          trigger_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          fire_at?: string
          fired?: boolean
          id?: string
          trigger_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engine_delayed_trigger_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "engine_event"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engine_delayed_trigger_trigger_id_fkey"
            columns: ["trigger_id"]
            isOneToOne: false
            referencedRelation: "engine_trigger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engine_delayed_trigger_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      engine_event: {
        Row: {
          event_type: string
          fired_at: string
          id: string
          idempotency_key: string | null
          payload: Json
          workspace_id: string
        }
        Insert: {
          event_type: string
          fired_at?: string
          id?: string
          idempotency_key?: string | null
          payload?: Json
          workspace_id: string
        }
        Update: {
          event_type?: string
          fired_at?: string
          id?: string
          idempotency_key?: string | null
          payload?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engine_event_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      engine_inbox: {
        Row: {
          created_at: string
          data: Json
          entity_type: string
          id: string
          processed: boolean
          session_id: string
          stage_id: string
          validated: boolean
          workspace_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          entity_type: string
          id?: string
          processed?: boolean
          session_id: string
          stage_id: string
          validated?: boolean
          workspace_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          entity_type?: string
          id?: string
          processed?: boolean
          session_id?: string
          stage_id?: string
          validated?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engine_inbox_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "engine_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engine_inbox_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      engine_memory: {
        Row: {
          agent_profile_id: string | null
          content: string
          created_at: string
          embedding: string | null
          expires_at: string | null
          id: string
          importance: number
          memory_type: string
          profile_id: string
          scope: string
          source_session_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_profile_id?: string | null
          content: string
          created_at?: string
          embedding?: string | null
          expires_at?: string | null
          id?: string
          importance?: number
          memory_type: string
          profile_id: string
          scope?: string
          source_session_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_profile_id?: string | null
          content?: string
          created_at?: string
          embedding?: string | null
          expires_at?: string | null
          id?: string
          importance?: number
          memory_type?: string
          profile_id?: string
          scope?: string
          source_session_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engine_memory_agent_profile_id_fkey"
            columns: ["agent_profile_id"]
            isOneToOne: false
            referencedRelation: "agent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engine_memory_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "engine_memory_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "engine_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engine_memory_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      engine_missions: {
        Row: {
          context_source: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          mode: string
          name: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          context_source?: string | null
          created_at?: string
          description?: string | null
          id: string
          is_active?: boolean
          mode?: string
          name: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          context_source?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          mode?: string
          name?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engine_missions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      engine_process: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          max_steps: number
          name: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id: string
          is_active?: boolean
          max_steps?: number
          name: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_steps?: number
          name?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engine_process_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      engine_sessions: {
        Row: {
          callback_url: string | null
          channel: string
          collected_data: Json
          completed_at: string | null
          context: Json
          created_at: string
          current_stage_id: string | null
          expires_at: string
          id: string
          mission_id: string | null
          mode: string
          profile_id: string | null
          stage_index: number
          status: string
          summary: string | null
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          callback_url?: string | null
          channel: string
          collected_data?: Json
          completed_at?: string | null
          context?: Json
          created_at?: string
          current_stage_id?: string | null
          expires_at?: string
          id?: string
          mission_id?: string | null
          mode?: string
          profile_id?: string | null
          stage_index?: number
          status?: string
          summary?: string | null
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          callback_url?: string | null
          channel?: string
          collected_data?: Json
          completed_at?: string | null
          context?: Json
          created_at?: string
          current_stage_id?: string | null
          expires_at?: string
          id?: string
          mission_id?: string | null
          mode?: string
          profile_id?: string | null
          stage_index?: number
          status?: string
          summary?: string | null
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engine_sessions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "engine_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engine_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      engine_stages: {
        Row: {
          created_at: string
          creative_freedom: number
          deferred_templates: Json | null
          emotion_hint: string | null
          escalation_instructions: string | null
          goal: string
          id: string
          inline_instructions: Json | null
          instructions: string
          is_required: boolean
          mission_id: string
          next_stage: string | null
          personality_override: string | null
          stage_id: string
          stage_order: number
          success_criteria: string
        }
        Insert: {
          created_at?: string
          creative_freedom?: number
          deferred_templates?: Json | null
          emotion_hint?: string | null
          escalation_instructions?: string | null
          goal: string
          id?: string
          inline_instructions?: Json | null
          instructions: string
          is_required?: boolean
          mission_id: string
          next_stage?: string | null
          personality_override?: string | null
          stage_id: string
          stage_order: number
          success_criteria: string
        }
        Update: {
          created_at?: string
          creative_freedom?: number
          deferred_templates?: Json | null
          emotion_hint?: string | null
          escalation_instructions?: string | null
          goal?: string
          id?: string
          inline_instructions?: Json | null
          instructions?: string
          is_required?: boolean
          mission_id?: string
          next_stage?: string | null
          personality_override?: string | null
          stage_id?: string
          stage_order?: number
          success_criteria?: string
        }
        Relationships: [
          {
            foreignKeyName: "engine_stages_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "engine_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      engine_state: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          context: Json
          current_step: number
          depth: number
          entity_id: string | null
          entity_type: string | null
          id: string
          last_error: string | null
          parent_state_id: string | null
          process_id: string
          result: Json | null
          retry_count: number
          started_at: string
          status: string
          steps_snapshot: Json | null
          trigger_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          context?: Json
          current_step?: number
          depth?: number
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          last_error?: string | null
          parent_state_id?: string | null
          process_id: string
          result?: Json | null
          retry_count?: number
          started_at?: string
          status?: string
          steps_snapshot?: Json | null
          trigger_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          context?: Json
          current_step?: number
          depth?: number
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          last_error?: string | null
          parent_state_id?: string | null
          process_id?: string
          result?: Json | null
          retry_count?: number
          started_at?: string
          status?: string
          steps_snapshot?: Json | null
          trigger_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engine_state_parent_state_id_fkey"
            columns: ["parent_state_id"]
            isOneToOne: false
            referencedRelation: "engine_state"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engine_state_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "engine_process"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engine_state_trigger_id_fkey"
            columns: ["trigger_id"]
            isOneToOne: false
            referencedRelation: "engine_trigger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engine_state_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      engine_step: {
        Row: {
          action_payload: Json
          action_type: string
          assignee_rule: string | null
          condition: Json | null
          created_at: string
          id: string
          process_id: string
          step_group: number | null
          step_order: number
          updated_at: string
        }
        Insert: {
          action_payload?: Json
          action_type: string
          assignee_rule?: string | null
          condition?: Json | null
          created_at?: string
          id?: string
          process_id: string
          step_group?: number | null
          step_order: number
          updated_at?: string
        }
        Update: {
          action_payload?: Json
          action_type?: string
          assignee_rule?: string | null
          condition?: Json | null
          created_at?: string
          id?: string
          process_id?: string
          step_group?: number | null
          step_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "engine_step_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "engine_process"
            referencedColumns: ["id"]
          },
        ]
      }
      engine_trigger: {
        Row: {
          condition: Json | null
          created_at: string
          delay_seconds: number | null
          event_type: string
          id: string
          is_active: boolean
          process_id: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          condition?: Json | null
          created_at?: string
          delay_seconds?: number | null
          event_type: string
          id?: string
          is_active?: boolean
          process_id: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          condition?: Json | null
          created_at?: string
          delay_seconds?: number | null
          event_type?: string
          id?: string
          is_active?: boolean
          process_id?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engine_trigger_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "engine_process"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engine_trigger_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      hour_factor: {
        Row: {
          created_at: string
          factor: number
          hour: number
          hour_factor_id: string
          season_budget_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          factor?: number
          hour: number
          hour_factor_id?: string
          season_budget_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          factor?: number
          hour?: number
          hour_factor_id?: string
          season_budget_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hour_factor_season_budget_id_fkey"
            columns: ["season_budget_id"]
            isOneToOne: false
            referencedRelation: "season_budget"
            referencedColumns: ["season_budget_id"]
          },
          {
            foreignKeyName: "hour_factor_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      invitation: {
        Row: {
          company_id: string
          created_at: string
          department_ids: string[] | null
          email: string | null
          expires_at: string
          first_name: string | null
          invitation_id: string
          invite_type: Database["public"]["Enums"]["invite_type"]
          invited_by: string | null
          last_name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["profile_role"]
          status: Database["public"]["Enums"]["invite_status"]
          team_ids: string[] | null
          token: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          department_ids?: string[] | null
          email?: string | null
          expires_at?: string
          first_name?: string | null
          invitation_id?: string
          invite_type?: Database["public"]["Enums"]["invite_type"]
          invited_by?: string | null
          last_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          status?: Database["public"]["Enums"]["invite_status"]
          team_ids?: string[] | null
          token?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          department_ids?: string[] | null
          email?: string | null
          expires_at?: string
          first_name?: string | null
          invitation_id?: string
          invite_type?: Database["public"]["Enums"]["invite_type"]
          invited_by?: string | null
          last_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          status?: Database["public"]["Enums"]["invite_status"]
          team_ids?: string[] | null
          token?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_invitation_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fk_invitation_invited_by"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "fk_invitation_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      journey: {
        Row: {
          actor: Database["public"]["Enums"]["journey_actor"]
          assignee_id: string | null
          blocked_by: string[]
          code: string
          created_at: string
          created_by: string | null
          doc_title: string | null
          journey_id: string
          last_test_result:
            | Database["public"]["Enums"]["journey_test_result"]
            | null
          last_test_run_at: string | null
          linear_issue_id: string | null
          module: Database["public"]["Enums"]["journey_module"]
          outcomes_empty: string | null
          outcomes_error: string | null
          outcomes_success: string | null
          platform: Database["public"]["Enums"]["journey_platform"]
          preconditions: string[]
          priority: Database["public"]["Enums"]["journey_priority"]
          related_journeys: string[]
          slug: string
          status: Database["public"]["Enums"]["journey_status"]
          tags: string[]
          test_assertion: string | null
          title: string
          trigger_description: string | null
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          actor: Database["public"]["Enums"]["journey_actor"]
          assignee_id?: string | null
          blocked_by?: string[]
          code: string
          created_at?: string
          created_by?: string | null
          doc_title?: string | null
          journey_id?: string
          last_test_result?:
            | Database["public"]["Enums"]["journey_test_result"]
            | null
          last_test_run_at?: string | null
          linear_issue_id?: string | null
          module: Database["public"]["Enums"]["journey_module"]
          outcomes_empty?: string | null
          outcomes_error?: string | null
          outcomes_success?: string | null
          platform?: Database["public"]["Enums"]["journey_platform"]
          preconditions?: string[]
          priority?: Database["public"]["Enums"]["journey_priority"]
          related_journeys?: string[]
          slug: string
          status?: Database["public"]["Enums"]["journey_status"]
          tags?: string[]
          test_assertion?: string | null
          title: string
          trigger_description?: string | null
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          actor?: Database["public"]["Enums"]["journey_actor"]
          assignee_id?: string | null
          blocked_by?: string[]
          code?: string
          created_at?: string
          created_by?: string | null
          doc_title?: string | null
          journey_id?: string
          last_test_result?:
            | Database["public"]["Enums"]["journey_test_result"]
            | null
          last_test_run_at?: string | null
          linear_issue_id?: string | null
          module?: Database["public"]["Enums"]["journey_module"]
          outcomes_empty?: string | null
          outcomes_error?: string | null
          outcomes_success?: string | null
          platform?: Database["public"]["Enums"]["journey_platform"]
          preconditions?: string[]
          priority?: Database["public"]["Enums"]["journey_priority"]
          related_journeys?: string[]
          slug?: string
          status?: Database["public"]["Enums"]["journey_status"]
          tags?: string[]
          test_assertion?: string | null
          title?: string
          trigger_description?: string | null
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "journey_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "journey_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      journey_event: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["journey_event_type"]
          from_status: Database["public"]["Enums"]["journey_status"] | null
          journey_event_id: string
          journey_id: string
          metadata: Json
          to_status: Database["public"]["Enums"]["journey_status"] | null
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["journey_event_type"]
          from_status?: Database["public"]["Enums"]["journey_status"] | null
          journey_event_id?: string
          journey_id: string
          metadata?: Json
          to_status?: Database["public"]["Enums"]["journey_status"] | null
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["journey_event_type"]
          from_status?: Database["public"]["Enums"]["journey_status"] | null
          journey_event_id?: string
          journey_id?: string
          metadata?: Json
          to_status?: Database["public"]["Enums"]["journey_status"] | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_event_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "journey_event_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "journey_event_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      journey_step: {
        Row: {
          action: string
          component: string | null
          created_at: string
          data_reads: string[]
          data_writes: string[]
          expects: string | null
          journey_id: string
          journey_step_id: string
          notes: string | null
          screen: string | null
          step_order: number
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          action: string
          component?: string | null
          created_at?: string
          data_reads?: string[]
          data_writes?: string[]
          expects?: string | null
          journey_id: string
          journey_step_id?: string
          notes?: string | null
          screen?: string | null
          step_order: number
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          action?: string
          component?: string | null
          created_at?: string
          data_reads?: string[]
          data_writes?: string[]
          expects?: string | null
          journey_id?: string
          journey_step_id?: string
          notes?: string | null
          screen?: string | null
          step_order?: number
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_step_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "journey_step_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      journey_test_run: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          journey_id: string
          journey_test_run_id: string
          result: Database["public"]["Enums"]["journey_test_result"]
          test_output: Json | null
          test_type: Database["public"]["Enums"]["journey_test_type"]
          triggered_by: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          journey_id: string
          journey_test_run_id?: string
          result: Database["public"]["Enums"]["journey_test_result"]
          test_output?: Json | null
          test_type?: Database["public"]["Enums"]["journey_test_type"]
          triggered_by?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          journey_id?: string
          journey_test_run_id?: string
          result?: Database["public"]["Enums"]["journey_test_result"]
          test_output?: Json | null
          test_type?: Database["public"]["Enums"]["journey_test_type"]
          triggered_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_test_run_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "journey_test_run_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "journey_test_run_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      knowledge_test: {
        Row: {
          created_at: string
          description: string | null
          is_active: boolean
          knowledge_test_id: string
          max_attempts: number | null
          name: string
          pass_threshold: number
          protocol_id: string
          questions: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_active?: boolean
          knowledge_test_id?: string
          max_attempts?: number | null
          name: string
          pass_threshold?: number
          protocol_id: string
          questions: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          is_active?: boolean
          knowledge_test_id?: string
          max_attempts?: number | null
          name?: string
          pass_threshold?: number
          protocol_id?: string
          questions?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_knowledge_test_protocol"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocol"
            referencedColumns: ["protocol_id"]
          },
        ]
      }
      landing_block: {
        Row: {
          block_type: Database["public"]["Enums"]["landing_block_type"]
          content: Json
          created_at: string
          id: string
          is_visible: boolean
          settings: Json
          sort_order: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          block_type: Database["public"]["Enums"]["landing_block_type"]
          content?: Json
          created_at?: string
          id?: string
          is_visible?: boolean
          settings?: Json
          sort_order?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          block_type?: Database["public"]["Enums"]["landing_block_type"]
          content?: Json
          created_at?: string
          id?: string
          is_visible?: boolean
          settings?: Json
          sort_order?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_block_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "landing_variant"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_config: {
        Row: {
          config_id: string
          config_json: Json
          created_at: string
          created_by: string | null
          locale: string
          name: string
          published_at: string | null
          published_by: string | null
          published_json: Json | null
          slug: string
          status: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          config_id?: string
          config_json: Json
          created_at?: string
          created_by?: string | null
          locale?: string
          name: string
          published_at?: string | null
          published_by?: string | null
          published_json?: Json | null
          slug: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          config_id?: string
          config_json?: Json
          created_at?: string
          created_by?: string | null
          locale?: string
          name?: string
          published_at?: string | null
          published_by?: string | null
          published_json?: Json | null
          slug?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "landing_config_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "landing_config_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "landing_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      landing_config_version: {
        Row: {
          change_notes: string | null
          config_id: string
          config_json: Json
          created_at: string
          created_by: string | null
          updated_at: string
          version: number
          version_id: string
        }
        Insert: {
          change_notes?: string | null
          config_id: string
          config_json: Json
          created_at?: string
          created_by?: string | null
          updated_at?: string
          version: number
          version_id?: string
        }
        Update: {
          change_notes?: string | null
          config_id?: string
          config_json?: Json
          created_at?: string
          created_by?: string | null
          updated_at?: string
          version?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_config_version_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "landing_config"
            referencedColumns: ["config_id"]
          },
          {
            foreignKeyName: "landing_config_version_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      landing_event: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          ip_address: unknown
          referrer: string | null
          session_id: string | null
          user_agent: string | null
          variant: string | null
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          variant?: string | null
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          variant?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_event_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "landing_visitor"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_media: {
        Row: {
          alt_text: string
          created_at: string
          file_size: number | null
          height: number | null
          id: string
          mime_type: string
          storage_path: string
          variant_id: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string
          created_at?: string
          file_size?: number | null
          height?: number | null
          id?: string
          mime_type: string
          storage_path: string
          variant_id?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string
          created_at?: string
          file_size?: number | null
          height?: number | null
          id?: string
          mime_type?: string
          storage_path?: string
          variant_id?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_media_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "landing_variant"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_session: {
        Row: {
          click_count: number
          created_at: string
          cta_click_count: number
          device_type: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          ip_address: unknown
          max_scroll_depth: number
          page_count: number
          referrer: string | null
          session_id: string
          started_at: string
          updated_at: string
          user_agent: string | null
          variant: string | null
          visitor_id: string
        }
        Insert: {
          click_count?: number
          created_at?: string
          cta_click_count?: number
          device_type?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          ip_address?: unknown
          max_scroll_depth?: number
          page_count?: number
          referrer?: string | null
          session_id: string
          started_at?: string
          updated_at?: string
          user_agent?: string | null
          variant?: string | null
          visitor_id: string
        }
        Update: {
          click_count?: number
          created_at?: string
          cta_click_count?: number
          device_type?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          ip_address?: unknown
          max_scroll_depth?: number
          page_count?: number
          referrer?: string | null
          session_id?: string
          started_at?: string
          updated_at?: string
          user_agent?: string | null
          variant?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_session_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "landing_visitor"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_variant: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          meta_description: string | null
          meta_title: string | null
          name: string
          og_image_path: string | null
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["landing_variant_status"]
          theme: Json
          updated_at: string
          voice_config: Json
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name: string
          og_image_path?: string | null
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["landing_variant_status"]
          theme?: Json
          updated_at?: string
          voice_config?: Json
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          og_image_path?: string | null
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["landing_variant_status"]
          theme?: Json
          updated_at?: string
          voice_config?: Json
        }
        Relationships: []
      }
      landing_visitor: {
        Row: {
          created_at: string
          first_referrer: string | null
          first_seen: string
          first_variant: string | null
          id: string
          ip_addresses: string[]
          last_seen: string
          manual_label: string | null
          manual_notes: string | null
          tagged_at: string | null
          tagged_by: string | null
          updated_at: string
          user_agents: string[]
          user_identity_id: string | null
          visit_count: number
        }
        Insert: {
          created_at?: string
          first_referrer?: string | null
          first_seen?: string
          first_variant?: string | null
          id: string
          ip_addresses?: string[]
          last_seen?: string
          manual_label?: string | null
          manual_notes?: string | null
          tagged_at?: string | null
          tagged_by?: string | null
          updated_at?: string
          user_agents?: string[]
          user_identity_id?: string | null
          visit_count?: number
        }
        Update: {
          created_at?: string
          first_referrer?: string | null
          first_seen?: string
          first_variant?: string | null
          id?: string
          ip_addresses?: string[]
          last_seen?: string
          manual_label?: string | null
          manual_notes?: string | null
          tagged_at?: string | null
          tagged_by?: string | null
          updated_at?: string
          user_agents?: string[]
          user_identity_id?: string | null
          visit_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "landing_visitor_tagged_by_fkey"
            columns: ["tagged_by"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "landing_visitor_user_identity_id_fkey"
            columns: ["user_identity_id"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      location: {
        Row: {
          address: string | null
          capacity: number | null
          created_at: string
          description: string | null
          floor: string | null
          is_active: boolean
          latitude: number | null
          location_id: string
          location_type: Database["public"]["Enums"]["location_type"]
          longitude: number | null
          name: string
          slug: string
          sort_order: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          created_at?: string
          description?: string | null
          floor?: string | null
          is_active?: boolean
          latitude?: number | null
          location_id?: string
          location_type?: Database["public"]["Enums"]["location_type"]
          longitude?: number | null
          name: string
          slug: string
          sort_order?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          address?: string | null
          capacity?: number | null
          created_at?: string
          description?: string | null
          floor?: string | null
          is_active?: boolean
          latitude?: number | null
          location_id?: string
          location_type?: Database["public"]["Enums"]["location_type"]
          longitude?: number | null
          name?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_location_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      message_template: {
        Row: {
          body_en: string | null
          body_no: string
          category: string
          channel: string
          created_at: string | null
          cta_label_en: string | null
          cta_label_no: string | null
          cta_url_template: string | null
          id: string
          is_active: boolean | null
          key: string
          sms_body_en: string | null
          sms_body_no: string | null
          subject_en: string | null
          subject_no: string | null
          updated_at: string | null
        }
        Insert: {
          body_en?: string | null
          body_no: string
          category: string
          channel: string
          created_at?: string | null
          cta_label_en?: string | null
          cta_label_no?: string | null
          cta_url_template?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          sms_body_en?: string | null
          sms_body_no?: string | null
          subject_en?: string | null
          subject_no?: string | null
          updated_at?: string | null
        }
        Update: {
          body_en?: string | null
          body_no?: string
          category?: string
          channel?: string
          created_at?: string | null
          cta_label_en?: string | null
          cta_label_no?: string | null
          cta_url_template?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          sms_body_en?: string | null
          sms_body_no?: string | null
          subject_en?: string | null
          subject_no?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notification_outbox: {
        Row: {
          action_url: string | null
          allowed_channels:
            | Database["public"]["Enums"]["notification_channel"][]
            | null
          body: string
          created_at: string
          error_log: string | null
          id: number
          metadata: Json | null
          mode: Database["public"]["Enums"]["notification_mode"]
          priority: number
          processed_at: string | null
          recipient_id: string
          scheduled_for: string | null
          status: Database["public"]["Enums"]["notification_status"] | null
          title: string
          workspace_id: string
        }
        Insert: {
          action_url?: string | null
          allowed_channels?:
            | Database["public"]["Enums"]["notification_channel"][]
            | null
          body: string
          created_at?: string
          error_log?: string | null
          id?: number
          metadata?: Json | null
          mode: Database["public"]["Enums"]["notification_mode"]
          priority?: number
          processed_at?: string | null
          recipient_id: string
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["notification_status"] | null
          title: string
          workspace_id: string
        }
        Update: {
          action_url?: string | null
          allowed_channels?:
            | Database["public"]["Enums"]["notification_channel"][]
            | null
          body?: string
          created_at?: string
          error_log?: string | null
          id?: number
          metadata?: Json | null
          mode?: Database["public"]["Enums"]["notification_mode"]
          priority?: number
          processed_at?: string | null
          recipient_id?: string
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["notification_status"] | null
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "notification_outbox_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      notification_preference: {
        Row: {
          community_enabled: boolean | null
          created_at: string
          email_enabled: boolean | null
          push_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          quiet_hours_timezone: string | null
          sms_enabled: boolean | null
          training_enabled: boolean | null
          updated_at: string
          user_id: string
          work_enabled: boolean | null
        }
        Insert: {
          community_enabled?: boolean | null
          created_at?: string
          email_enabled?: boolean | null
          push_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          quiet_hours_timezone?: string | null
          sms_enabled?: boolean | null
          training_enabled?: boolean | null
          updated_at?: string
          user_id: string
          work_enabled?: boolean | null
        }
        Update: {
          community_enabled?: boolean | null
          created_at?: string
          email_enabled?: boolean | null
          push_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          quiet_hours_timezone?: string | null
          sms_enabled?: boolean | null
          training_enabled?: boolean | null
          updated_at?: string
          user_id?: string
          work_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_preference_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      onboarding_session: {
        Row: {
          ai_analysis: Json | null
          brreg_data: Json | null
          company_id: string | null
          completed_at: string | null
          completed_steps: number[] | null
          confirmed_branding: Json | null
          confirmed_departments: Json | null
          confirmed_locations: Json | null
          confirmed_positions: Json | null
          confirmed_teams: Json | null
          contract_generated_at: string | null
          contract_sent_at: string | null
          contract_signed_at: string | null
          contract_url: string | null
          created_at: string | null
          current_step: number | null
          id: string
          scraped_data: Json | null
          season_id: string | null
          seasonal_context: string | null
          source_url: string | null
          started_at: string | null
          suggested_branding: Json | null
          suggested_departments: Json | null
          suggested_locations: Json | null
          suggested_positions: Json | null
          suggested_teams: Json | null
          updated_at: string | null
          user_id: string | null
          web_search_data: Json | null
          workspace_id: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          brreg_data?: Json | null
          company_id?: string | null
          completed_at?: string | null
          completed_steps?: number[] | null
          confirmed_branding?: Json | null
          confirmed_departments?: Json | null
          confirmed_locations?: Json | null
          confirmed_positions?: Json | null
          confirmed_teams?: Json | null
          contract_generated_at?: string | null
          contract_sent_at?: string | null
          contract_signed_at?: string | null
          contract_url?: string | null
          created_at?: string | null
          current_step?: number | null
          id?: string
          scraped_data?: Json | null
          season_id?: string | null
          seasonal_context?: string | null
          source_url?: string | null
          started_at?: string | null
          suggested_branding?: Json | null
          suggested_departments?: Json | null
          suggested_locations?: Json | null
          suggested_positions?: Json | null
          suggested_teams?: Json | null
          updated_at?: string | null
          user_id?: string | null
          web_search_data?: Json | null
          workspace_id?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          brreg_data?: Json | null
          company_id?: string | null
          completed_at?: string | null
          completed_steps?: number[] | null
          confirmed_branding?: Json | null
          confirmed_departments?: Json | null
          confirmed_locations?: Json | null
          confirmed_positions?: Json | null
          confirmed_teams?: Json | null
          contract_generated_at?: string | null
          contract_sent_at?: string | null
          contract_signed_at?: string | null
          contract_url?: string | null
          created_at?: string | null
          current_step?: number | null
          id?: string
          scraped_data?: Json | null
          season_id?: string | null
          seasonal_context?: string | null
          source_url?: string | null
          started_at?: string | null
          suggested_branding?: Json | null
          suggested_departments?: Json | null
          suggested_locations?: Json | null
          suggested_positions?: Json | null
          suggested_teams?: Json | null
          updated_at?: string | null
          user_id?: string | null
          web_search_data?: Json | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_session_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "onboarding_session_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "season"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "onboarding_session_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      operating_hours: {
        Row: {
          close_time: string
          created_at: string
          day_of_week: number
          id: string
          is_closed: boolean
          location_id: string | null
          open_time: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          close_time?: string
          created_at?: string
          day_of_week: number
          id?: string
          is_closed?: boolean
          location_id?: string | null
          open_time?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          close_time?: string
          created_at?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean
          location_id?: string | null
          open_time?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operating_hours_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "operating_hours_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      platform_api_key: {
        Row: {
          allowed_ips: unknown[] | null
          company_id: string | null
          created_at: string
          created_by: string
          demoted_at: string | null
          description: string | null
          environment: string
          expires_at: string | null
          grace_period_ends_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          key_type: Database["public"]["Enums"]["api_key_type"]
          last_used_at: string | null
          name: string
          rate_limit_per_minute: number | null
          revoked_at: string | null
          rotation_number: number
          scopes: string[]
          updated_at: string
          version: Database["public"]["Enums"]["api_key_version_status"]
          workspace_id: string | null
        }
        Insert: {
          allowed_ips?: unknown[] | null
          company_id?: string | null
          created_at?: string
          created_by: string
          demoted_at?: string | null
          description?: string | null
          environment?: string
          expires_at?: string | null
          grace_period_ends_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          key_type?: Database["public"]["Enums"]["api_key_type"]
          last_used_at?: string | null
          name: string
          rate_limit_per_minute?: number | null
          revoked_at?: string | null
          rotation_number?: number
          scopes?: string[]
          updated_at?: string
          version?: Database["public"]["Enums"]["api_key_version_status"]
          workspace_id?: string | null
        }
        Update: {
          allowed_ips?: unknown[] | null
          company_id?: string | null
          created_at?: string
          created_by?: string
          demoted_at?: string | null
          description?: string | null
          environment?: string
          expires_at?: string | null
          grace_period_ends_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          key_type?: Database["public"]["Enums"]["api_key_type"]
          last_used_at?: string | null
          name?: string
          rate_limit_per_minute?: number | null
          revoked_at?: string | null
          rotation_number?: number
          scopes?: string[]
          updated_at?: string
          version?: Database["public"]["Enums"]["api_key_version_status"]
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_api_key_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "platform_api_key_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "platform_api_key_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      platform_api_key_usage: {
        Row: {
          api_key_id: string
          created_at: string
          error_count: number
          id: string
          last_endpoint: string | null
          last_status: number | null
          period_start: string
          request_count: number
        }
        Insert: {
          api_key_id: string
          created_at?: string
          error_count?: number
          id?: string
          last_endpoint?: string | null
          last_status?: number | null
          period_start: string
          request_count?: number
        }
        Update: {
          api_key_id?: string
          created_at?: string
          error_count?: number
          id?: string
          last_endpoint?: string | null
          last_status?: number | null
          period_start?: string
          request_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "platform_api_key_usage_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "platform_api_key"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          super_admin_id: string
          updated_at: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          super_admin_id: string
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          super_admin_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_audit_log_super_admin_id_fkey"
            columns: ["super_admin_id"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      platform_communication_log: {
        Row: {
          audience_filter: Json | null
          classification: string
          clicked_count: number
          communication_id: string
          created_at: string | null
          failed_count: number
          idempotency_key: string | null
          message_body: string
          opened_count: number
          provider: string | null
          provider_batch_id: string | null
          recipient_count: number
          sendgrid_template_id: string | null
          sent_count: number
          status: string
          subject: string
          super_admin_id: string
          template: string
          template_data: Json | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          audience_filter?: Json | null
          classification?: string
          clicked_count?: number
          communication_id?: string
          created_at?: string | null
          failed_count?: number
          idempotency_key?: string | null
          message_body: string
          opened_count?: number
          provider?: string | null
          provider_batch_id?: string | null
          recipient_count?: number
          sendgrid_template_id?: string | null
          sent_count?: number
          status?: string
          subject: string
          super_admin_id: string
          template: string
          template_data?: Json | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          audience_filter?: Json | null
          classification?: string
          clicked_count?: number
          communication_id?: string
          created_at?: string | null
          failed_count?: number
          idempotency_key?: string | null
          message_body?: string
          opened_count?: number
          provider?: string | null
          provider_batch_id?: string | null
          recipient_count?: number
          sendgrid_template_id?: string | null
          sent_count?: number
          status?: string
          subject?: string
          super_admin_id?: string
          template?: string
          template_data?: Json | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_communication_log_super_admin_id_fkey"
            columns: ["super_admin_id"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "platform_communication_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      platform_communication_recipient: {
        Row: {
          click_count: number
          clicked_at: string | null
          communication_id: string
          created_at: string | null
          delivered_at: string | null
          email: string
          error_message: string | null
          locale: string
          name: string | null
          open_count: number
          opened_at: string | null
          recipient_id: string
          sent_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          click_count?: number
          clicked_at?: string | null
          communication_id: string
          created_at?: string | null
          delivered_at?: string | null
          email: string
          error_message?: string | null
          locale?: string
          name?: string | null
          open_count?: number
          opened_at?: string | null
          recipient_id?: string
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          click_count?: number
          clicked_at?: string | null
          communication_id?: string
          created_at?: string | null
          delivered_at?: string | null
          email?: string
          error_message?: string | null
          locale?: string
          name?: string | null
          open_count?: number
          opened_at?: string | null
          recipient_id?: string
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_communication_recipient_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "platform_communication_log"
            referencedColumns: ["communication_id"]
          },
          {
            foreignKeyName: "platform_communication_recipient_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      platform_doc_chunk: {
        Row: {
          chunk_id: string
          chunk_index: number
          content: string
          content_hash: string
          created_at: string
          doc_type: Database["public"]["Enums"]["doc_type"]
          embedding: string | null
          metadata: Json | null
          section_title: string | null
          source_hash: string
          source_path: string
          token_count: number
          updated_at: string
        }
        Insert: {
          chunk_id?: string
          chunk_index?: number
          content: string
          content_hash: string
          created_at?: string
          doc_type?: Database["public"]["Enums"]["doc_type"]
          embedding?: string | null
          metadata?: Json | null
          section_title?: string | null
          source_hash: string
          source_path: string
          token_count?: number
          updated_at?: string
        }
        Update: {
          chunk_id?: string
          chunk_index?: number
          content?: string
          content_hash?: string
          created_at?: string
          doc_type?: Database["public"]["Enums"]["doc_type"]
          embedding?: string | null
          metadata?: Json | null
          section_title?: string | null
          source_hash?: string
          source_path?: string
          token_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_email_suppression: {
        Row: {
          created_at: string | null
          email: string
          reason: string
          source: string | null
          suppression_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          reason: string
          source?: string | null
          suppression_id?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          reason?: string
          source?: string | null
          suppression_id?: string
        }
        Relationships: []
      }
      platform_email_template: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          is_active: boolean
          name: string
          placeholders: Json
          sections: Json
          status: string
          subject: string
          template_id: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          name: string
          placeholders?: Json
          sections?: Json
          status?: string
          subject?: string
          template_id?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          name?: string
          placeholders?: Json
          sections?: Json
          status?: string
          subject?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_external_secret: {
        Row: {
          created_at: string
          description: string | null
          environment: string
          expires_at: string | null
          id: string
          is_active: boolean
          last_error_at: string | null
          last_error_message: string | null
          last_rotated_at: string | null
          last_rotated_by: string | null
          last_verified_at: string | null
          provider: string
          rotation_reminder_days: number | null
          updated_at: string
          vault_secret_name: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          environment?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_error_at?: string | null
          last_error_message?: string | null
          last_rotated_at?: string | null
          last_rotated_by?: string | null
          last_verified_at?: string | null
          provider: string
          rotation_reminder_days?: number | null
          updated_at?: string
          vault_secret_name: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          environment?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_error_at?: string | null
          last_error_message?: string | null
          last_rotated_at?: string | null
          last_rotated_by?: string | null
          last_verified_at?: string | null
          provider?: string
          rotation_reminder_days?: number | null
          updated_at?: string
          vault_secret_name?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_external_secret_last_rotated_by_fkey"
            columns: ["last_rotated_by"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "platform_external_secret_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      platform_impersonation_log: {
        Row: {
          actions_taken: Json | null
          created_at: string
          ended_at: string | null
          id: string
          reason: string
          started_at: string
          super_admin_id: string
          target_user_id: string
          target_workspace_id: string
          updated_at: string
        }
        Insert: {
          actions_taken?: Json | null
          created_at?: string
          ended_at?: string | null
          id?: string
          reason: string
          started_at?: string
          super_admin_id: string
          target_user_id: string
          target_workspace_id: string
          updated_at?: string
        }
        Update: {
          actions_taken?: Json | null
          created_at?: string
          ended_at?: string | null
          id?: string
          reason?: string
          started_at?: string
          super_admin_id?: string
          target_user_id?: string
          target_workspace_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_impersonation_log_super_admin_id_fkey"
            columns: ["super_admin_id"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "platform_impersonation_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "platform_impersonation_log_target_workspace_id_fkey"
            columns: ["target_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      platform_metrics_daily: {
        Row: {
          active_workspaces_24h: number
          computed_at: string
          created_at: string
          date: string
          invite_to_session: number | null
          mrr_nok: number
          new_users_today: number
          new_workspaces_today: number
          sessions_created_24h: number
          signups_to_workspace: number | null
          subscriptions_active: number
          subscriptions_cancelled: number
          subscriptions_past_due: number
          subscriptions_paused: number
          subscriptions_trial: number
          tasks_completed_24h: number
          total_companies: number
          total_profiles: number
          total_users: number
          total_workspaces: number
          updated_at: string
          workspace_to_invite: number | null
        }
        Insert: {
          active_workspaces_24h?: number
          computed_at?: string
          created_at?: string
          date: string
          invite_to_session?: number | null
          mrr_nok?: number
          new_users_today?: number
          new_workspaces_today?: number
          sessions_created_24h?: number
          signups_to_workspace?: number | null
          subscriptions_active?: number
          subscriptions_cancelled?: number
          subscriptions_past_due?: number
          subscriptions_paused?: number
          subscriptions_trial?: number
          tasks_completed_24h?: number
          total_companies?: number
          total_profiles?: number
          total_users?: number
          total_workspaces?: number
          updated_at?: string
          workspace_to_invite?: number | null
        }
        Update: {
          active_workspaces_24h?: number
          computed_at?: string
          created_at?: string
          date?: string
          invite_to_session?: number | null
          mrr_nok?: number
          new_users_today?: number
          new_workspaces_today?: number
          sessions_created_24h?: number
          signups_to_workspace?: number | null
          subscriptions_active?: number
          subscriptions_cancelled?: number
          subscriptions_past_due?: number
          subscriptions_paused?: number
          subscriptions_trial?: number
          tasks_completed_24h?: number
          total_companies?: number
          total_profiles?: number
          total_users?: number
          total_workspaces?: number
          updated_at?: string
          workspace_to_invite?: number | null
        }
        Relationships: []
      }
      platform_webhook_event: {
        Row: {
          communication_id: string | null
          created_at: string
          email: string
          event_id: string
          event_type: string
          processed_at: string
          provider: string
          raw_payload: Json
          recipient_id: string | null
        }
        Insert: {
          communication_id?: string | null
          created_at?: string
          email: string
          event_id?: string
          event_type: string
          processed_at?: string
          provider?: string
          raw_payload: Json
          recipient_id?: string | null
        }
        Update: {
          communication_id?: string | null
          created_at?: string
          email?: string
          event_id?: string
          event_type?: string
          processed_at?: string
          provider?: string
          raw_payload?: Json
          recipient_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_webhook_event_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "platform_communication_log"
            referencedColumns: ["communication_id"]
          },
          {
            foreignKeyName: "platform_webhook_event_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "platform_communication_recipient"
            referencedColumns: ["recipient_id"]
          },
        ]
      }
      policy: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          enforcement_status: Database["public"]["Enums"]["enforcement_status"]
          is_active: boolean
          name: string
          policy_id: string
          policy_scope: Database["public"]["Enums"]["policy_scope"]
          policy_type: Database["public"]["Enums"]["policy_type"]
          priority: number | null
          rules_json: Json | null
          scope_ref_id: string | null
          season_id: string | null
          statement: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          enforcement_status?: Database["public"]["Enums"]["enforcement_status"]
          is_active?: boolean
          name: string
          policy_id?: string
          policy_scope: Database["public"]["Enums"]["policy_scope"]
          policy_type: Database["public"]["Enums"]["policy_type"]
          priority?: number | null
          rules_json?: Json | null
          scope_ref_id?: string | null
          season_id?: string | null
          statement: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          enforcement_status?: Database["public"]["Enums"]["enforcement_status"]
          is_active?: boolean
          name?: string
          policy_id?: string
          policy_scope?: Database["public"]["Enums"]["policy_scope"]
          policy_type?: Database["public"]["Enums"]["policy_type"]
          priority?: number | null
          rules_json?: Json | null
          scope_ref_id?: string | null
          season_id?: string | null
          statement?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_policy_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "fk_policy_season"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "season"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "fk_policy_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      position: {
        Row: {
          color: string | null
          created_at: string
          department_id: string
          description: string | null
          icon: string | null
          is_active: boolean
          minimum_role: Database["public"]["Enums"]["profile_role"] | null
          name: string
          position_id: string
          season_id: string | null
          skill_requirements: Json | null
          slug: string
          sort_order: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          department_id: string
          description?: string | null
          icon?: string | null
          is_active?: boolean
          minimum_role?: Database["public"]["Enums"]["profile_role"] | null
          name: string
          position_id?: string
          season_id?: string | null
          skill_requirements?: Json | null
          slug: string
          sort_order?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          department_id?: string
          description?: string | null
          icon?: string | null
          is_active?: boolean
          minimum_role?: Database["public"]["Enums"]["profile_role"] | null
          name?: string
          position_id?: string
          season_id?: string | null
          skill_requirements?: Json | null
          slug?: string
          sort_order?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_position_department"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "fk_position_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "position_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "season"
            referencedColumns: ["season_id"]
          },
        ]
      }
      pricing_terms: {
        Row: {
          billing_interval: string
          company_id: string
          contract_id: string | null
          created_at: string
          created_by: string | null
          currency: Database["public"]["Enums"]["currency"]
          discount_label: string | null
          discount_percent: number | null
          effective_from: string
          effective_until: string | null
          monthly_cost: number | null
          notes: string | null
          onboarding_cost: number | null
          onboarding_package: string | null
          price_per_employee: number
          pricing_terms_id: string
          trial_days: number | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          billing_interval?: string
          company_id: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency"]
          discount_label?: string | null
          discount_percent?: number | null
          effective_from: string
          effective_until?: string | null
          monthly_cost?: number | null
          notes?: string | null
          onboarding_cost?: number | null
          onboarding_package?: string | null
          price_per_employee: number
          pricing_terms_id?: string
          trial_days?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          billing_interval?: string
          company_id?: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency"]
          discount_label?: string | null
          discount_percent?: number | null
          effective_from?: string
          effective_until?: string | null
          monthly_cost?: number | null
          notes?: string | null
          onboarding_cost?: number | null
          onboarding_package?: string | null
          price_per_employee?: number
          pricing_terms_id?: string
          trial_days?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_terms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "pricing_terms_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "pricing_terms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pricing_terms_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      procedure: {
        Row: {
          created_at: string
          description: string | null
          is_active: boolean
          name: string
          procedure_id: string
          procedure_type: Database["public"]["Enums"]["procedure_type"]
          protocol_id: string
          skill_requirements: Json | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_active?: boolean
          name: string
          procedure_id?: string
          procedure_type?: Database["public"]["Enums"]["procedure_type"]
          protocol_id: string
          skill_requirements?: Json | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          is_active?: boolean
          name?: string
          procedure_id?: string
          procedure_type?: Database["public"]["Enums"]["procedure_type"]
          protocol_id?: string
          skill_requirements?: Json | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_procedure_protocol"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocol"
            referencedColumns: ["protocol_id"]
          },
        ]
      }
      procedure_step: {
        Row: {
          created_at: string
          description: string
          estimated_minutes: number | null
          is_required: boolean
          procedure_id: string
          step_id: string
          step_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          estimated_minutes?: number | null
          is_required?: boolean
          procedure_id: string
          step_id?: string
          step_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          estimated_minutes?: number | null
          is_required?: boolean
          procedure_id?: string
          step_id?: string
          step_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_procedure_step_procedure"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedure"
            referencedColumns: ["procedure_id"]
          },
        ]
      }
      profile: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          avatar_url: string | null
          bank_account: string | null
          city: string | null
          company_id: string
          created_at: string
          department_id: string | null
          departments: string[] | null
          display_name: string
          employee_number: string | null
          is_active: boolean
          job_title: string | null
          joined_at: string
          language_override:
            | Database["public"]["Enums"]["preferred_language"]
            | null
          location_id: string | null
          locations: string[] | null
          notification_pref: Json | null
          personal_number: string | null
          postal_code: string | null
          profile_code: string
          profile_id: string
          role: Database["public"]["Enums"]["profile_role"]
          status: Database["public"]["Enums"]["profile_status"]
          trainee_completed: string | null
          trainee_started: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          avatar_url?: string | null
          bank_account?: string | null
          city?: string | null
          company_id: string
          created_at?: string
          department_id?: string | null
          departments?: string[] | null
          display_name: string
          employee_number?: string | null
          is_active?: boolean
          job_title?: string | null
          joined_at?: string
          language_override?:
            | Database["public"]["Enums"]["preferred_language"]
            | null
          location_id?: string | null
          locations?: string[] | null
          notification_pref?: Json | null
          personal_number?: string | null
          postal_code?: string | null
          profile_code: string
          profile_id?: string
          role?: Database["public"]["Enums"]["profile_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          trainee_completed?: string | null
          trainee_started?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          avatar_url?: string | null
          bank_account?: string | null
          city?: string | null
          company_id?: string
          created_at?: string
          department_id?: string | null
          departments?: string[] | null
          display_name?: string
          employee_number?: string | null
          is_active?: boolean
          job_title?: string | null
          joined_at?: string
          language_override?:
            | Database["public"]["Enums"]["preferred_language"]
            | null
          location_id?: string | null
          locations?: string[] | null
          notification_pref?: Json | null
          personal_number?: string | null
          postal_code?: string | null
          profile_code?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["profile_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          trainee_completed?: string | null
          trainee_started?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_profile_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fk_profile_department"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "fk_profile_location"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "fk_profile_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_profile_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      protocol: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          name: string
          owner_profile_id: string
          policy_id: string
          protocol_id: string
          status: Database["public"]["Enums"]["protocol_status"]
          updated_at: string
          version: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          name: string
          owner_profile_id: string
          policy_id: string
          protocol_id?: string
          status?: Database["public"]["Enums"]["protocol_status"]
          updated_at?: string
          version?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          name?: string
          owner_profile_id?: string
          policy_id?: string
          protocol_id?: string
          status?: Database["public"]["Enums"]["protocol_status"]
          updated_at?: string
          version?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_protocol_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "fk_protocol_owner"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "fk_protocol_policy"
            columns: ["policy_id"]
            isOneToOne: true
            referencedRelation: "policy"
            referencedColumns: ["policy_id"]
          },
          {
            foreignKeyName: "fk_protocol_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      protocol_assignment: {
        Row: {
          assigned_at: string
          assignment_id: string
          completed_at: string | null
          created_at: string
          profile_id: string
          protocol_id: string
          status: Database["public"]["Enums"]["protocol_assignment_status"]
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assignment_id?: string
          completed_at?: string | null
          created_at?: string
          profile_id: string
          protocol_id: string
          status?: Database["public"]["Enums"]["protocol_assignment_status"]
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assignment_id?: string
          completed_at?: string | null
          created_at?: string
          profile_id?: string
          protocol_id?: string
          status?: Database["public"]["Enums"]["protocol_assignment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_protocol_assignment_profile"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "fk_protocol_assignment_protocol"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocol"
            referencedColumns: ["protocol_id"]
          },
        ]
      }
      reserved_slug: {
        Row: {
          created_at: string
          reason: string
          slug: string
        }
        Insert: {
          created_at?: string
          reason?: string
          slug: string
        }
        Update: {
          created_at?: string
          reason?: string
          slug?: string
        }
        Relationships: []
      }
      routine: {
        Row: {
          assigned_to_ref: string
          assigned_to_type: Database["public"]["Enums"]["routine_assigned_to_type"]
          control_frequency: Database["public"]["Enums"]["control_frequency"]
          control_list_id: string | null
          control_nth: number | null
          created_at: string
          is_active: boolean
          name: string
          procedure_id: string
          protocol_id: string
          routine_id: string
          trigger_config: Json
          trigger_type: Database["public"]["Enums"]["trigger_type"]
          updated_at: string
        }
        Insert: {
          assigned_to_ref: string
          assigned_to_type: Database["public"]["Enums"]["routine_assigned_to_type"]
          control_frequency?: Database["public"]["Enums"]["control_frequency"]
          control_list_id?: string | null
          control_nth?: number | null
          created_at?: string
          is_active?: boolean
          name: string
          procedure_id: string
          protocol_id: string
          routine_id?: string
          trigger_config: Json
          trigger_type: Database["public"]["Enums"]["trigger_type"]
          updated_at?: string
        }
        Update: {
          assigned_to_ref?: string
          assigned_to_type?: Database["public"]["Enums"]["routine_assigned_to_type"]
          control_frequency?: Database["public"]["Enums"]["control_frequency"]
          control_list_id?: string | null
          control_nth?: number | null
          created_at?: string
          is_active?: boolean
          name?: string
          procedure_id?: string
          protocol_id?: string
          routine_id?: string
          trigger_config?: Json
          trigger_type?: Database["public"]["Enums"]["trigger_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_routine_control_list"
            columns: ["control_list_id"]
            isOneToOne: false
            referencedRelation: "control_list"
            referencedColumns: ["control_list_id"]
          },
          {
            foreignKeyName: "fk_routine_procedure"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedure"
            referencedColumns: ["procedure_id"]
          },
          {
            foreignKeyName: "fk_routine_protocol"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocol"
            referencedColumns: ["protocol_id"]
          },
        ]
      }
      runbook: {
        Row: {
          control_list_id: string
          created_at: string
          description: string
          escalation_chain: Json
          is_active: boolean
          name: string
          protocol_id: string
          runbook_id: string
          trigger_conditions: Json
          trigger_event: string
          updated_at: string
        }
        Insert: {
          control_list_id: string
          created_at?: string
          description: string
          escalation_chain: Json
          is_active?: boolean
          name: string
          protocol_id: string
          runbook_id?: string
          trigger_conditions: Json
          trigger_event: string
          updated_at?: string
        }
        Update: {
          control_list_id?: string
          created_at?: string
          description?: string
          escalation_chain?: Json
          is_active?: boolean
          name?: string
          protocol_id?: string
          runbook_id?: string
          trigger_conditions?: Json
          trigger_event?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_runbook_control_list"
            columns: ["control_list_id"]
            isOneToOne: false
            referencedRelation: "control_list"
            referencedColumns: ["control_list_id"]
          },
          {
            foreignKeyName: "fk_runbook_protocol"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocol"
            referencedColumns: ["protocol_id"]
          },
        ]
      }
      runbook_step: {
        Row: {
          created_at: string
          description: string
          estimated_minutes: number | null
          is_required: boolean
          runbook_id: string
          step_id: string
          step_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          estimated_minutes?: number | null
          is_required?: boolean
          runbook_id: string
          step_id?: string
          step_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          estimated_minutes?: number | null
          is_required?: boolean
          runbook_id?: string
          step_id?: string
          step_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_runbook_step_runbook"
            columns: ["runbook_id"]
            isOneToOne: false
            referencedRelation: "runbook"
            referencedColumns: ["runbook_id"]
          },
        ]
      }
      schedule_absence: {
        Row: {
          absence_type: string
          created_at: string
          employee_id: string
          end_date: string
          is_full_day: boolean
          reason: string | null
          request_type: string | null
          schedule_absence_id: string
          shift_date: string
          start_date: string
          status: Database["public"]["Enums"]["absence_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          absence_type: string
          created_at?: string
          employee_id: string
          end_date: string
          is_full_day?: boolean
          reason?: string | null
          request_type?: string | null
          schedule_absence_id?: string
          shift_date: string
          start_date: string
          status?: Database["public"]["Enums"]["absence_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          absence_type?: string
          created_at?: string
          employee_id?: string
          end_date?: string
          is_full_day?: boolean
          reason?: string | null
          request_type?: string | null
          schedule_absence_id?: string
          shift_date?: string
          start_date?: string
          status?: Database["public"]["Enums"]["absence_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_absence_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "schedule_absence_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      schedule_audit_log: {
        Row: {
          audit_log_id: string
          changed_fields: string[] | null
          created_at: string
          new_data: Json | null
          old_data: Json | null
          operation: Database["public"]["Enums"]["audit_operation"]
          row_id: string
          table_name: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          audit_log_id?: string
          changed_fields?: string[] | null
          created_at?: string
          new_data?: Json | null
          old_data?: Json | null
          operation: Database["public"]["Enums"]["audit_operation"]
          row_id: string
          table_name: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          audit_log_id?: string
          changed_fields?: string[] | null
          created_at?: string
          new_data?: Json | null
          old_data?: Json | null
          operation?: Database["public"]["Enums"]["audit_operation"]
          row_id?: string
          table_name?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_audit_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      schedule_day_booking: {
        Row: {
          booking_time: string
          contact_person: string | null
          created_at: string
          guest_count: number
          is_vip: boolean
          location: string | null
          menu: string | null
          notes: string | null
          schedule_day_booking_id: string
          shift_date: string
          status: Database["public"]["Enums"]["booking_status"]
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          booking_time: string
          contact_person?: string | null
          created_at?: string
          guest_count?: number
          is_vip?: boolean
          location?: string | null
          menu?: string | null
          notes?: string | null
          schedule_day_booking_id?: string
          shift_date: string
          status?: Database["public"]["Enums"]["booking_status"]
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          booking_time?: string
          contact_person?: string | null
          created_at?: string
          guest_count?: number
          is_vip?: boolean
          location?: string | null
          menu?: string | null
          notes?: string | null
          schedule_day_booking_id?: string
          shift_date?: string
          status?: Database["public"]["Enums"]["booking_status"]
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_day_booking_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      schedule_day_info: {
        Row: {
          category: Database["public"]["Enums"]["day_info_category"]
          content: string | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          scope_id: string | null
          scope_type: Database["public"]["Enums"]["day_info_scope"]
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["day_info_category"]
          content?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          scope_id?: string | null
          scope_type?: Database["public"]["Enums"]["day_info_scope"]
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["day_info_category"]
          content?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          scope_id?: string | null
          scope_type?: Database["public"]["Enums"]["day_info_scope"]
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_day_info_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "schedule_day_info_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      schedule_day_message: {
        Row: {
          audience: string
          author_id: string
          content: string
          created_at: string
          is_alert: boolean
          schedule_day_message_id: string
          shift_date: string
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["message_visibility"]
          workspace_id: string
        }
        Insert: {
          audience?: string
          author_id: string
          content: string
          created_at?: string
          is_alert?: boolean
          schedule_day_message_id?: string
          shift_date: string
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["message_visibility"]
          workspace_id: string
        }
        Update: {
          audience?: string
          author_id?: string
          content?: string
          created_at?: string
          is_alert?: boolean
          schedule_day_message_id?: string
          shift_date?: string
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["message_visibility"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_day_message_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "schedule_day_message_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      schedule_day_task: {
        Row: {
          assigned_to: string | null
          category: string
          completed_at: string | null
          created_at: string
          highlight: boolean
          label: string
          schedule_day_task_id: string
          shift_date: string
          task_status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          completed_at?: string | null
          created_at?: string
          highlight?: boolean
          label: string
          schedule_day_task_id?: string
          shift_date: string
          task_status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          completed_at?: string | null
          created_at?: string
          highlight?: boolean
          label?: string
          schedule_day_task_id?: string
          shift_date?: string
          task_status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_day_task_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "schedule_day_task_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      schedule_open_shift: {
        Row: {
          created_at: string
          day_category: Database["public"]["Enums"]["day_category"] | null
          department: string | null
          end_time: string
          role: string | null
          schedule_open_shift_id: string
          start_time: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          day_category?: Database["public"]["Enums"]["day_category"] | null
          department?: string | null
          end_time: string
          role?: string | null
          schedule_open_shift_id?: string
          start_time: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          day_category?: Database["public"]["Enums"]["day_category"] | null
          department?: string | null
          end_time?: string
          role?: string | null
          schedule_open_shift_id?: string
          start_time?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_open_shift_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      schedule_shift: {
        Row: {
          breaks: number
          created_at: string
          day_category: Database["public"]["Enums"]["day_category"]
          employee_id: string | null
          end_time: string
          indicator: string
          is_published: boolean
          notes: string | null
          position_id: string | null
          role: string
          schedule_shift_id: string
          shift_date: string
          start_time: string
          status: Database["public"]["Enums"]["shift_status"]
          team_id: string | null
          updated_at: string
          work_hours: number
          workspace_id: string
          zone: string | null
        }
        Insert: {
          breaks?: number
          created_at?: string
          day_category: Database["public"]["Enums"]["day_category"]
          employee_id?: string | null
          end_time: string
          indicator?: string
          is_published?: boolean
          notes?: string | null
          position_id?: string | null
          role: string
          schedule_shift_id?: string
          shift_date: string
          start_time: string
          status?: Database["public"]["Enums"]["shift_status"]
          team_id?: string | null
          updated_at?: string
          work_hours?: number
          workspace_id: string
          zone?: string | null
        }
        Update: {
          breaks?: number
          created_at?: string
          day_category?: Database["public"]["Enums"]["day_category"]
          employee_id?: string | null
          end_time?: string
          indicator?: string
          is_published?: boolean
          notes?: string | null
          position_id?: string | null
          role?: string
          schedule_shift_id?: string
          shift_date?: string
          start_time?: string
          status?: Database["public"]["Enums"]["shift_status"]
          team_id?: string | null
          updated_at?: string
          work_hours?: number
          workspace_id?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_shift_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "schedule_shift_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "position"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "schedule_shift_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "schedule_shift_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      schedule_template: {
        Row: {
          created_at: string
          created_by: string
          department: string
          include_assignments: boolean
          name: string
          schedule_template_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          department: string
          include_assignments?: boolean
          name: string
          schedule_template_id?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          department?: string
          include_assignments?: boolean
          name?: string
          schedule_template_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_template_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "schedule_template_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      schedule_template_shift: {
        Row: {
          breaks: number
          created_at: string
          day_category: Database["public"]["Enums"]["day_category"]
          employee_id: string | null
          end_time: string
          indicator: string
          notes: string | null
          role: string
          schedule_template_shift_id: string
          start_time: string
          template_id: string
          updated_at: string
          work_hours: number
          zone: string | null
        }
        Insert: {
          breaks?: number
          created_at?: string
          day_category: Database["public"]["Enums"]["day_category"]
          employee_id?: string | null
          end_time: string
          indicator?: string
          notes?: string | null
          role: string
          schedule_template_shift_id?: string
          start_time: string
          template_id: string
          updated_at?: string
          work_hours?: number
          zone?: string | null
        }
        Update: {
          breaks?: number
          created_at?: string
          day_category?: Database["public"]["Enums"]["day_category"]
          employee_id?: string | null
          end_time?: string
          indicator?: string
          notes?: string | null
          role?: string
          schedule_template_shift_id?: string
          start_time?: string
          template_id?: string
          updated_at?: string
          work_hours?: number
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_template_shift_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "schedule_template_shift_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "schedule_template"
            referencedColumns: ["schedule_template_id"]
          },
        ]
      }
      season: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          icon: string | null
          is_default: boolean
          name: string
          parent_season_id: string | null
          season_id: string
          season_type: Database["public"]["Enums"]["season_type"]
          slug: string
          start_date: string | null
          status: Database["public"]["Enums"]["season_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          icon?: string | null
          is_default?: boolean
          name: string
          parent_season_id?: string | null
          season_id?: string
          season_type?: Database["public"]["Enums"]["season_type"]
          slug: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["season_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          icon?: string | null
          is_default?: boolean
          name?: string
          parent_season_id?: string | null
          season_id?: string
          season_type?: Database["public"]["Enums"]["season_type"]
          slug?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["season_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_season_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "fk_season_parent"
            columns: ["parent_season_id"]
            isOneToOne: false
            referencedRelation: "season"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "fk_season_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      season_budget: {
        Row: {
          avg_hourly_wage: number | null
          base_price_per_guest: number | null
          created_at: string
          created_by: string | null
          season_budget_id: string
          season_id: string
          season_price_factor: number
          status: Database["public"]["Enums"]["budget_status"]
          target_labor_percentage: number
          total_target_revenue: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          avg_hourly_wage?: number | null
          base_price_per_guest?: number | null
          created_at?: string
          created_by?: string | null
          season_budget_id?: string
          season_id: string
          season_price_factor?: number
          status?: Database["public"]["Enums"]["budget_status"]
          target_labor_percentage?: number
          total_target_revenue?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          avg_hourly_wage?: number | null
          base_price_per_guest?: number | null
          created_at?: string
          created_by?: string | null
          season_budget_id?: string
          season_id?: string
          season_price_factor?: number
          status?: Database["public"]["Enums"]["budget_status"]
          target_labor_percentage?: number
          total_target_revenue?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_budget_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "season_budget_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: true
            referencedRelation: "season"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "season_budget_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      settlement_image: {
        Row: {
          image_id: string
          ocr_confidence: number | null
          ocr_parsed: Json | null
          ocr_processed_at: string | null
          ocr_raw_text: string | null
          reconciliation_id: string
          source_type: Database["public"]["Enums"]["settlement_source_type"]
          storage_path: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string
          workspace_id: string
        }
        Insert: {
          image_id?: string
          ocr_confidence?: number | null
          ocr_parsed?: Json | null
          ocr_processed_at?: string | null
          ocr_raw_text?: string | null
          reconciliation_id: string
          source_type: Database["public"]["Enums"]["settlement_source_type"]
          storage_path: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by: string
          workspace_id: string
        }
        Update: {
          image_id?: string
          ocr_confidence?: number | null
          ocr_parsed?: Json | null
          ocr_processed_at?: string | null
          ocr_raw_text?: string | null
          reconciliation_id?: string
          source_type?: Database["public"]["Enums"]["settlement_source_type"]
          storage_path?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_image_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "daily_reconciliation"
            referencedColumns: ["reconciliation_id"]
          },
          {
            foreignKeyName: "settlement_image_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "settlement_image_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      settlement_validation: {
        Row: {
          created_at: string
          deviation_id: string | null
          difference: number
          difference_percent: number
          pos_total: number
          reconciliation_id: string
          terminal_total: number
          updated_at: string
          validation_id: string
          within_threshold: boolean
          workspace_id: string
        }
        Insert: {
          created_at?: string
          deviation_id?: string | null
          difference: number
          difference_percent: number
          pos_total: number
          reconciliation_id: string
          terminal_total: number
          updated_at?: string
          validation_id?: string
          within_threshold: boolean
          workspace_id: string
        }
        Update: {
          created_at?: string
          deviation_id?: string | null
          difference?: number
          difference_percent?: number
          pos_total?: number
          reconciliation_id?: string
          terminal_total?: number
          updated_at?: string
          validation_id?: string
          within_threshold?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_validation_deviation"
            columns: ["deviation_id"]
            isOneToOne: false
            referencedRelation: "deviation"
            referencedColumns: ["deviation_id"]
          },
          {
            foreignKeyName: "settlement_validation_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "daily_reconciliation"
            referencedColumns: ["reconciliation_id"]
          },
          {
            foreignKeyName: "settlement_validation_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      shift_approval: {
        Row: {
          approval_id: string
          approved_at: string | null
          approved_by: string | null
          approved_hours: number | null
          calculated_hours: number | null
          created_at: string
          edit_justification: string | null
          handoff_completed: boolean
          handoff_requested: boolean
          planned_hours: number
          punch_in: string | null
          punch_out: string | null
          reconciliation_id: string
          shift_id: string
          status: Database["public"]["Enums"]["shift_approval_status"]
          system_deviations: Json | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          approval_id?: string
          approved_at?: string | null
          approved_by?: string | null
          approved_hours?: number | null
          calculated_hours?: number | null
          created_at?: string
          edit_justification?: string | null
          handoff_completed?: boolean
          handoff_requested?: boolean
          planned_hours: number
          punch_in?: string | null
          punch_out?: string | null
          reconciliation_id: string
          shift_id: string
          status?: Database["public"]["Enums"]["shift_approval_status"]
          system_deviations?: Json | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          approval_id?: string
          approved_at?: string | null
          approved_by?: string | null
          approved_hours?: number | null
          calculated_hours?: number | null
          created_at?: string
          edit_justification?: string | null
          handoff_completed?: boolean
          handoff_requested?: boolean
          planned_hours?: number
          punch_in?: string | null
          punch_out?: string | null
          reconciliation_id?: string
          shift_id?: string
          status?: Database["public"]["Enums"]["shift_approval_status"]
          system_deviations?: Json | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_approval_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "shift_approval_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "daily_reconciliation"
            referencedColumns: ["reconciliation_id"]
          },
          {
            foreignKeyName: "shift_approval_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "schedule_shift"
            referencedColumns: ["schedule_shift_id"]
          },
          {
            foreignKeyName: "shift_approval_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      team: {
        Row: {
          color: string | null
          created_at: string
          department_id: string | null
          description: string | null
          icon: string | null
          is_active: boolean
          leader_profile_id: string | null
          name: string
          season_id: string | null
          slug: string
          team_id: string
          team_type: Database["public"]["Enums"]["team_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          icon?: string | null
          is_active?: boolean
          leader_profile_id?: string | null
          name: string
          season_id?: string | null
          slug: string
          team_id?: string
          team_type?: Database["public"]["Enums"]["team_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          icon?: string | null
          is_active?: boolean
          leader_profile_id?: string | null
          name?: string
          season_id?: string | null
          slug?: string
          team_id?: string
          team_type?: Database["public"]["Enums"]["team_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_team_department"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "fk_team_leader"
            columns: ["leader_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "fk_team_season"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "season"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "fk_team_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      team_member: {
        Row: {
          created_at: string
          profile_id: string
          team_id: string
          team_member_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          team_id: string
          team_member_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          team_id?: string
          team_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_team_member_profile"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "fk_team_member_team"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["team_id"]
          },
        ]
      }
      user_identity: {
        Row: {
          auth_provider: Database["public"]["Enums"]["auth_provider"]
          auth_provider_id: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          first_name: string
          is_active: boolean
          is_godmode: boolean
          last_login_at: string | null
          last_name: string
          personal_email: string | null
          phone: string | null
          preferred_language: Database["public"]["Enums"]["preferred_language"]
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_provider?: Database["public"]["Enums"]["auth_provider"]
          auth_provider_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          first_name: string
          is_active?: boolean
          is_godmode?: boolean
          last_login_at?: string | null
          last_name: string
          personal_email?: string | null
          phone?: string | null
          preferred_language?: Database["public"]["Enums"]["preferred_language"]
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_provider?: Database["public"]["Enums"]["auth_provider"]
          auth_provider_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          first_name?: string
          is_active?: boolean
          is_godmode?: boolean
          last_login_at?: string | null
          last_name?: string
          personal_email?: string | null
          phone?: string | null
          preferred_language?: Database["public"]["Enums"]["preferred_language"]
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wizard_session: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          current_phase: Database["public"]["Enums"]["wizard_phase"]
          draft_journey: Json
          journey_id: string | null
          messages: Json
          status: Database["public"]["Enums"]["wizard_session_status"]
          updated_at: string
          wizard_session_id: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          current_phase?: Database["public"]["Enums"]["wizard_phase"]
          draft_journey?: Json
          journey_id?: string | null
          messages?: Json
          status?: Database["public"]["Enums"]["wizard_session_status"]
          updated_at?: string
          wizard_session_id?: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          current_phase?: Database["public"]["Enums"]["wizard_phase"]
          draft_journey?: Json
          journey_id?: string | null
          messages?: Json
          status?: Database["public"]["Enums"]["wizard_session_status"]
          updated_at?: string
          wizard_session_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wizard_session_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wizard_session_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "wizard_session_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      workspace: {
        Row: {
          active_contract_id: string | null
          active_modules: string[] | null
          address_line_1: string | null
          address_line_2: string | null
          brand_color: string | null
          city: string | null
          communication_tone: string | null
          company_id: string
          contract_status: string | null
          country: Database["public"]["Enums"]["country"]
          cover_photo_url: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          deactivated_at: string | null
          description: string | null
          email: string | null
          extended_description: string | null
          grace_period_ends: string | null
          is_active: boolean
          language: Database["public"]["Enums"]["preferred_language"]
          logo_url: string | null
          max_profiles: number | null
          name: string
          override_access: boolean | null
          override_expires: string | null
          override_note: string | null
          phone: string | null
          postal_code: string | null
          short_description: string | null
          slogan: string | null
          slug: string
          suspended_at: string | null
          timezone: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active_contract_id?: string | null
          active_modules?: string[] | null
          address_line_1?: string | null
          address_line_2?: string | null
          brand_color?: string | null
          city?: string | null
          communication_tone?: string | null
          company_id: string
          contract_status?: string | null
          country?: Database["public"]["Enums"]["country"]
          cover_photo_url?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          deactivated_at?: string | null
          description?: string | null
          email?: string | null
          extended_description?: string | null
          grace_period_ends?: string | null
          is_active?: boolean
          language?: Database["public"]["Enums"]["preferred_language"]
          logo_url?: string | null
          max_profiles?: number | null
          name: string
          override_access?: boolean | null
          override_expires?: string | null
          override_note?: string | null
          phone?: string | null
          postal_code?: string | null
          short_description?: string | null
          slogan?: string | null
          slug: string
          suspended_at?: string | null
          timezone?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          active_contract_id?: string | null
          active_modules?: string[] | null
          address_line_1?: string | null
          address_line_2?: string | null
          brand_color?: string | null
          city?: string | null
          communication_tone?: string | null
          company_id?: string
          contract_status?: string | null
          country?: Database["public"]["Enums"]["country"]
          cover_photo_url?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          deactivated_at?: string | null
          description?: string | null
          email?: string | null
          extended_description?: string | null
          grace_period_ends?: string | null
          is_active?: boolean
          language?: Database["public"]["Enums"]["preferred_language"]
          logo_url?: string | null
          max_profiles?: number | null
          name?: string
          override_access?: boolean | null
          override_expires?: string | null
          override_note?: string | null
          phone?: string | null
          postal_code?: string | null
          short_description?: string | null
          slogan?: string | null
          slug?: string
          suspended_at?: string | null
          timezone?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_workspace_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["company_id"]
          },
        ]
      }
      workspace_budget: {
        Row: {
          absence_threshold: number | null
          cost_of_sales_target: number | null
          created_at: string
          created_by: string | null
          currency: string
          department_id: string | null
          food_cost_target: number | null
          hour_slot: number | null
          id: string
          labor_cost_target: number | null
          labor_hours_target: number | null
          location_id: string | null
          notes: string | null
          overtime_limit_hours: number | null
          period_date: string
          period_type: Database["public"]["Enums"]["budget_period_type"]
          revenue_target: number | null
          time_to_job_target: number | null
          turnover_target: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          absence_threshold?: number | null
          cost_of_sales_target?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          department_id?: string | null
          food_cost_target?: number | null
          hour_slot?: number | null
          id?: string
          labor_cost_target?: number | null
          labor_hours_target?: number | null
          location_id?: string | null
          notes?: string | null
          overtime_limit_hours?: number | null
          period_date: string
          period_type: Database["public"]["Enums"]["budget_period_type"]
          revenue_target?: number | null
          time_to_job_target?: number | null
          turnover_target?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          absence_threshold?: number | null
          cost_of_sales_target?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          department_id?: string | null
          food_cost_target?: number | null
          hour_slot?: number | null
          id?: string
          labor_cost_target?: number | null
          labor_hours_target?: number | null
          location_id?: string | null
          notes?: string | null
          overtime_limit_hours?: number | null
          period_date?: string
          period_type?: Database["public"]["Enums"]["budget_period_type"]
          revenue_target?: number | null
          time_to_job_target?: number | null
          turnover_target?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_budget_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "workspace_budget_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "workspace_budget_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "workspace_budget_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      workspace_kpi_target: {
        Row: {
          benchmark_value: number | null
          created_at: string
          id: string
          metric: string
          target_value: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          benchmark_value?: number | null
          created_at?: string
          id?: string
          metric: string
          target_value: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          benchmark_value?: number | null
          created_at?: string
          id?: string
          metric?: string
          target_value?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_kpi_target_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      zone: {
        Row: {
          capacity: number | null
          color: string | null
          created_at: string
          description: string | null
          is_active: boolean
          location_id: string
          name: string
          season_id: string | null
          slug: string
          sort_order: number | null
          updated_at: string
          workspace_id: string
          zone_id: string
        }
        Insert: {
          capacity?: number | null
          color?: string | null
          created_at?: string
          description?: string | null
          is_active?: boolean
          location_id: string
          name: string
          season_id?: string | null
          slug: string
          sort_order?: number | null
          updated_at?: string
          workspace_id: string
          zone_id?: string
        }
        Update: {
          capacity?: number | null
          color?: string | null
          created_at?: string
          description?: string | null
          is_active?: boolean
          location_id?: string
          name?: string
          season_id?: string | null
          slug?: string
          sort_order?: number | null
          updated_at?: string
          workspace_id?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_zone_location"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "fk_zone_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "zone_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "season"
            referencedColumns: ["season_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_workspace_v3: {
        Args: { p_data: Json; p_user_id: string }
        Returns: string
      }
      anonymize_user: { Args: { target_user_id: string }; Returns: undefined }
      cleanup_expired_api_keys: { Args: never; Returns: number }
      compute_platform_metrics: { Args: never; Returns: undefined }
      count_dangling_company_members: { Args: never; Returns: number }
      count_empty_workspaces: { Args: never; Returns: number }
      create_workspace_transaction:
        | {
            Args: {
              p_company_name: string
              p_departments: Json
              p_locations: Json
              p_policies: Json
              p_user_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_company_name: string
              p_departments: Json
              p_locations: Json
              p_policies: Json
              p_raw_scraped_data?: Json
              p_user_id: string
            }
            Returns: string
          }
      delete_vault_secret: { Args: { secret_name: string }; Returns: boolean }
      generate_contract_number: { Args: never; Returns: string }
      get_api_workspace_id: { Args: never; Returns: string }
      get_secret: { Args: { secret_name: string }; Returns: string }
      get_workspace_ids_for_user: { Args: { uid: string }; Returns: string[] }
      increment_communication_counter: {
        Args: { p_communication_id: string; p_field: string }
        Returns: undefined
      }
      is_admin_in_workspace: {
        Args: { uid: string; wid: string }
        Returns: boolean
      }
      log_api_key_usage: {
        Args: { p_endpoint: string; p_key_id: string; p_status: number }
        Returns: undefined
      }
      match_platform_docs: {
        Args: {
          filter_doc_type?: Database["public"]["Enums"]["doc_type"]
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_id: string
          content: string
          doc_type: Database["public"]["Enums"]["doc_type"]
          metadata: Json
          section_title: string
          similarity: number
          source_path: string
          token_count: number
        }[]
      }
      rollback_audit_entry: { Args: { p_audit_log_id: string }; Returns: Json }
      rotate_api_key: {
        Args: {
          p_environment: string
          p_grace_period?: string
          p_key_type: Database["public"]["Enums"]["api_key_type"]
          p_new_key_hash: string
          p_new_key_prefix: string
          p_workspace_id: string
        }
        Returns: string
      }
      upsert_secret: {
        Args: { p_description?: string; p_name: string; p_secret: string }
        Returns: string
      }
    }
    Enums: {
      absence_status: "pending" | "approved" | "rejected"
      api_key_type: "workspace" | "service"
      api_key_version_status: "current" | "previous" | "revoked"
      asset_type: "equipment" | "safety" | "storage" | "station" | "other"
      audit_operation: "INSERT" | "UPDATE" | "DELETE"
      auth_provider: "supabase" | "google" | "microsoft"
      booking_status: "confirmed" | "pending" | "cancelled"
      budget_period_type: "monthly" | "weekly" | "daily" | "hourly"
      budget_status: "draft" | "active" | "locked"
      communication_channel: "email" | "sms" | "push" | "in_app"
      communication_status:
        | "pending"
        | "sent"
        | "delivered"
        | "failed"
        | "opened"
        | "clicked"
      company_member_role: "owner" | "admin" | "member"
      contract_status:
        | "draft"
        | "sent"
        | "viewed"
        | "signed"
        | "expired"
        | "terminated"
      control_frequency: "every_time" | "every_nth" | "never"
      control_list_assigned_to_type:
        | "team_leader"
        | "manager"
        | "admin"
        | "custom"
      country: "NO" | "SE" | "DK" | "FI"
      currency: "NOK" | "SEK" | "DKK" | "EUR"
      day_category:
        | "morning"
        | "midday"
        | "afternoon"
        | "evening"
        | "night"
        | "weekend"
      day_info_category: "note" | "event" | "alert" | "budget_note"
      day_info_scope: "workspace" | "department" | "team"
      department_session_status:
        | "upcoming"
        | "active"
        | "pending_signoff"
        | "closed"
        | "missed"
      deviation_domain:
        | "safety"
        | "customer"
        | "procedure"
        | "system"
        | "material"
      deviation_severity: "low" | "medium" | "high" | "critical"
      deviation_status: "open" | "acknowledged" | "resolved" | "escalated"
      doc_type:
        | "adr"
        | "module"
        | "architecture"
        | "cross_cutting"
        | "plan"
        | "research"
        | "roadmap"
        | "other"
      enforcement_status: "aspirational" | "enforced"
      industry: "restaurant" | "hotel" | "cafe" | "bar" | "catering" | "other"
      invite_status: "pending" | "accepted" | "expired" | "cancelled"
      invite_type: "email" | "sms" | "link"
      journey_actor:
        | "employee"
        | "trainee"
        | "manager"
        | "admin"
        | "owner"
        | "all"
      journey_event_type:
        | "status_change"
        | "test_run"
        | "output_generated"
        | "edit"
        | "comment"
      journey_module:
        | "core"
        | "onboarding"
        | "org"
        | "scheduling"
        | "operations"
        | "haccp"
        | "training"
        | "absence"
        | "payroll"
        | "communication"
        | "reports"
        | "settings"
        | "ai"
        | "season"
        | "governance"
        | "contracts"
        | "certifications"
        | "meta"
      journey_platform: "mobile" | "desktop" | "both"
      journey_priority: "P0" | "P1" | "P2" | "P3"
      journey_status:
        | "idea"
        | "wizard"
        | "defined"
        | "ready_impl"
        | "building"
        | "review"
        | "ready_test"
        | "testing"
        | "ready_validation"
        | "implemented"
        | "active"
        | "inactive"
        | "broken"
      journey_test_result: "pass" | "fail" | "skip" | "running"
      journey_test_type: "automated" | "manual"
      landing_block_type:
        | "hero"
        | "features_grid"
        | "features_list"
        | "features_icons"
        | "cta_section"
        | "stats"
        | "testimonial"
        | "case_study"
        | "voice_widget"
        | "workspace_analyzer"
        | "text_section"
        | "image_section"
        | "pricing_preview"
        | "faq"
        | "logo_strip"
      landing_variant_status: "draft" | "published" | "archived"
      location_type:
        | "main"
        | "outdoor"
        | "kitchen"
        | "event"
        | "storage"
        | "other"
      message_visibility: "all_day" | "until_16" | "permanent"
      notification_channel: "push" | "sms" | "email" | "voice"
      notification_mode: "training" | "work" | "community"
      notification_status:
        | "pending"
        | "processing"
        | "delivered"
        | "failed"
        | "suppressed"
      policy_scope: "workspace" | "department" | "team" | "location"
      policy_type:
        | "operational"
        | "haccp"
        | "hr"
        | "safety"
        | "access"
        | "payroll"
        | "custom"
      preferred_language: "no" | "sv" | "en" | "da" | "fi"
      procedure_type:
        | "standard"
        | "onboarding"
        | "safety"
        | "maintenance"
        | "custom"
      profile_role: "employee" | "manager" | "admin" | "owner"
      profile_status: "trainee" | "active" | "inactive" | "offboarding"
      protocol_assignment_status: "pending" | "completed" | "expired"
      protocol_status: "draft" | "active" | "deprecated"
      reconciliation_status:
        | "open"
        | "submitted"
        | "awaiting_approval"
        | "approved"
        | "locked"
        | "unreconciled"
      revenue_source: "ocr" | "manual"
      routine_assigned_to_type: "team" | "role" | "profile"
      season_status: "draft" | "active" | "archived"
      season_type: "default" | "calendar" | "focus" | "cycle" | "custom"
      settlement_source_type:
        | "pos"
        | "terminal"
        | "z_report"
        | "cash_count"
        | "other"
      shift_approval_status: "pending" | "approved" | "edited" | "disputed"
      shift_status:
        | "created"
        | "assigned"
        | "published"
        | "active"
        | "completed"
        | "unpublished"
      team_type:
        | "operational"
        | "access"
        | "cross_department"
        | "seasonal"
        | "custom"
      trigger_type: "scheduled" | "event"
      wizard_phase:
        | "discovery"
        | "classification"
        | "steps"
        | "testing"
        | "documentation"
        | "review"
      wizard_session_status: "active" | "completed" | "abandoned"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      absence_status: ["pending", "approved", "rejected"],
      api_key_type: ["workspace", "service"],
      api_key_version_status: ["current", "previous", "revoked"],
      asset_type: ["equipment", "safety", "storage", "station", "other"],
      audit_operation: ["INSERT", "UPDATE", "DELETE"],
      auth_provider: ["supabase", "google", "microsoft"],
      booking_status: ["confirmed", "pending", "cancelled"],
      budget_period_type: ["monthly", "weekly", "daily", "hourly"],
      budget_status: ["draft", "active", "locked"],
      communication_channel: ["email", "sms", "push", "in_app"],
      communication_status: [
        "pending",
        "sent",
        "delivered",
        "failed",
        "opened",
        "clicked",
      ],
      company_member_role: ["owner", "admin", "member"],
      contract_status: [
        "draft",
        "sent",
        "viewed",
        "signed",
        "expired",
        "terminated",
      ],
      control_frequency: ["every_time", "every_nth", "never"],
      control_list_assigned_to_type: [
        "team_leader",
        "manager",
        "admin",
        "custom",
      ],
      country: ["NO", "SE", "DK", "FI"],
      currency: ["NOK", "SEK", "DKK", "EUR"],
      day_category: [
        "morning",
        "midday",
        "afternoon",
        "evening",
        "night",
        "weekend",
      ],
      day_info_category: ["note", "event", "alert", "budget_note"],
      day_info_scope: ["workspace", "department", "team"],
      department_session_status: [
        "upcoming",
        "active",
        "pending_signoff",
        "closed",
        "missed",
      ],
      deviation_domain: [
        "safety",
        "customer",
        "procedure",
        "system",
        "material",
      ],
      deviation_severity: ["low", "medium", "high", "critical"],
      deviation_status: ["open", "acknowledged", "resolved", "escalated"],
      doc_type: [
        "adr",
        "module",
        "architecture",
        "cross_cutting",
        "plan",
        "research",
        "roadmap",
        "other",
      ],
      enforcement_status: ["aspirational", "enforced"],
      industry: ["restaurant", "hotel", "cafe", "bar", "catering", "other"],
      invite_status: ["pending", "accepted", "expired", "cancelled"],
      invite_type: ["email", "sms", "link"],
      journey_actor: [
        "employee",
        "trainee",
        "manager",
        "admin",
        "owner",
        "all",
      ],
      journey_event_type: [
        "status_change",
        "test_run",
        "output_generated",
        "edit",
        "comment",
      ],
      journey_module: [
        "core",
        "onboarding",
        "org",
        "scheduling",
        "operations",
        "haccp",
        "training",
        "absence",
        "payroll",
        "communication",
        "reports",
        "settings",
        "ai",
        "season",
        "governance",
        "contracts",
        "certifications",
        "meta",
      ],
      journey_platform: ["mobile", "desktop", "both"],
      journey_priority: ["P0", "P1", "P2", "P3"],
      journey_status: [
        "idea",
        "wizard",
        "defined",
        "ready_impl",
        "building",
        "review",
        "ready_test",
        "testing",
        "ready_validation",
        "implemented",
        "active",
        "inactive",
        "broken",
      ],
      journey_test_result: ["pass", "fail", "skip", "running"],
      journey_test_type: ["automated", "manual"],
      landing_block_type: [
        "hero",
        "features_grid",
        "features_list",
        "features_icons",
        "cta_section",
        "stats",
        "testimonial",
        "case_study",
        "voice_widget",
        "workspace_analyzer",
        "text_section",
        "image_section",
        "pricing_preview",
        "faq",
        "logo_strip",
      ],
      landing_variant_status: ["draft", "published", "archived"],
      location_type: [
        "main",
        "outdoor",
        "kitchen",
        "event",
        "storage",
        "other",
      ],
      message_visibility: ["all_day", "until_16", "permanent"],
      notification_channel: ["push", "sms", "email", "voice"],
      notification_mode: ["training", "work", "community"],
      notification_status: [
        "pending",
        "processing",
        "delivered",
        "failed",
        "suppressed",
      ],
      policy_scope: ["workspace", "department", "team", "location"],
      policy_type: [
        "operational",
        "haccp",
        "hr",
        "safety",
        "access",
        "payroll",
        "custom",
      ],
      preferred_language: ["no", "sv", "en", "da", "fi"],
      procedure_type: [
        "standard",
        "onboarding",
        "safety",
        "maintenance",
        "custom",
      ],
      profile_role: ["employee", "manager", "admin", "owner"],
      profile_status: ["trainee", "active", "inactive", "offboarding"],
      protocol_assignment_status: ["pending", "completed", "expired"],
      protocol_status: ["draft", "active", "deprecated"],
      reconciliation_status: [
        "open",
        "submitted",
        "awaiting_approval",
        "approved",
        "locked",
        "unreconciled",
      ],
      revenue_source: ["ocr", "manual"],
      routine_assigned_to_type: ["team", "role", "profile"],
      season_status: ["draft", "active", "archived"],
      season_type: ["default", "calendar", "focus", "cycle", "custom"],
      settlement_source_type: [
        "pos",
        "terminal",
        "z_report",
        "cash_count",
        "other",
      ],
      shift_approval_status: ["pending", "approved", "edited", "disputed"],
      shift_status: [
        "created",
        "assigned",
        "published",
        "active",
        "completed",
        "unpublished",
      ],
      team_type: [
        "operational",
        "access",
        "cross_department",
        "seasonal",
        "custom",
      ],
      trigger_type: ["scheduled", "event"],
      wizard_phase: [
        "discovery",
        "classification",
        "steps",
        "testing",
        "documentation",
        "review",
      ],
      wizard_session_status: ["active", "completed", "abandoned"],
    },
  },
} as const

