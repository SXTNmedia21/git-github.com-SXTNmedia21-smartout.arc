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
      department: {
        Row: {
          color: string | null
          created_at: string
          department_id: string
          description: string | null
          icon: string | null
          is_active: boolean
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
          name?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_department_workspace"
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
      invitation: {
        Row: {
          company_id: string
          created_at: string
          department_ids: string[] | null
          email: string
          expires_at: string
          first_name: string | null
          invitation_id: string
          invited_by: string | null
          last_name: string | null
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
          email: string
          expires_at?: string
          first_name?: string | null
          invitation_id?: string
          invited_by?: string | null
          last_name?: string | null
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
          email?: string
          expires_at?: string
          first_name?: string | null
          invitation_id?: string
          invited_by?: string | null
          last_name?: string | null
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
          communication_id: string
          created_at: string | null
          failed_count: number
          idempotency_key: string | null
          message_body: string
          provider: string | null
          provider_batch_id: string | null
          recipient_count: number
          sent_count: number
          status: string
          subject: string
          super_admin_id: string
          template: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          audience_filter?: Json | null
          classification?: string
          communication_id?: string
          created_at?: string | null
          failed_count?: number
          idempotency_key?: string | null
          message_body: string
          provider?: string | null
          provider_batch_id?: string | null
          recipient_count?: number
          sent_count?: number
          status?: string
          subject: string
          super_admin_id: string
          template: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          audience_filter?: Json | null
          classification?: string
          communication_id?: string
          created_at?: string | null
          failed_count?: number
          idempotency_key?: string | null
          message_body?: string
          provider?: string | null
          provider_batch_id?: string | null
          recipient_count?: number
          sent_count?: number
          status?: string
          subject?: string
          super_admin_id?: string
          template?: string
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
          communication_id: string
          created_at: string | null
          delivered_at: string | null
          email: string
          error_message: string | null
          name: string | null
          recipient_id: string
          sent_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          communication_id: string
          created_at?: string | null
          delivered_at?: string | null
          email: string
          error_message?: string | null
          name?: string | null
          recipient_id?: string
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          communication_id?: string
          created_at?: string | null
          delivered_at?: string | null
          email?: string
          error_message?: string | null
          name?: string | null
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
          is_super_admin: boolean
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
          is_super_admin?: boolean
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
          is_super_admin?: boolean
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
      generate_contract_number: { Args: never; Returns: string }
      get_workspace_ids_for_user: { Args: { uid: string }; Returns: string[] }
      is_admin_in_workspace: {
        Args: { uid: string; wid: string }
        Returns: boolean
      }
    }
    Enums: {
      asset_type: "equipment" | "safety" | "storage" | "station" | "other"
      auth_provider: "supabase" | "google" | "microsoft"
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
      enforcement_status: "aspirational" | "enforced"
      industry: "restaurant" | "hotel" | "cafe" | "bar" | "catering" | "other"
      invite_status: "pending" | "accepted" | "expired" | "cancelled"
      location_type:
        | "main"
        | "outdoor"
        | "kitchen"
        | "event"
        | "storage"
        | "other"
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
      routine_assigned_to_type: "team" | "role" | "profile"
      season_status: "draft" | "active" | "archived"
      season_type: "default" | "calendar" | "focus" | "cycle" | "custom"
      team_type:
        | "operational"
        | "access"
        | "cross_department"
        | "seasonal"
        | "custom"
      trigger_type: "scheduled" | "event"
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
      asset_type: ["equipment", "safety", "storage", "station", "other"],
      auth_provider: ["supabase", "google", "microsoft"],
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
      enforcement_status: ["aspirational", "enforced"],
      industry: ["restaurant", "hotel", "cafe", "bar", "catering", "other"],
      invite_status: ["pending", "accepted", "expired", "cancelled"],
      location_type: [
        "main",
        "outdoor",
        "kitchen",
        "event",
        "storage",
        "other",
      ],
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
      routine_assigned_to_type: ["team", "role", "profile"],
      season_status: ["draft", "active", "archived"],
      season_type: ["default", "calendar", "focus", "cycle", "custom"],
      team_type: [
        "operational",
        "access",
        "cross_department",
        "seasonal",
        "custom",
      ],
      trigger_type: ["scheduled", "event"],
    },
  },
} as const

