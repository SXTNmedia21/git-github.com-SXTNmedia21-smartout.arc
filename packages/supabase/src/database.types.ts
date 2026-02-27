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
      asset: {
        Row: {
          asset_id: string
          created_at: string
          description: string | null
          is_active: boolean
          location_id: string
          name: string
          requires_routine: boolean
          requires_training: boolean
          updated_at: string
          workspace_id: string
        }
        Insert: {
          asset_id?: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          location_id: string
          name: string
          requires_routine?: boolean
          requires_training?: boolean
          updated_at?: string
          workspace_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          location_id?: string
          name?: string
          requires_routine?: boolean
          requires_training?: boolean
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
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
      company: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          billing_email: string | null
          city: string | null
          company_id: string
          country: Database["public"]["Enums"]["country"]
          created_at: string
          default_currency: Database["public"]["Enums"]["currency"]
          default_language: Database["public"]["Enums"]["preferred_language"]
          email: string | null
          industry: Database["public"]["Enums"]["industry"]
          is_active: boolean
          legal_name: string | null
          logo_url: string | null
          name: string
          org_number: string
          phone: string | null
          postal_code: string | null
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
          country?: Database["public"]["Enums"]["country"]
          created_at?: string
          default_currency?: Database["public"]["Enums"]["currency"]
          default_language?: Database["public"]["Enums"]["preferred_language"]
          email?: string | null
          industry?: Database["public"]["Enums"]["industry"]
          is_active?: boolean
          legal_name?: string | null
          logo_url?: string | null
          name: string
          org_number: string
          phone?: string | null
          postal_code?: string | null
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
          country?: Database["public"]["Enums"]["country"]
          created_at?: string
          default_currency?: Database["public"]["Enums"]["currency"]
          default_language?: Database["public"]["Enums"]["preferred_language"]
          email?: string | null
          industry?: Database["public"]["Enums"]["industry"]
          is_active?: boolean
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          org_number?: string
          phone?: string | null
          postal_code?: string | null
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
          created_at: string
          department_id: string
          description: string | null
          is_active: boolean
          minimum_role: Database["public"]["Enums"]["profile_role"] | null
          name: string
          position_id: string
          skill_requirements: Json | null
          slug: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          description?: string | null
          is_active?: boolean
          minimum_role?: Database["public"]["Enums"]["profile_role"] | null
          name: string
          position_id?: string
          skill_requirements?: Json | null
          slug: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          description?: string | null
          is_active?: boolean
          minimum_role?: Database["public"]["Enums"]["profile_role"] | null
          name?: string
          position_id?: string
          skill_requirements?: Json | null
          slug?: string
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
          avatar_url: string | null
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
          avatar_url?: string | null
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
          avatar_url?: string | null
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
          active_modules: string[] | null
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          company_id: string
          country: Database["public"]["Enums"]["country"]
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          description: string | null
          email: string | null
          is_active: boolean
          language: Database["public"]["Enums"]["preferred_language"]
          logo_url: string | null
          max_profiles: number | null
          name: string
          phone: string | null
          postal_code: string | null
          slug: string
          timezone: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active_modules?: string[] | null
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          company_id: string
          country?: Database["public"]["Enums"]["country"]
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          description?: string | null
          email?: string | null
          is_active?: boolean
          language?: Database["public"]["Enums"]["preferred_language"]
          logo_url?: string | null
          max_profiles?: number | null
          name: string
          phone?: string | null
          postal_code?: string | null
          slug: string
          timezone?: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          active_modules?: string[] | null
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          company_id?: string
          country?: Database["public"]["Enums"]["country"]
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          description?: string | null
          email?: string | null
          is_active?: boolean
          language?: Database["public"]["Enums"]["preferred_language"]
          logo_url?: string | null
          max_profiles?: number | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          slug?: string
          timezone?: string
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
          created_at: string
          description: string | null
          is_active: boolean
          location_id: string
          name: string
          slug: string
          updated_at: string
          workspace_id: string
          zone_id: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          is_active?: boolean
          location_id: string
          name: string
          slug: string
          updated_at?: string
          workspace_id: string
          zone_id?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          is_active?: boolean
          location_id?: string
          name?: string
          slug?: string
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      anonymize_user: { Args: { target_user_id: string }; Returns: undefined }
    }
    Enums: {
      auth_provider: "supabase" | "google" | "microsoft"
      company_member_role: "owner" | "admin" | "member"
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
      location_type:
        | "main"
        | "outdoor"
        | "kitchen"
        | "event"
        | "storage"
        | "other"
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
      auth_provider: ["supabase", "google", "microsoft"],
      company_member_role: ["owner", "admin", "member"],
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
      location_type: [
        "main",
        "outdoor",
        "kitchen",
        "event",
        "storage",
        "other",
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

