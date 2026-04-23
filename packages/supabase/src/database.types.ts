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
  payroll: {
    Tables: {
      absence_ledger: {
        Row: {
          absence_type_id: string
          created_at: string
          created_by: string | null
          days: number
          description: string | null
          effective_date: string
          entry_type: Database["payroll"]["Enums"]["absence_ledger_type"]
          id: string
          profile_id: string
          quota_id: string
          schedule_absence_id: string | null
          workspace_id: string
        }
        Insert: {
          absence_type_id: string
          created_at?: string
          created_by?: string | null
          days: number
          description?: string | null
          effective_date: string
          entry_type: Database["payroll"]["Enums"]["absence_ledger_type"]
          id?: string
          profile_id: string
          quota_id: string
          schedule_absence_id?: string | null
          workspace_id: string
        }
        Update: {
          absence_type_id?: string
          created_at?: string
          created_by?: string | null
          days?: number
          description?: string | null
          effective_date?: string
          entry_type?: Database["payroll"]["Enums"]["absence_ledger_type"]
          id?: string
          profile_id?: string
          quota_id?: string
          schedule_absence_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_absence_ledger_absence_type_id_fkey"
            columns: ["absence_type_id"]
            isOneToOne: false
            referencedRelation: "absence_type"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_absence_ledger_quota_id_fkey"
            columns: ["quota_id"]
            isOneToOne: false
            referencedRelation: "absence_quota"
            referencedColumns: ["id"]
          },
        ]
      }
      absence_quota: {
        Row: {
          absence_type_id: string
          adjusted_days: number
          carried_over_days: number
          created_at: string
          entitled_days: number
          expired_days: number
          id: string
          paid_out_days: number
          profile_id: string
          remaining_days: number | null
          updated_at: string
          used_days: number
          workspace_id: string
          year: number
        }
        Insert: {
          absence_type_id: string
          adjusted_days?: number
          carried_over_days?: number
          created_at?: string
          entitled_days: number
          expired_days?: number
          id?: string
          paid_out_days?: number
          profile_id: string
          remaining_days?: number | null
          updated_at?: string
          used_days?: number
          workspace_id: string
          year: number
        }
        Update: {
          absence_type_id?: string
          adjusted_days?: number
          carried_over_days?: number
          created_at?: string
          entitled_days?: number
          expired_days?: number
          id?: string
          paid_out_days?: number
          profile_id?: string
          remaining_days?: number | null
          updated_at?: string
          used_days?: number
          workspace_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_absence_quota_absence_type_id_fkey"
            columns: ["absence_type_id"]
            isOneToOne: false
            referencedRelation: "absence_type"
            referencedColumns: ["id"]
          },
        ]
      }
      absence_type: {
        Row: {
          affects_payroll: boolean
          category: Database["payroll"]["Enums"]["absence_category"]
          count_weekends: boolean
          created_at: string
          documentation_after_days: number | null
          employer_pays_days: number | null
          id: string
          is_active: boolean
          is_paid: boolean
          max_days_per_instance: number | null
          max_days_per_year: number | null
          max_instances_per_year: number | null
          name: string
          name_no: string | null
          requires_documentation: boolean
          salary_code: string | null
          sort_order: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          affects_payroll?: boolean
          category: Database["payroll"]["Enums"]["absence_category"]
          count_weekends?: boolean
          created_at?: string
          documentation_after_days?: number | null
          employer_pays_days?: number | null
          id?: string
          is_active?: boolean
          is_paid?: boolean
          max_days_per_instance?: number | null
          max_days_per_year?: number | null
          max_instances_per_year?: number | null
          name: string
          name_no?: string | null
          requires_documentation?: boolean
          salary_code?: string | null
          sort_order?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          affects_payroll?: boolean
          category?: Database["payroll"]["Enums"]["absence_category"]
          count_weekends?: boolean
          created_at?: string
          documentation_after_days?: number | null
          employer_pays_days?: number | null
          id?: string
          is_active?: boolean
          is_paid?: boolean
          max_days_per_instance?: number | null
          max_days_per_year?: number | null
          max_instances_per_year?: number | null
          name?: string
          name_no?: string | null
          requires_documentation?: boolean
          salary_code?: string | null
          sort_order?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      break_rule: {
        Row: {
          created_at: string
          department_ids: string[]
          duration_minutes: number
          employee_group_ids: string[]
          id: string
          is_active: boolean
          is_paid: boolean
          min_shift_duration_minutes: number
          name: string
          trigger_minutes: number | null
          trigger_time: string | null
          trigger_type: Database["payroll"]["Enums"]["break_trigger_type"]
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          weekdays: number[]
          workspace_id: string
        }
        Insert: {
          created_at?: string
          department_ids?: string[]
          duration_minutes: number
          employee_group_ids?: string[]
          id?: string
          is_active?: boolean
          is_paid?: boolean
          min_shift_duration_minutes?: number
          name: string
          trigger_minutes?: number | null
          trigger_time?: string | null
          trigger_type: Database["payroll"]["Enums"]["break_trigger_type"]
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          weekdays?: number[]
          workspace_id: string
        }
        Update: {
          created_at?: string
          department_ids?: string[]
          duration_minutes?: number
          employee_group_ids?: string[]
          id?: string
          is_active?: boolean
          is_paid?: boolean
          min_shift_duration_minutes?: number
          name?: string
          trigger_minutes?: number | null
          trigger_time?: string | null
          trigger_type?: Database["payroll"]["Enums"]["break_trigger_type"]
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          weekdays?: number[]
          workspace_id?: string
        }
        Relationships: []
      }
      calculation: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          base_pay: number
          base_rate: number
          break_minutes_paid: number
          break_minutes_unpaid: number
          calculated_at: string
          calculation_version: number
          employee_group_id: string | null
          gross_minutes: number
          id: string
          net_working_minutes: number
          period_id: string
          profile_id: string
          schedule_shift_id: string
          scheduled_end: string
          scheduled_start: string
          shift_date: string
          shift_type_id: string | null
          total_deductions: number
          total_pay: number
          total_supplements: number
          workspace_id: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          base_pay: number
          base_rate: number
          break_minutes_paid?: number
          break_minutes_unpaid?: number
          calculated_at?: string
          calculation_version?: number
          employee_group_id?: string | null
          gross_minutes: number
          id?: string
          net_working_minutes: number
          period_id: string
          profile_id: string
          schedule_shift_id: string
          scheduled_end: string
          scheduled_start: string
          shift_date: string
          shift_type_id?: string | null
          total_deductions?: number
          total_pay: number
          total_supplements?: number
          workspace_id: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          base_pay?: number
          base_rate?: number
          break_minutes_paid?: number
          break_minutes_unpaid?: number
          calculated_at?: string
          calculation_version?: number
          employee_group_id?: string | null
          gross_minutes?: number
          id?: string
          net_working_minutes?: number
          period_id?: string
          profile_id?: string
          schedule_shift_id?: string
          scheduled_end?: string
          scheduled_start?: string
          shift_date?: string
          shift_type_id?: string | null
          total_deductions?: number
          total_pay?: number
          total_supplements?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_calculation_employee_group_id_fkey"
            columns: ["employee_group_id"]
            isOneToOne: false
            referencedRelation: "employee_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_calculation_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "period"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_calculation_shift_type_id_fkey"
            columns: ["shift_type_id"]
            isOneToOne: false
            referencedRelation: "shift_type"
            referencedColumns: ["id"]
          },
        ]
      }
      calculation_line: {
        Row: {
          amount: number
          calculation_id: string
          created_at: string
          description: string
          hours: number | null
          id: string
          line_type: string
          metadata: Json | null
          rate: number | null
          salary_code: string
          supplement_rule_id: string | null
          workspace_id: string
        }
        Insert: {
          amount: number
          calculation_id: string
          created_at?: string
          description: string
          hours?: number | null
          id?: string
          line_type: string
          metadata?: Json | null
          rate?: number | null
          salary_code: string
          supplement_rule_id?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          calculation_id?: string
          created_at?: string
          description?: string
          hours?: number | null
          id?: string
          line_type?: string
          metadata?: Json | null
          rate?: number | null
          salary_code?: string
          supplement_rule_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_calculation_line_calculation_id_fkey"
            columns: ["calculation_id"]
            isOneToOne: false
            referencedRelation: "calculation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_calculation_line_supplement_rule_id_fkey"
            columns: ["supplement_rule_id"]
            isOneToOne: false
            referencedRelation: "supplement_rule"
            referencedColumns: ["id"]
          },
        ]
      }
      deviation: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          calculation_id: string | null
          check_id: string
          created_at: string
          details: Json | null
          id: string
          message: string
          period_id: string | null
          profile_id: string | null
          resolution: string | null
          schedule_shift_id: string | null
          severity: Database["payroll"]["Enums"]["deviation_severity"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          calculation_id?: string | null
          check_id: string
          created_at?: string
          details?: Json | null
          id?: string
          message: string
          period_id?: string | null
          profile_id?: string | null
          resolution?: string | null
          schedule_shift_id?: string | null
          severity: Database["payroll"]["Enums"]["deviation_severity"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          calculation_id?: string | null
          check_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          message?: string
          period_id?: string | null
          profile_id?: string | null
          resolution?: string | null
          schedule_shift_id?: string | null
          severity?: Database["payroll"]["Enums"]["deviation_severity"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_deviation_calculation_id_fkey"
            columns: ["calculation_id"]
            isOneToOne: false
            referencedRelation: "calculation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_deviation_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "period"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_group: {
        Row: {
          created_at: string
          default_hourly_rate: number
          department_id: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          salary_code: string | null
          sort_order: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          default_hourly_rate?: number
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          salary_code?: string | null
          sort_order?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          default_hourly_rate?: number
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          salary_code?: string | null
          sort_order?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      employee_group_member: {
        Row: {
          created_at: string
          employee_group_id: string
          hourly_rate: number | null
          id: string
          profile_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
          wage_type: Database["payroll"]["Enums"]["wage_type"]
          workspace_id: string
        }
        Insert: {
          created_at?: string
          employee_group_id: string
          hourly_rate?: number | null
          id?: string
          profile_id: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          wage_type?: Database["payroll"]["Enums"]["wage_type"]
          workspace_id: string
        }
        Update: {
          created_at?: string
          employee_group_id?: string
          hourly_rate?: number | null
          id?: string
          profile_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          wage_type?: Database["payroll"]["Enums"]["wage_type"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_employee_group_member_employee_group_id_fkey"
            columns: ["employee_group_id"]
            isOneToOne: false
            referencedRelation: "employee_group"
            referencedColumns: ["id"]
          },
        ]
      }
      export_event: {
        Row: {
          completed_at: string | null
          error_message: string | null
          export_format: string
          exported_by: string
          id: string
          metadata: Json | null
          period_id: string
          started_at: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          export_format: string
          exported_by: string
          id?: string
          metadata?: Json | null
          period_id: string
          started_at?: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          export_format?: string
          exported_by?: string
          id?: string
          metadata?: Json | null
          period_id?: string
          started_at?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_export_event_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "period"
            referencedColumns: ["id"]
          },
        ]
      }
      export_line: {
        Row: {
          amount: number
          calculation_line_id: string | null
          created_at: string
          error_message: string | null
          export_event_id: string
          external_code: string | null
          external_id: string | null
          hours: number | null
          id: string
          metadata: Json | null
          profile_id: string
          rate: number | null
          salary_code: string
          sync_status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          calculation_line_id?: string | null
          created_at?: string
          error_message?: string | null
          export_event_id: string
          external_code?: string | null
          external_id?: string | null
          hours?: number | null
          id?: string
          metadata?: Json | null
          profile_id: string
          rate?: number | null
          salary_code: string
          sync_status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          calculation_line_id?: string | null
          created_at?: string
          error_message?: string | null
          export_event_id?: string
          external_code?: string | null
          external_id?: string | null
          hours?: number | null
          id?: string
          metadata?: Json | null
          profile_id?: string
          rate?: number | null
          salary_code?: string
          sync_status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_export_line_calculation_line_id_fkey"
            columns: ["calculation_line_id"]
            isOneToOne: false
            referencedRelation: "calculation_line"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_export_line_export_event_id_fkey"
            columns: ["export_event_id"]
            isOneToOne: false
            referencedRelation: "export_event"
            referencedColumns: ["id"]
          },
        ]
      }
      holiday_calendar: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      holiday_entry: {
        Row: {
          calendar_id: string
          created_at: string
          holiday_date: string
          hours: number
          id: string
          is_full_day: boolean
          name: string
          name_no: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          calendar_id: string
          created_at?: string
          holiday_date: string
          hours?: number
          id?: string
          is_full_day?: boolean
          name: string
          name_no?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          calendar_id?: string
          created_at?: string
          holiday_date?: string
          hours?: number
          id?: string
          is_full_day?: boolean
          name?: string
          name_no?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_holiday_entry_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "holiday_calendar"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_supplement: {
        Row: {
          added_by: string
          amount: number
          created_at: string
          description: string
          employee_comment: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          salary_code: string | null
          schedule_shift_id: string
          status: Database["public"]["Enums"]["supplement_claim_status"] | null
          supplement_rule_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          added_by: string
          amount: number
          created_at?: string
          description: string
          employee_comment?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          salary_code?: string | null
          schedule_shift_id: string
          status?: Database["public"]["Enums"]["supplement_claim_status"] | null
          supplement_rule_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          added_by?: string
          amount?: number
          created_at?: string
          description?: string
          employee_comment?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          salary_code?: string | null
          schedule_shift_id?: string
          status?: Database["public"]["Enums"]["supplement_claim_status"] | null
          supplement_rule_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_manual_supplement_supplement_rule_id_fkey"
            columns: ["supplement_rule_id"]
            isOneToOne: false
            referencedRelation: "supplement_rule"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_rule: {
        Row: {
          amount: number
          created_at: string
          department_ids: string[]
          employee_group_ids: string[]
          id: string
          is_active: boolean
          meal_type: Database["payroll"]["Enums"]["meal_rule_type"]
          min_shift_hours: number
          name: string
          salary_code: string | null
          shift_type_ids: string[]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          department_ids?: string[]
          employee_group_ids?: string[]
          id?: string
          is_active?: boolean
          meal_type: Database["payroll"]["Enums"]["meal_rule_type"]
          min_shift_hours?: number
          name: string
          salary_code?: string | null
          shift_type_ids?: string[]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          department_ids?: string[]
          employee_group_ids?: string[]
          id?: string
          is_active?: boolean
          meal_type?: Database["payroll"]["Enums"]["meal_rule_type"]
          min_shift_hours?: number
          name?: string
          salary_code?: string | null
          shift_type_ids?: string[]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      period: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          end_date: string
          exported_at: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          start_date: string
          status: Database["payroll"]["Enums"]["period_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          end_date: string
          exported_at?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          start_date: string
          status?: Database["payroll"]["Enums"]["period_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          end_date?: string
          exported_at?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          start_date?: string
          status?: Database["payroll"]["Enums"]["period_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      salary_code: {
        Row: {
          a_melding_code: string | null
          category: Database["payroll"]["Enums"]["salary_code_category"]
          code: string
          created_at: string
          description: string | null
          external_code: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          a_melding_code?: string | null
          category: Database["payroll"]["Enums"]["salary_code_category"]
          code: string
          created_at?: string
          description?: string | null
          external_code?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          a_melding_code?: string | null
          category?: Database["payroll"]["Enums"]["salary_code_category"]
          code?: string
          created_at?: string
          description?: string | null
          external_code?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      shift_type: {
        Row: {
          affects_salaried: boolean
          allow_breaks: boolean
          allow_conflicting_shifts: boolean
          allow_meal_deduction: boolean
          allow_supplements: boolean
          color: string | null
          count_in_payroll: boolean
          created_at: string
          id: string
          include_in_schedule_print: boolean
          is_active: boolean
          name: string
          overwrite_on_template: boolean
          rate_adjustment_type: Database["payroll"]["Enums"]["rate_adjustment_type"]
          rate_adjustment_value: number | null
          salary_code: string | null
          sort_order: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          affects_salaried?: boolean
          allow_breaks?: boolean
          allow_conflicting_shifts?: boolean
          allow_meal_deduction?: boolean
          allow_supplements?: boolean
          color?: string | null
          count_in_payroll?: boolean
          created_at?: string
          id?: string
          include_in_schedule_print?: boolean
          is_active?: boolean
          name: string
          overwrite_on_template?: boolean
          rate_adjustment_type?: Database["payroll"]["Enums"]["rate_adjustment_type"]
          rate_adjustment_value?: number | null
          salary_code?: string | null
          sort_order?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          affects_salaried?: boolean
          allow_breaks?: boolean
          allow_conflicting_shifts?: boolean
          allow_meal_deduction?: boolean
          allow_supplements?: boolean
          color?: string | null
          count_in_payroll?: boolean
          created_at?: string
          id?: string
          include_in_schedule_print?: boolean
          is_active?: boolean
          name?: string
          overwrite_on_template?: boolean
          rate_adjustment_type?: Database["payroll"]["Enums"]["rate_adjustment_type"]
          rate_adjustment_value?: number | null
          salary_code?: string | null
          sort_order?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      sick_leave_period: {
        Row: {
          absence_type_id: string
          created_at: string
          custom_grade_pct: number | null
          doctor_note_date: string | null
          doctor_note_received: boolean
          egenmelding_instance: number | null
          employer_days: number
          employer_period_end: string | null
          end_date: string | null
          followup_4w_completed: boolean
          followup_4w_date: string | null
          followup_7w_completed: boolean
          followup_7w_date: string | null
          grade: Database["payroll"]["Enums"]["sick_leave_grade"]
          id: string
          is_egenmelding: boolean
          nav_refund_amount: number | null
          nav_takeover_date: string | null
          notes: string | null
          profile_id: string
          schedule_absence_id: string | null
          start_date: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          absence_type_id: string
          created_at?: string
          custom_grade_pct?: number | null
          doctor_note_date?: string | null
          doctor_note_received?: boolean
          egenmelding_instance?: number | null
          employer_days?: number
          employer_period_end?: string | null
          end_date?: string | null
          followup_4w_completed?: boolean
          followup_4w_date?: string | null
          followup_7w_completed?: boolean
          followup_7w_date?: string | null
          grade?: Database["payroll"]["Enums"]["sick_leave_grade"]
          id?: string
          is_egenmelding?: boolean
          nav_refund_amount?: number | null
          nav_takeover_date?: string | null
          notes?: string | null
          profile_id: string
          schedule_absence_id?: string | null
          start_date: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          absence_type_id?: string
          created_at?: string
          custom_grade_pct?: number | null
          doctor_note_date?: string | null
          doctor_note_received?: boolean
          egenmelding_instance?: number | null
          employer_days?: number
          employer_period_end?: string | null
          end_date?: string | null
          followup_4w_completed?: boolean
          followup_4w_date?: string | null
          followup_7w_completed?: boolean
          followup_7w_date?: string | null
          grade?: Database["payroll"]["Enums"]["sick_leave_grade"]
          id?: string
          is_egenmelding?: boolean
          nav_refund_amount?: number | null
          nav_takeover_date?: string | null
          notes?: string | null
          profile_id?: string
          schedule_absence_id?: string | null
          start_date?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_sick_leave_period_absence_type_id_fkey"
            columns: ["absence_type_id"]
            isOneToOne: false
            referencedRelation: "absence_type"
            referencedColumns: ["id"]
          },
        ]
      }
      supplement_rule: {
        Row: {
          affected_by_breaks: boolean
          affects_salaried: boolean
          after_minutes: number | null
          allow_rate_override: boolean
          consider_midnight: boolean
          contract_rule_id: string | null
          created_at: string
          daily_max_hours: number | null
          daily_threshold_hours: number | null
          default_rate: number | null
          employee_group_ids: string[]
          employee_types: string[]
          enforced_payment: boolean
          evaluation_field: string | null
          holiday_calendar_id: string | null
          id: string
          is_active: boolean
          name: string
          rate_type: Database["payroll"]["Enums"]["supplement_rate_type"]
          rate_value: number
          salary_code: string | null
          shift_type_ids: string[]
          sort_order: number
          start_type:
            | Database["payroll"]["Enums"]["supplement_start_type"]
            | null
          supplement_type: Database["payroll"]["Enums"]["supplement_type"]
          threshold_value: number | null
          time_window_end: string | null
          time_window_start: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          weekdays: number[]
          weekly_max_hours: number | null
          weekly_threshold_hours: number | null
          workspace_id: string
        }
        Insert: {
          affected_by_breaks?: boolean
          affects_salaried?: boolean
          after_minutes?: number | null
          allow_rate_override?: boolean
          consider_midnight?: boolean
          contract_rule_id?: string | null
          created_at?: string
          daily_max_hours?: number | null
          daily_threshold_hours?: number | null
          default_rate?: number | null
          employee_group_ids?: string[]
          employee_types?: string[]
          enforced_payment?: boolean
          evaluation_field?: string | null
          holiday_calendar_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          rate_type?: Database["payroll"]["Enums"]["supplement_rate_type"]
          rate_value?: number
          salary_code?: string | null
          shift_type_ids?: string[]
          sort_order?: number
          start_type?:
            | Database["payroll"]["Enums"]["supplement_start_type"]
            | null
          supplement_type: Database["payroll"]["Enums"]["supplement_type"]
          threshold_value?: number | null
          time_window_end?: string | null
          time_window_start?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          weekdays?: number[]
          weekly_max_hours?: number | null
          weekly_threshold_hours?: number | null
          workspace_id: string
        }
        Update: {
          affected_by_breaks?: boolean
          affects_salaried?: boolean
          after_minutes?: number | null
          allow_rate_override?: boolean
          consider_midnight?: boolean
          contract_rule_id?: string | null
          created_at?: string
          daily_max_hours?: number | null
          daily_threshold_hours?: number | null
          default_rate?: number | null
          employee_group_ids?: string[]
          employee_types?: string[]
          enforced_payment?: boolean
          evaluation_field?: string | null
          holiday_calendar_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          rate_type?: Database["payroll"]["Enums"]["supplement_rate_type"]
          rate_value?: number
          salary_code?: string | null
          shift_type_ids?: string[]
          sort_order?: number
          start_type?:
            | Database["payroll"]["Enums"]["supplement_start_type"]
            | null
          supplement_type?: Database["payroll"]["Enums"]["supplement_type"]
          threshold_value?: number | null
          time_window_end?: string | null
          time_window_start?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          weekdays?: number[]
          weekly_max_hours?: number | null
          weekly_threshold_hours?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_supplement_rule_holiday_calendar_id_fkey"
            columns: ["holiday_calendar_id"]
            isOneToOne: false
            referencedRelation: "holiday_calendar"
            referencedColumns: ["id"]
          },
        ]
      }
      timebank_entry: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          effective_date: string
          entry_type: Database["payroll"]["Enums"]["timebank_entry_type"]
          expiry_date: string | null
          hours: number
          id: string
          payroll_calculation_id: string | null
          profile_id: string
          schedule_absence_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          effective_date: string
          entry_type: Database["payroll"]["Enums"]["timebank_entry_type"]
          expiry_date?: string | null
          hours: number
          id?: string
          payroll_calculation_id?: string | null
          profile_id: string
          schedule_absence_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          effective_date?: string
          entry_type?: Database["payroll"]["Enums"]["timebank_entry_type"]
          expiry_date?: string | null
          hours?: number
          id?: string
          payroll_calculation_id?: string | null
          profile_id?: string
          schedule_absence_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_timebank_entry_payroll_calculation_id_fkey"
            columns: ["payroll_calculation_id"]
            isOneToOne: false
            referencedRelation: "calculation"
            referencedColumns: ["id"]
          },
        ]
      }
      working_time_rule: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          scope_id: string | null
          scope_type: string
          severity: Database["payroll"]["Enums"]["rule_severity"]
          threshold_value: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          scope_id?: string | null
          scope_type?: string
          severity?: Database["payroll"]["Enums"]["rule_severity"]
          threshold_value: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          scope_id?: string | null
          scope_type?: string
          severity?: Database["payroll"]["Enums"]["rule_severity"]
          threshold_value?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      workspace_settings: {
        Row: {
          created_at: string
          default_monthly_salary_code: string | null
          default_worked_hours_salary_code: string | null
          employer_social_security_pct: number
          id: string
          pension_pct: number
          period_start_day: number
          period_type: string
          shift_grouping: string
          updated_at: string
          vacation_pay_pct: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          default_monthly_salary_code?: string | null
          default_worked_hours_salary_code?: string | null
          employer_social_security_pct?: number
          id?: string
          pension_pct?: number
          period_start_day?: number
          period_type?: string
          shift_grouping?: string
          updated_at?: string
          vacation_pay_pct?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          default_monthly_salary_code?: string | null
          default_worked_hours_salary_code?: string | null
          employer_social_security_pct?: number
          id?: string
          pension_pct?: number
          period_start_day?: number
          period_type?: string
          shift_grouping?: string
          updated_at?: string
          vacation_pay_pct?: number
          workspace_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      absence_category:
        | "vacation"
        | "sick_self"
        | "sick_doctor"
        | "parental"
        | "care_of_child"
        | "military"
        | "training"
        | "welfare"
        | "toil"
        | "unpaid"
        | "other"
      absence_ledger_type:
        | "entitlement"
        | "carry_over"
        | "usage"
        | "adjustment"
        | "expiry"
        | "payout"
      break_trigger_type: "after_duration" | "time_of_day"
      custom_rate_type: "per_hour" | "per_shift"
      deviation_severity: "error" | "warning" | "info"
      meal_rule_type: "deduction" | "contribution"
      period_status: "open" | "locked" | "approved" | "exported"
      rate_adjustment_type: "none" | "replace" | "add" | "percentage"
      rule_severity: "block" | "warn"
      salary_code_category:
        | "worked_hours"
        | "supplement"
        | "overtime"
        | "absence"
        | "deduction"
        | "monthly_salary"
      sick_leave_grade:
        | "full"
        | "graded_75"
        | "graded_50"
        | "graded_25"
        | "graded_custom"
      supplement_rate_type: "fixed_per_hour" | "percentage" | "fixed_per_shift"
      supplement_start_type: "time_of_day" | "after_shift_start"
      supplement_type:
        | "normal"
        | "week_based"
        | "day_based"
        | "manual"
        | "holiday"
        | "contract_rule"
      timebank_entry_type:
        | "accrual"
        | "withdrawal"
        | "adjustment"
        | "expiry"
        | "carry_over"
        | "payout"
      wage_type: "hourly" | "per_shift" | "monthly"
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
      adjustment_factors: {
        Row: {
          adjustment_ratio: number
          alpha: number
          confidence: number
          created_at: string
          dimension: string
          factor_type: string
          id: string
          last_actual: number | null
          last_planned: number | null
          observation_count: number
          season_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          adjustment_ratio?: number
          alpha?: number
          confidence?: number
          created_at?: string
          dimension: string
          factor_type: string
          id?: string
          last_actual?: number | null
          last_planned?: number | null
          observation_count?: number
          season_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          adjustment_ratio?: number
          alpha?: number
          confidence?: number
          created_at?: string
          dimension?: string
          factor_type?: string
          id?: string
          last_actual?: number | null
          last_planned?: number | null
          observation_count?: number
          season_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adjustment_factors_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "season"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "adjustment_factors_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "adjustment_factors_workspace_id_fkey"
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
      agent_session_envelope: {
        Row: {
          created_at: string
          encrypted_payload: string
          id: string
          pii_class: string
          redact_after: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          encrypted_payload: string
          id?: string
          pii_class: string
          redact_after: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          encrypted_payload?: string
          id?: string
          pii_class?: string
          redact_after?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_session_envelope_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "agent_session_envelope_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      agent_session_recording: {
        Row: {
          attention_score: number | null
          content_envelope_id: string | null
          content_redacted: Json
          created_at: string
          engine_state_id: string | null
          flag_reason: string | null
          flagged_by_profile_id: string | null
          id: string
          is_flagged: boolean
          meta: Json
          phase: string
          profile_id: string | null
          session_id: string
          turn_index: number
          turn_kind: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attention_score?: number | null
          content_envelope_id?: string | null
          content_redacted: Json
          created_at?: string
          engine_state_id?: string | null
          flag_reason?: string | null
          flagged_by_profile_id?: string | null
          id?: string
          is_flagged?: boolean
          meta?: Json
          phase: string
          profile_id?: string | null
          session_id: string
          turn_index: number
          turn_kind: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attention_score?: number | null
          content_envelope_id?: string | null
          content_redacted?: Json
          created_at?: string
          engine_state_id?: string | null
          flag_reason?: string | null
          flagged_by_profile_id?: string | null
          id?: string
          is_flagged?: boolean
          meta?: Json
          phase?: string
          profile_id?: string | null
          session_id?: string
          turn_index?: number
          turn_kind?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_session_recording_engine_state_id_fkey"
            columns: ["engine_state_id"]
            isOneToOne: false
            referencedRelation: "engine_state"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_session_recording_flagged_by_profile_id_fkey"
            columns: ["flagged_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "agent_session_recording_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "agent_session_recording_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "agent_session_recording_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "fk_asr_envelope"
            columns: ["content_envelope_id"]
            isOneToOne: false
            referencedRelation: "agent_session_envelope"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_session_whisper: {
        Row: {
          admin_profile_id: string
          consumed_at: string | null
          content: string
          created_at: string
          id: string
          is_consumed: boolean
          session_id: string
          workspace_id: string
        }
        Insert: {
          admin_profile_id: string
          consumed_at?: string | null
          content: string
          created_at?: string
          id?: string
          is_consumed?: boolean
          session_id: string
          workspace_id: string
        }
        Update: {
          admin_profile_id?: string
          consumed_at?: string | null
          content?: string
          created_at?: string
          id?: string
          is_consumed?: boolean
          session_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_session_whisper_admin_profile_id_fkey"
            columns: ["admin_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "agent_session_whisper_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "agent_session_whisper_workspace_id_fkey"
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
          department_id: string | null
          description: string | null
          icon: string | null
          is_active: boolean
          location_id: string
          manufacturer: string | null
          model: string | null
          name: string
          purchase_cost: number | null
          purchase_date: string | null
          requires_routine: boolean
          requires_training: boolean
          season_id: string | null
          serial_number: string | null
          slug: string | null
          sort_order: number | null
          updated_at: string
          warranty_expires: string | null
          workspace_id: string
        }
        Insert: {
          asset_id?: string
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          department_id?: string | null
          description?: string | null
          icon?: string | null
          is_active?: boolean
          location_id: string
          manufacturer?: string | null
          model?: string | null
          name: string
          purchase_cost?: number | null
          purchase_date?: string | null
          requires_routine?: boolean
          requires_training?: boolean
          season_id?: string | null
          serial_number?: string | null
          slug?: string | null
          sort_order?: number | null
          updated_at?: string
          warranty_expires?: string | null
          workspace_id: string
        }
        Update: {
          asset_id?: string
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          department_id?: string | null
          description?: string | null
          icon?: string | null
          is_active?: boolean
          location_id?: string
          manufacturer?: string | null
          model?: string | null
          name?: string
          purchase_cost?: number | null
          purchase_date?: string | null
          requires_routine?: boolean
          requires_training?: boolean
          season_id?: string | null
          serial_number?: string | null
          slug?: string | null
          sort_order?: number | null
          updated_at?: string
          warranty_expires?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
      asset_downtime: {
        Row: {
          asset_id: string
          created_at: string
          downtime_id: string
          ended_at: string | null
          estimated_revenue_impact: number | null
          impact_description: string | null
          reason: string
          reported_by: string | null
          started_at: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          downtime_id?: string
          ended_at?: string | null
          estimated_revenue_impact?: number | null
          impact_description?: string | null
          reason: string
          reported_by?: string | null
          started_at: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          downtime_id?: string
          ended_at?: string | null
          estimated_revenue_impact?: number | null
          impact_description?: string | null
          reason?: string
          reported_by?: string | null
          started_at?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_downtime_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset"
            referencedColumns: ["asset_id"]
          },
          {
            foreignKeyName: "asset_downtime_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "asset_downtime_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "asset_downtime_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      asset_maintenance: {
        Row: {
          asset_id: string
          cost: number | null
          created_at: string
          description: string
          maintenance_id: string
          maintenance_type: string
          next_scheduled: string | null
          notes: string | null
          performed_at: string
          performed_by: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          asset_id: string
          cost?: number | null
          created_at?: string
          description: string
          maintenance_id?: string
          maintenance_type: string
          next_scheduled?: string | null
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          asset_id?: string
          cost?: number | null
          created_at?: string
          description?: string
          maintenance_id?: string
          maintenance_type?: string
          next_scheduled?: string | null
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_maintenance_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset"
            referencedColumns: ["asset_id"]
          },
          {
            foreignKeyName: "asset_maintenance_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "asset_maintenance_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      basis_drift_event: {
        Row: {
          detected_at: string
          drift_event_id: string
          drift_type: string
          invoice_id: string | null
          new_value: Json | null
          old_value: Json | null
          resolution: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          shift_id: string | null
          usage_snapshot_id: string
        }
        Insert: {
          detected_at?: string
          drift_event_id?: string
          drift_type: string
          invoice_id?: string | null
          new_value?: Json | null
          old_value?: Json | null
          resolution?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shift_id?: string | null
          usage_snapshot_id: string
        }
        Update: {
          detected_at?: string
          drift_event_id?: string
          drift_type?: string
          invoice_id?: string | null
          new_value?: Json | null
          old_value?: Json | null
          resolution?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shift_id?: string | null
          usage_snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "basis_drift_event_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "basis_drift_event_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "basis_drift_event_usage_snapshot_id_fkey"
            columns: ["usage_snapshot_id"]
            isOneToOne: false
            referencedRelation: "usage_snapshot"
            referencedColumns: ["usage_snapshot_id"]
          },
        ]
      }
      billing_activity_log: {
        Row: {
          actor_user_id: string | null
          changes: Json
          company_id: string
          created_at: string
          data: Json
          entity_id: string
          entity_type: string
          event: string
          id: number
          invoice_id: string | null
          source: string
        }
        Insert: {
          actor_user_id?: string | null
          changes?: Json
          company_id: string
          created_at?: string
          data?: Json
          entity_id: string
          entity_type: string
          event: string
          id?: number
          invoice_id?: string | null
          source?: string
        }
        Update: {
          actor_user_id?: string | null
          changes?: Json
          company_id?: string
          created_at?: string
          data?: Json
          entity_id?: string
          entity_type?: string
          event?: string
          id?: number
          invoice_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_activity_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "billing_activity_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "billing_activity_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "billing_activity_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice"
            referencedColumns: ["invoice_id"]
          },
        ]
      }
      billing_dispatch_rule: {
        Row: {
          action: Database["public"]["Enums"]["dispatch_rule_action"]
          channel: Database["public"]["Enums"]["billing_dispatch_channel"]
          company_id: string | null
          created_at: string
          created_by: string | null
          dispatch_rule_id: string
          is_enabled: boolean
          target: Json
          template_id: string | null
          trigger_event: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          action?: Database["public"]["Enums"]["dispatch_rule_action"]
          channel: Database["public"]["Enums"]["billing_dispatch_channel"]
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          dispatch_rule_id?: string
          is_enabled?: boolean
          target: Json
          template_id?: string | null
          trigger_event: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["dispatch_rule_action"]
          channel?: Database["public"]["Enums"]["billing_dispatch_channel"]
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          dispatch_rule_id?: string
          is_enabled?: boolean
          target?: Json
          template_id?: string | null
          trigger_event?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_dispatch_rule_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "billing_dispatch_rule_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "billing_dispatch_rule_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "billing_dispatch_rule_template_fk"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "billing_dispatch_template"
            referencedColumns: ["template_id"]
          },
          {
            foreignKeyName: "billing_dispatch_rule_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "billing_dispatch_rule_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      billing_dispatch_template: {
        Row: {
          body_template: string
          channel: Database["public"]["Enums"]["billing_dispatch_channel"]
          created_at: string
          locale: string
          name: string
          subject_template: string | null
          template_id: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          body_template: string
          channel: Database["public"]["Enums"]["billing_dispatch_channel"]
          created_at?: string
          locale?: string
          name: string
          subject_template?: string | null
          template_id?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          body_template?: string
          channel?: Database["public"]["Enums"]["billing_dispatch_channel"]
          created_at?: string
          locale?: string
          name?: string
          subject_template?: string | null
          template_id?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_dispatch_template_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "billing_dispatch_template_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      billing_integration: {
        Row: {
          config: Json
          created_at: string
          display_name: string
          integration_id: string
          integration_type: Database["public"]["Enums"]["billing_integration_type"]
          is_enabled: boolean
          is_placeholder: boolean
          last_sync_at: string | null
          last_sync_status: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          display_name: string
          integration_id?: string
          integration_type: Database["public"]["Enums"]["billing_integration_type"]
          is_enabled?: boolean
          is_placeholder?: boolean
          last_sync_at?: string | null
          last_sync_status?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          display_name?: string
          integration_id?: string
          integration_type?: Database["public"]["Enums"]["billing_integration_type"]
          is_enabled?: boolean
          is_placeholder?: boolean
          last_sync_at?: string | null
          last_sync_status?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_integration_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "billing_integration_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      billing_product: {
        Row: {
          created_at: string
          created_by: string | null
          currency: Database["public"]["Enums"]["currency"]
          default_unit_price: number
          default_vat_rate: number
          description: string | null
          is_active: boolean
          name: string
          product_id: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency"]
          default_unit_price: number
          default_vat_rate?: number
          description?: string | null
          is_active?: boolean
          name: string
          product_id?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency"]
          default_unit_price?: number
          default_vat_rate?: number
          description?: string | null
          is_active?: boolean
          name?: string
          product_id?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_product_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "billing_product_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "billing_product_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      call_log: {
        Row: {
          call_session_id: string
          channel_id: string
          created_at: string
          duration_seconds: number
          ended_at: string
          id: string
          livekit_room_name: string
          max_participants: number
          participant_summary: Json
          started_at: string
          total_participants: number
          workspace_id: string
        }
        Insert: {
          call_session_id: string
          channel_id: string
          created_at?: string
          duration_seconds: number
          ended_at: string
          id?: string
          livekit_room_name: string
          max_participants: number
          participant_summary?: Json
          started_at: string
          total_participants: number
          workspace_id: string
        }
        Update: {
          call_session_id?: string
          channel_id?: string
          created_at?: string
          duration_seconds?: number
          ended_at?: string
          id?: string
          livekit_room_name?: string
          max_participants?: number
          participant_summary?: Json
          started_at?: string
          total_participants?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_log_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "channel_call_session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_log_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "call_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      capability_default_registry: {
        Row: {
          capability: string
          created_at: string
          level: string
          min_role: string
          notes: string | null
          observer_escalation_hours: number
          requires_four_eyes: boolean
        }
        Insert: {
          capability: string
          created_at?: string
          level: string
          min_role?: string
          notes?: string | null
          observer_escalation_hours?: number
          requires_four_eyes?: boolean
        }
        Update: {
          capability?: string
          created_at?: string
          level?: string
          min_role?: string
          notes?: string | null
          observer_escalation_hours?: number
          requires_four_eyes?: boolean
        }
        Relationships: []
      }
      change_proposal: {
        Row: {
          affected_employee_count: number | null
          affected_shift_count: number | null
          applied_at: string | null
          approval_required: boolean
          approved_at: string | null
          approved_by: string | null
          change_proposal_id: string
          changes: Json
          conflict_count: number | null
          created_at: string
          created_by_plane: Database["public"]["Enums"]["cascade_initiator"]
          expires_at: string | null
          framework_trigger_id: string | null
          initiated_by: string
          input_state_hash: string | null
          policy_decision:
            | Database["public"]["Enums"]["evaluation_outcome"]
            | null
          policy_rule_ids: string[] | null
          preview: Json
          rejected_at: string | null
          rejection_reason: string | null
          risk_score: number | null
          status: Database["public"]["Enums"]["change_proposal_status"]
          trigger_entity_id: string | null
          trigger_entity_type: string
          trigger_type: Database["public"]["Enums"]["framework_trigger_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          affected_employee_count?: number | null
          affected_shift_count?: number | null
          applied_at?: string | null
          approval_required?: boolean
          approved_at?: string | null
          approved_by?: string | null
          change_proposal_id?: string
          changes?: Json
          conflict_count?: number | null
          created_at?: string
          created_by_plane?: Database["public"]["Enums"]["cascade_initiator"]
          expires_at?: string | null
          framework_trigger_id?: string | null
          initiated_by: string
          input_state_hash?: string | null
          policy_decision?:
            | Database["public"]["Enums"]["evaluation_outcome"]
            | null
          policy_rule_ids?: string[] | null
          preview?: Json
          rejected_at?: string | null
          rejection_reason?: string | null
          risk_score?: number | null
          status?: Database["public"]["Enums"]["change_proposal_status"]
          trigger_entity_id?: string | null
          trigger_entity_type: string
          trigger_type: Database["public"]["Enums"]["framework_trigger_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          affected_employee_count?: number | null
          affected_shift_count?: number | null
          applied_at?: string | null
          approval_required?: boolean
          approved_at?: string | null
          approved_by?: string | null
          change_proposal_id?: string
          changes?: Json
          conflict_count?: number | null
          created_at?: string
          created_by_plane?: Database["public"]["Enums"]["cascade_initiator"]
          expires_at?: string | null
          framework_trigger_id?: string | null
          initiated_by?: string
          input_state_hash?: string | null
          policy_decision?:
            | Database["public"]["Enums"]["evaluation_outcome"]
            | null
          policy_rule_ids?: string[] | null
          preview?: Json
          rejected_at?: string | null
          rejection_reason?: string | null
          risk_score?: number | null
          status?: Database["public"]["Enums"]["change_proposal_status"]
          trigger_entity_id?: string | null
          trigger_entity_type?: string
          trigger_type?: Database["public"]["Enums"]["framework_trigger_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_proposal_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "change_proposal_framework_trigger_id_fkey"
            columns: ["framework_trigger_id"]
            isOneToOne: false
            referencedRelation: "framework_trigger"
            referencedColumns: ["trigger_id"]
          },
          {
            foreignKeyName: "change_proposal_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "change_proposal_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "change_proposal_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      channel: {
        Row: {
          ai_voice_policy: Database["public"]["Enums"]["channel_ai_voice_policy"]
          allow_user_override: boolean
          audio_policy: Database["public"]["Enums"]["channel_audio_policy"]
          avatar_url: string | null
          channel_type: Database["public"]["Enums"]["comm_channel_type"]
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          direct_pair_hash: string | null
          helpdesk_enabled: boolean
          id: string
          is_archived: boolean
          is_read_only: boolean
          name: string | null
          privacy_mode:
            | Database["public"]["Enums"]["channel_privacy_mode"]
            | null
          read_receipts_enabled: boolean
          recording_policy: Database["public"]["Enums"]["channel_recording_policy"]
          responsible_profile_id: string | null
          session_id: string | null
          team_id: string | null
          updated_at: string
          video_policy: Database["public"]["Enums"]["channel_video_policy"]
          workspace_id: string
        }
        Insert: {
          ai_voice_policy?: Database["public"]["Enums"]["channel_ai_voice_policy"]
          allow_user_override?: boolean
          audio_policy?: Database["public"]["Enums"]["channel_audio_policy"]
          avatar_url?: string | null
          channel_type: Database["public"]["Enums"]["comm_channel_type"]
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          direct_pair_hash?: string | null
          helpdesk_enabled?: boolean
          id?: string
          is_archived?: boolean
          is_read_only?: boolean
          name?: string | null
          privacy_mode?:
            | Database["public"]["Enums"]["channel_privacy_mode"]
            | null
          read_receipts_enabled?: boolean
          recording_policy?: Database["public"]["Enums"]["channel_recording_policy"]
          responsible_profile_id?: string | null
          session_id?: string | null
          team_id?: string | null
          updated_at?: string
          video_policy?: Database["public"]["Enums"]["channel_video_policy"]
          workspace_id: string
        }
        Update: {
          ai_voice_policy?: Database["public"]["Enums"]["channel_ai_voice_policy"]
          allow_user_override?: boolean
          audio_policy?: Database["public"]["Enums"]["channel_audio_policy"]
          avatar_url?: string | null
          channel_type?: Database["public"]["Enums"]["comm_channel_type"]
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          direct_pair_hash?: string | null
          helpdesk_enabled?: boolean
          id?: string
          is_archived?: boolean
          is_read_only?: boolean
          name?: string | null
          privacy_mode?:
            | Database["public"]["Enums"]["channel_privacy_mode"]
            | null
          read_receipts_enabled?: boolean
          recording_policy?: Database["public"]["Enums"]["channel_recording_policy"]
          responsible_profile_id?: string | null
          session_id?: string | null
          team_id?: string | null
          updated_at?: string
          video_policy?: Database["public"]["Enums"]["channel_video_policy"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "channel_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "channel_responsible_profile_id_fkey"
            columns: ["responsible_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "channel_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "department_session"
            referencedColumns: ["department_session_id"]
          },
          {
            foreignKeyName: "channel_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "channel_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      channel_ai_policy: {
        Row: {
          auto_reminders: boolean
          auto_shift_prep: boolean
          auto_summarize: boolean
          channel_id: string
          created_at: string
          id: string
          personality_override: Json | null
          text_participation: Database["public"]["Enums"]["channel_ai_text_mode"]
          updated_at: string
          voice_participation: Database["public"]["Enums"]["channel_ai_voice_mode"]
          workspace_id: string
        }
        Insert: {
          auto_reminders?: boolean
          auto_shift_prep?: boolean
          auto_summarize?: boolean
          channel_id: string
          created_at?: string
          id?: string
          personality_override?: Json | null
          text_participation?: Database["public"]["Enums"]["channel_ai_text_mode"]
          updated_at?: string
          voice_participation?: Database["public"]["Enums"]["channel_ai_voice_mode"]
          workspace_id: string
        }
        Update: {
          auto_reminders?: boolean
          auto_shift_prep?: boolean
          auto_summarize?: boolean
          channel_id?: string
          created_at?: string
          id?: string
          personality_override?: Json | null
          text_participation?: Database["public"]["Enums"]["channel_ai_text_mode"]
          updated_at?: string
          voice_participation?: Database["public"]["Enums"]["channel_ai_voice_mode"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_ai_policy_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "channel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_ai_policy_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_ai_policy_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      channel_call_participant: {
        Row: {
          call_session_id: string
          created_at: string
          device_type: string | null
          id: string
          is_ai: boolean
          is_camera_on: boolean
          is_screen_sharing: boolean
          joined_at: string
          left_at: string | null
          mic_enabled: boolean
          profile_id: string
          speaking_seconds: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          call_session_id: string
          created_at?: string
          device_type?: string | null
          id?: string
          is_ai?: boolean
          is_camera_on?: boolean
          is_screen_sharing?: boolean
          joined_at?: string
          left_at?: string | null
          mic_enabled?: boolean
          profile_id: string
          speaking_seconds?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          call_session_id?: string
          created_at?: string
          device_type?: string | null
          id?: string
          is_ai?: boolean
          is_camera_on?: boolean
          is_screen_sharing?: boolean
          joined_at?: string
          left_at?: string | null
          mic_enabled?: boolean
          profile_id?: string
          speaking_seconds?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_call_participant_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "channel_call_session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_call_participant_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "channel_call_participant_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_call_participant_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      channel_call_session: {
        Row: {
          audio_policy: Database["public"]["Enums"]["channel_audio_policy"]
          call_type: Database["public"]["Enums"]["channel_call_type"]
          channel_id: string
          created_at: string
          ended_at: string | null
          id: string
          livekit_room_name: string
          max_participants: number
          recording_policy: Database["public"]["Enums"]["channel_recording_policy"]
          started_at: string
          started_by: string | null
          status: Database["public"]["Enums"]["channel_call_status"]
          updated_at: string
          video_policy: Database["public"]["Enums"]["channel_video_policy"]
          workspace_id: string
        }
        Insert: {
          audio_policy: Database["public"]["Enums"]["channel_audio_policy"]
          call_type: Database["public"]["Enums"]["channel_call_type"]
          channel_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          livekit_room_name: string
          max_participants?: number
          recording_policy?: Database["public"]["Enums"]["channel_recording_policy"]
          started_at?: string
          started_by?: string | null
          status?: Database["public"]["Enums"]["channel_call_status"]
          updated_at?: string
          video_policy?: Database["public"]["Enums"]["channel_video_policy"]
          workspace_id: string
        }
        Update: {
          audio_policy?: Database["public"]["Enums"]["channel_audio_policy"]
          call_type?: Database["public"]["Enums"]["channel_call_type"]
          channel_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          livekit_room_name?: string
          max_participants?: number
          recording_policy?: Database["public"]["Enums"]["channel_recording_policy"]
          started_at?: string
          started_by?: string | null
          status?: Database["public"]["Enums"]["channel_call_status"]
          updated_at?: string
          video_policy?: Database["public"]["Enums"]["channel_video_policy"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_call_session_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_call_session_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "channel_call_session_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_call_session_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      channel_event: {
        Row: {
          causation_id: string | null
          channel_id: string
          correlation_id: string | null
          created_at: string
          event_type: string
          id: string
          idempotency_key: string | null
          payload: Json
          source: string
          source_id: string | null
          workspace_id: string
        }
        Insert: {
          causation_id?: string | null
          channel_id: string
          correlation_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          idempotency_key?: string | null
          payload: Json
          source: string
          source_id?: string | null
          workspace_id: string
        }
        Update: {
          causation_id?: string | null
          channel_id?: string
          correlation_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          idempotency_key?: string | null
          payload?: Json
          source?: string
          source_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_event_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_event_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_event_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      channel_integration: {
        Row: {
          channel_id: string
          config: Json
          created_at: string
          created_by: string
          display_name: string
          enabled_events: string[] | null
          endpoint_secret_vault_id: string | null
          endpoint_url: string | null
          id: string
          provider_type: string
          status: Database["public"]["Enums"]["channel_integration_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          channel_id: string
          config?: Json
          created_at?: string
          created_by: string
          display_name: string
          enabled_events?: string[] | null
          endpoint_secret_vault_id?: string | null
          endpoint_url?: string | null
          id?: string
          provider_type: string
          status?: Database["public"]["Enums"]["channel_integration_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          channel_id?: string
          config?: Json
          created_at?: string
          created_by?: string
          display_name?: string
          enabled_events?: string[] | null
          endpoint_secret_vault_id?: string | null
          endpoint_url?: string | null
          id?: string
          provider_type?: string
          status?: Database["public"]["Enums"]["channel_integration_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_integration_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_integration_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "channel_integration_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_integration_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      channel_member: {
        Row: {
          channel_id: string
          id: string
          is_ai: boolean
          is_muted: boolean
          joined_at: string
          last_read_message_id: string | null
          left_at: string | null
          muted_until: string | null
          profile_id: string
          role: Database["public"]["Enums"]["channel_member_role"]
          workspace_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          is_ai?: boolean
          is_muted?: boolean
          joined_at?: string
          last_read_message_id?: string | null
          left_at?: string | null
          muted_until?: string | null
          profile_id: string
          role?: Database["public"]["Enums"]["channel_member_role"]
          workspace_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          is_ai?: boolean
          is_muted?: boolean
          joined_at?: string
          last_read_message_id?: string | null
          left_at?: string | null
          muted_until?: string | null
          profile_id?: string
          role?: Database["public"]["Enums"]["channel_member_role"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_member_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_member_last_read_fk"
            columns: ["last_read_message_id"]
            isOneToOne: false
            referencedRelation: "channel_message"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_member_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "channel_member_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_member_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      channel_message: {
        Row: {
          channel_id: string
          classification_metadata: Json | null
          client_message_id: string | null
          content: string
          created_at: string
          deleted_at: string | null
          delivery_mode: Database["public"]["Enums"]["channel_delivery_mode"]
          edited_at: string | null
          event_id: string | null
          id: string
          is_pinned: boolean
          message_type: Database["public"]["Enums"]["channel_message_type"]
          origin_id: string | null
          origin_type: Database["public"]["Enums"]["channel_origin_type"]
          original_content_hash: string | null
          pinned_at: string | null
          pinned_by: string | null
          redacted_at: string | null
          reply_to_id: string | null
          sender_id: string
          system_data: Json | null
          target_profile_ids: string[] | null
          updated_at: string
          visibility_scope: Database["public"]["Enums"]["channel_message_visibility"]
          workspace_id: string
        }
        Insert: {
          channel_id: string
          classification_metadata?: Json | null
          client_message_id?: string | null
          content: string
          created_at?: string
          deleted_at?: string | null
          delivery_mode?: Database["public"]["Enums"]["channel_delivery_mode"]
          edited_at?: string | null
          event_id?: string | null
          id?: string
          is_pinned?: boolean
          message_type?: Database["public"]["Enums"]["channel_message_type"]
          origin_id?: string | null
          origin_type?: Database["public"]["Enums"]["channel_origin_type"]
          original_content_hash?: string | null
          pinned_at?: string | null
          pinned_by?: string | null
          redacted_at?: string | null
          reply_to_id?: string | null
          sender_id: string
          system_data?: Json | null
          target_profile_ids?: string[] | null
          updated_at?: string
          visibility_scope?: Database["public"]["Enums"]["channel_message_visibility"]
          workspace_id: string
        }
        Update: {
          channel_id?: string
          classification_metadata?: Json | null
          client_message_id?: string | null
          content?: string
          created_at?: string
          deleted_at?: string | null
          delivery_mode?: Database["public"]["Enums"]["channel_delivery_mode"]
          edited_at?: string | null
          event_id?: string | null
          id?: string
          is_pinned?: boolean
          message_type?: Database["public"]["Enums"]["channel_message_type"]
          origin_id?: string | null
          origin_type?: Database["public"]["Enums"]["channel_origin_type"]
          original_content_hash?: string | null
          pinned_at?: string | null
          pinned_by?: string | null
          redacted_at?: string | null
          reply_to_id?: string | null
          sender_id?: string
          system_data?: Json | null
          target_profile_ids?: string[] | null
          updated_at?: string
          visibility_scope?: Database["public"]["Enums"]["channel_message_visibility"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_message_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_message_event_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "channel_event"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_message_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "channel_message_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "channel_message"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_message_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "channel_message_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_message_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      channel_message_attachment: {
        Row: {
          channel_id: string
          created_at: string
          duration_seconds: number | null
          file_type: string
          filename: string
          id: string
          message_id: string
          mime_type: string | null
          size_bytes: number
          url: string
          workspace_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          duration_seconds?: number | null
          file_type: string
          filename: string
          id?: string
          message_id: string
          mime_type?: string | null
          size_bytes: number
          url: string
          workspace_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          duration_seconds?: number | null
          file_type?: string
          filename?: string
          id?: string
          message_id?: string
          mime_type?: string | null
          size_bytes?: number
          url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_message_attachment_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_message_attachment_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "channel_message"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_message_attachment_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_message_attachment_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      channel_message_reaction: {
        Row: {
          channel_id: string
          created_at: string
          emoji: string
          id: string
          message_id: string
          profile_id: string
          workspace_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          profile_id: string
          workspace_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          profile_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_message_reaction_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_message_reaction_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "channel_message"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_message_reaction_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "channel_message_reaction_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_message_reaction_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      channel_message_read: {
        Row: {
          id: string
          message_id: string
          profile_id: string
          read_at: string
          workspace_id: string
        }
        Insert: {
          id?: string
          message_id: string
          profile_id: string
          read_at?: string
          workspace_id: string
        }
        Update: {
          id?: string
          message_id?: string
          profile_id?: string
          read_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_message_read_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "channel_message"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_message_read_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "channel_message_read_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_message_read_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      channel_notification_policy: {
        Row: {
          channel_id: string
          created_at: string
          delivery_channels: string[]
          event_type: string
          id: string
          priority: Database["public"]["Enums"]["channel_notification_priority"]
          respect_quiet_hours: boolean
          updated_at: string
          workspace_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          delivery_channels?: string[]
          event_type: string
          id?: string
          priority?: Database["public"]["Enums"]["channel_notification_priority"]
          respect_quiet_hours?: boolean
          updated_at?: string
          workspace_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          delivery_channels?: string[]
          event_type?: string
          id?: string
          priority?: Database["public"]["Enums"]["channel_notification_priority"]
          respect_quiet_hours?: boolean
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_notification_policy_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_notification_policy_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_notification_policy_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      channel_presence: {
        Row: {
          channel_id: string
          created_at: string
          device_type: string | null
          id: string
          last_seen_at: string
          profile_id: string
          status: Database["public"]["Enums"]["channel_presence_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          device_type?: string | null
          id?: string
          last_seen_at?: string
          profile_id: string
          status: Database["public"]["Enums"]["channel_presence_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          device_type?: string | null
          id?: string
          last_seen_at?: string
          profile_id?: string
          status?: Database["public"]["Enums"]["channel_presence_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_presence_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_presence_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "channel_presence_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_presence_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      channel_retention_policy: {
        Row: {
          archive_grace_period_hours: number
          auto_archive_on_close: boolean
          channel_id: string
          created_at: string
          generate_summary_on_close: boolean
          id: string
          pin_summary_on_close: boolean
          retain_media_days: number
          retain_messages_days: number
          searchable_after_archive: boolean
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archive_grace_period_hours?: number
          auto_archive_on_close?: boolean
          channel_id: string
          created_at?: string
          generate_summary_on_close?: boolean
          id?: string
          pin_summary_on_close?: boolean
          retain_media_days?: number
          retain_messages_days?: number
          searchable_after_archive?: boolean
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archive_grace_period_hours?: number
          auto_archive_on_close?: boolean
          channel_id?: string
          created_at?: string
          generate_summary_on_close?: boolean
          id?: string
          pin_summary_on_close?: boolean
          retain_media_days?: number
          retain_messages_days?: number
          searchable_after_archive?: boolean
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_retention_policy_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "channel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_retention_policy_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "channel_retention_policy_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      chat_conversation: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_archived: boolean
          is_featured: boolean
          name: string | null
          source_id: string | null
          source_type: string | null
          type: Database["public"]["Enums"]["chat_conversation_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_archived?: boolean
          is_featured?: boolean
          name?: string | null
          source_id?: string | null
          source_type?: string | null
          type: Database["public"]["Enums"]["chat_conversation_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          is_featured?: boolean
          name?: string | null
          source_id?: string | null
          source_type?: string | null
          type?: Database["public"]["Enums"]["chat_conversation_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversation_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "chat_conversation_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "chat_conversation_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      chat_message: {
        Row: {
          attachments: Json
          content: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          is_system: boolean
          reactions: Json
          reply_to_id: string | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          attachments?: Json
          content: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_system?: boolean
          reactions?: Json
          reply_to_id?: string | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          attachments?: Json
          content?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_system?: boolean
          reactions?: Json
          reply_to_id?: string | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_message"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      chat_participant: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          is_muted: boolean
          joined_at: string
          last_read_at: string
          left_at: string | null
          profile_id: string
          role: string
          updated_at: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string
          left_at?: string | null
          profile_id: string
          role?: string
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string
          left_at?: string | null
          profile_id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participant_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_participant_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
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
          industry_codes: string[] | null
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
          industry_codes?: string[] | null
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
          industry_codes?: string[] | null
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
          ehf_enabled: boolean
          email: string | null
          industry: Database["public"]["Enums"]["industry"]
          is_active: boolean
          legal_name: string | null
          logo_url: string | null
          nace_code: string | null
          nace_description: string | null
          name: string
          onboarding_status: string | null
          org_number: string | null
          peppol_participant_id: string | null
          phone: string | null
          postal_code: string | null
          raw_scraped_data: Json | null
          registration_date: string | null
          source: string
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
          ehf_enabled?: boolean
          email?: string | null
          industry?: Database["public"]["Enums"]["industry"]
          is_active?: boolean
          legal_name?: string | null
          logo_url?: string | null
          nace_code?: string | null
          nace_description?: string | null
          name: string
          onboarding_status?: string | null
          org_number?: string | null
          peppol_participant_id?: string | null
          phone?: string | null
          postal_code?: string | null
          raw_scraped_data?: Json | null
          registration_date?: string | null
          source?: string
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
          ehf_enabled?: boolean
          email?: string | null
          industry?: Database["public"]["Enums"]["industry"]
          is_active?: boolean
          legal_name?: string | null
          logo_url?: string | null
          nace_code?: string | null
          nace_description?: string | null
          name?: string
          onboarding_status?: string | null
          org_number?: string | null
          peppol_participant_id?: string | null
          phone?: string | null
          postal_code?: string | null
          raw_scraped_data?: Json | null
          registration_date?: string | null
          source?: string
          subscription_plan?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      company_details: {
        Row: {
          about_us: string | null
          ai_generated_fields: string[] | null
          created_at: string
          cuisine_types: string[] | null
          employee_count: string | null
          field_sources: Json | null
          id: string
          menu_description: string | null
          our_concept: string | null
          our_history: string | null
          price_category: string | null
          restaurant_type: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          about_us?: string | null
          ai_generated_fields?: string[] | null
          created_at?: string
          cuisine_types?: string[] | null
          employee_count?: string | null
          field_sources?: Json | null
          id?: string
          menu_description?: string | null
          our_concept?: string | null
          our_history?: string | null
          price_category?: string | null
          restaurant_type?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          about_us?: string | null
          ai_generated_fields?: string[] | null
          created_at?: string
          cuisine_types?: string[] | null
          employee_count?: string | null
          field_sources?: Json | null
          id?: string
          menu_description?: string | null
          our_concept?: string | null
          our_history?: string | null
          price_category?: string | null
          restaurant_type?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_details_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "company_details_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
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
            foreignKeyName: "fk_company_member_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
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
      company_opening_hours: {
        Row: {
          close_time: string | null
          created_at: string
          day_of_week: number
          id: string
          is_closed: boolean
          open_time: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          close_time?: string | null
          created_at?: string
          day_of_week: number
          id?: string
          is_closed?: boolean
          open_time?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          close_time?: string | null
          created_at?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean
          open_time?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_opening_hours_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "company_opening_hours_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      company_scraped_data: {
        Row: {
          auth_id: string
          created_at: string
          id: string
          parsed_data: Json | null
          raw_data: Json | null
          scrape_status: string
          scraped_at: string | null
          source_url: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          auth_id: string
          created_at?: string
          id?: string
          parsed_data?: Json | null
          raw_data?: Json | null
          scrape_status?: string
          scraped_at?: string | null
          source_url: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          auth_id?: string
          created_at?: string
          id?: string
          parsed_data?: Json | null
          raw_data?: Json | null
          scrape_status?: string
          scraped_at?: string | null
          source_url?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_scraped_data_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "company_scraped_data_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      company_social_media: {
        Row: {
          created_at: string
          id: string
          platform: string
          updated_at: string
          url: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          updated_at?: string
          url: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          updated_at?: string
          url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_social_media_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "company_social_media_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
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
          provenance: Json
          requires_signature: boolean
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          confirmation_id?: string
          confirmation_text: string
          created_at?: string
          is_active?: boolean
          name: string
          protocol_id: string
          provenance?: Json
          requires_signature?: boolean
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          confirmation_id?: string
          confirmation_text?: string
          created_at?: string
          is_active?: boolean
          name?: string
          protocol_id?: string
          provenance?: Json
          requires_signature?: boolean
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
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
      confirmation_signature: {
        Row: {
          confirmation_id: string
          created_at: string
          id: string
          ip_address: unknown
          profile_id: string
          protocol_assignment_id: string | null
          signature_data: Json
          signed_at: string
          workspace_id: string
        }
        Insert: {
          confirmation_id: string
          created_at?: string
          id?: string
          ip_address?: unknown
          profile_id: string
          protocol_assignment_id?: string | null
          signature_data?: Json
          signed_at?: string
          workspace_id: string
        }
        Update: {
          confirmation_id?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          profile_id?: string
          protocol_assignment_id?: string | null
          signature_data?: Json
          signed_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "confirmation_signature_confirmation_id_fkey"
            columns: ["confirmation_id"]
            isOneToOne: false
            referencedRelation: "confirmation"
            referencedColumns: ["confirmation_id"]
          },
          {
            foreignKeyName: "confirmation_signature_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "confirmation_signature_protocol_assignment_id_fkey"
            columns: ["protocol_assignment_id"]
            isOneToOne: false
            referencedRelation: "protocol_assignment"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "confirmation_signature_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "confirmation_signature_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      contract: {
        Row: {
          audit_log_url: string | null
          auto_create_workspace: boolean | null
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "platform_contract_instance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
      contract_attachment: {
        Row: {
          attachment_id: string
          contract_id: string
          created_at: string | null
          created_by: string | null
          display_order: number | null
          file_size: number | null
          filename: string
          mime_type: string
          storage_path: string
          updated_at: string | null
        }
        Insert: {
          attachment_id?: string
          contract_id: string
          created_at?: string | null
          created_by?: string | null
          display_order?: number | null
          file_size?: number | null
          filename: string
          mime_type: string
          storage_path: string
          updated_at?: string | null
        }
        Update: {
          attachment_id?: string
          contract_id?: string
          created_at?: string | null
          created_by?: string | null
          display_order?: number | null
          file_size?: number | null
          filename?: string
          mime_type?: string
          storage_path?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_attachment_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract"
            referencedColumns: ["contract_id"]
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
          deprecated_at: string | null
          description: string | null
          docuseal_template_id: string | null
          employment_category: string | null
          footer_html: string | null
          forked_at: string | null
          header_html: string | null
          is_active: boolean | null
          is_system: boolean | null
          language: string
          last_synced_at: string | null
          locale: string
          name: string
          placeholders: Json
          published_at: string | null
          source_template_id: string | null
          source_template_version: string | null
          status: string
          template_id: string
          template_type: string | null
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
          deprecated_at?: string | null
          description?: string | null
          docuseal_template_id?: string | null
          employment_category?: string | null
          footer_html?: string | null
          forked_at?: string | null
          header_html?: string | null
          is_active?: boolean | null
          is_system?: boolean | null
          language?: string
          last_synced_at?: string | null
          locale?: string
          name: string
          placeholders?: Json
          published_at?: string | null
          source_template_id?: string | null
          source_template_version?: string | null
          status?: string
          template_id?: string
          template_type?: string | null
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
          deprecated_at?: string | null
          description?: string | null
          docuseal_template_id?: string | null
          employment_category?: string | null
          footer_html?: string | null
          forked_at?: string | null
          header_html?: string | null
          is_active?: boolean | null
          is_system?: boolean | null
          language?: string
          last_synced_at?: string | null
          locale?: string
          name?: string
          placeholders?: Json
          published_at?: string | null
          source_template_id?: string | null
          source_template_version?: string | null
          status?: string
          template_id?: string
          template_type?: string | null
          updated_at?: string
          variable_fields?: Json
          version?: number | null
          watermark_url?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_template_source_fk"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "contract_template"
            referencedColumns: ["template_id"]
          },
          {
            foreignKeyName: "contract_template_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
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
      contract_template_binding: {
        Row: {
          created_at: string
          employee_group_id: string | null
          employment_category: string
          id: string
          is_active: boolean
          priority: number
          template_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          employee_group_id?: string | null
          employment_category: string
          id?: string
          is_active?: boolean
          priority?: number
          template_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          employee_group_id?: string | null
          employment_category?: string
          id?: string
          is_active?: boolean
          priority?: number
          template_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_template_binding_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_template"
            referencedColumns: ["template_id"]
          },
          {
            foreignKeyName: "contract_template_binding_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "contract_template_binding_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
          cash_counted: number | null
          cash_difference: number | null
          cash_expected: number | null
          closed_by: string | null
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
          wizard_state: Json
          workspace_id: string
        }
        Insert: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          cash_counted?: number | null
          cash_difference?: number | null
          cash_expected?: number | null
          closed_by?: string | null
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
          wizard_state?: Json
          workspace_id: string
        }
        Update: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          cash_counted?: number | null
          cash_difference?: number | null
          cash_expected?: number | null
          closed_by?: string | null
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
          wizard_state?: Json
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
            foreignKeyName: "daily_reconciliation_closed_by_fkey"
            columns: ["closed_by"]
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
          classification_confidence: string | null
          classification_source: string | null
          color: string | null
          created_at: string
          department_id: string
          department_type: Database["public"]["Enums"]["department_type"] | null
          description: string | null
          icon: string | null
          is_active: boolean
          manager_profile_id: string | null
          name: string
          slug: string
          sort_order: number | null
          source: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          classification_confidence?: string | null
          classification_source?: string | null
          color?: string | null
          created_at?: string
          department_id?: string
          department_type?:
            | Database["public"]["Enums"]["department_type"]
            | null
          description?: string | null
          icon?: string | null
          is_active?: boolean
          manager_profile_id?: string | null
          name: string
          slug: string
          sort_order?: number | null
          source?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          classification_confidence?: string | null
          classification_source?: string | null
          color?: string | null
          created_at?: string
          department_id?: string
          department_type?:
            | Database["public"]["Enums"]["department_type"]
            | null
          description?: string | null
          icon?: string | null
          is_active?: boolean
          manager_profile_id?: string | null
          name?: string
          slug?: string
          sort_order?: number | null
          source?: string
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
      department_hours_override: {
        Row: {
          close_time: string | null
          created_at: string
          department_id: string
          id: string
          is_closed: boolean
          location_id: string | null
          open_time: string | null
          override_date: string
          planning_event_id: string | null
          reason: string | null
          season_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          close_time?: string | null
          created_at?: string
          department_id: string
          id?: string
          is_closed?: boolean
          location_id?: string | null
          open_time?: string | null
          override_date: string
          planning_event_id?: string | null
          reason?: string | null
          season_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          close_time?: string | null
          created_at?: string
          department_id?: string
          id?: string
          is_closed?: boolean
          location_id?: string | null
          open_time?: string | null
          override_date?: string
          planning_event_id?: string | null
          reason?: string | null
          season_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_hours_override_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "department_hours_override_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "department_hours_override_planning_event_id_fkey"
            columns: ["planning_event_id"]
            isOneToOne: false
            referencedRelation: "planning_event"
            referencedColumns: ["planning_event_id"]
          },
          {
            foreignKeyName: "department_hours_override_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "season"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "department_hours_override_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "department_hours_override_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      department_operating_hours: {
        Row: {
          close_offset_minutes: number | null
          close_time: string | null
          created_at: string
          day_of_week: number
          department_id: string
          id: string
          is_closed: boolean
          is_derived: boolean | null
          location_id: string | null
          open_offset_minutes: number | null
          open_time: string | null
          provenance: Json
          season_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          close_offset_minutes?: number | null
          close_time?: string | null
          created_at?: string
          day_of_week: number
          department_id: string
          id?: string
          is_closed?: boolean
          is_derived?: boolean | null
          location_id?: string | null
          open_offset_minutes?: number | null
          open_time?: string | null
          provenance?: Json
          season_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          close_offset_minutes?: number | null
          close_time?: string | null
          created_at?: string
          day_of_week?: number
          department_id?: string
          id?: string
          is_closed?: boolean
          is_derived?: boolean | null
          location_id?: string | null
          open_offset_minutes?: number | null
          open_time?: string | null
          provenance?: Json
          season_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_operating_hours_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "department_operating_hours_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "department_operating_hours_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "season"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "department_operating_hours_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "department_operating_hours_workspace_id_fkey"
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
          duty_leader_id: string | null
          handoff_notes: string | null
          opened_at: string | null
          opened_by: string | null
          planned_close: string | null
          planned_open: string | null
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
          duty_leader_id?: string | null
          handoff_notes?: string | null
          opened_at?: string | null
          opened_by?: string | null
          planned_close?: string | null
          planned_open?: string | null
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
          duty_leader_id?: string | null
          handoff_notes?: string | null
          opened_at?: string | null
          opened_by?: string | null
          planned_close?: string | null
          planned_open?: string | null
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
            foreignKeyName: "department_session_duty_leader_id_fkey"
            columns: ["duty_leader_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
      department_shift_type_config: {
        Row: {
          applicable_day_types: string[]
          created_at: string
          default_break_minutes: number
          default_end_time: string
          default_start_time: string
          department_id: string
          id: string
          is_active: boolean
          label: string
          shift_type_id: string
          slot_count: number
          sort_order: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          applicable_day_types?: string[]
          created_at?: string
          default_break_minutes?: number
          default_end_time?: string
          default_start_time?: string
          department_id: string
          id?: string
          is_active?: boolean
          label: string
          shift_type_id: string
          slot_count?: number
          sort_order?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          applicable_day_types?: string[]
          created_at?: string
          default_break_minutes?: number
          default_end_time?: string
          default_start_time?: string
          department_id?: string
          id?: string
          is_active?: boolean
          label?: string
          shift_type_id?: string
          slot_count?: number
          sort_order?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_shift_type_config_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "department_shift_type_config_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "department_shift_type_config_workspace_id_fkey"
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
          procedure_id: string | null
          protocol_id: string | null
          reconciliation_id: string | null
          reported_by: string | null
          requires_action: boolean
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          session_id: string | null
          severity: Database["public"]["Enums"]["deviation_severity"]
          source_task_id: string | null
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
          procedure_id?: string | null
          protocol_id?: string | null
          reconciliation_id?: string | null
          reported_by?: string | null
          requires_action?: boolean
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          severity?: Database["public"]["Enums"]["deviation_severity"]
          source_task_id?: string | null
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
          procedure_id?: string | null
          protocol_id?: string | null
          reconciliation_id?: string | null
          reported_by?: string | null
          requires_action?: boolean
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          severity?: Database["public"]["Enums"]["deviation_severity"]
          source_task_id?: string | null
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
            foreignKeyName: "deviation_linked_shift_id_fkey"
            columns: ["linked_shift_id"]
            isOneToOne: false
            referencedRelation: "v_shift_lifecycle"
            referencedColumns: ["shift_id"]
          },
          {
            foreignKeyName: "deviation_linked_shift_id_fkey"
            columns: ["linked_shift_id"]
            isOneToOne: false
            referencedRelation: "v_shift_lifecycle_employee"
            referencedColumns: ["shift_id"]
          },
          {
            foreignKeyName: "deviation_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedure"
            referencedColumns: ["procedure_id"]
          },
          {
            foreignKeyName: "deviation_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocol"
            referencedColumns: ["protocol_id"]
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
            foreignKeyName: "deviation_source_task_id_fkey"
            columns: ["source_task_id"]
            isOneToOne: false
            referencedRelation: "session_task"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deviation_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
      document_extraction_log: {
        Row: {
          created_at: string
          id: string
          model: string | null
          processed_result: Json
          raw_ai_response: Json
          storage_paths: string[]
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string | null
          processed_result?: Json
          raw_ai_response?: Json
          storage_paths?: string[]
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string | null
          processed_result?: Json
          raw_ai_response?: Json
          storage_paths?: string[]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_extraction_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "document_extraction_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      dunning_escalation_log: {
        Row: {
          escalated_at: string
          from_stage: string | null
          invoice_id: string
          log_id: number
          to_stage: string
        }
        Insert: {
          escalated_at?: string
          from_stage?: string | null
          invoice_id: string
          log_id?: number
          to_stage: string
        }
        Update: {
          escalated_at?: string
          from_stage?: string | null
          invoice_id?: string
          log_id?: number
          to_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "dunning_escalation_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice"
            referencedColumns: ["invoice_id"]
          },
        ]
      }
      emma_conversation: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          profile_id: string
          started_at: string
          summary: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          profile_id: string
          started_at?: string
          summary?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          profile_id?: string
          started_at?: string
          summary?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emma_conversation_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "emma_conversation_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "emma_conversation_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      emma_note: {
        Row: {
          assigned_to: string | null
          content: string
          context: string
          converted_task_id: string | null
          created_at: string
          id: string
          profile_id: string
          screen: string
          status: string
          tags: string[]
          topic: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          content?: string
          context?: string
          converted_task_id?: string | null
          created_at?: string
          id?: string
          profile_id: string
          screen?: string
          status?: string
          tags?: string[]
          topic?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          content?: string
          context?: string
          converted_task_id?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          screen?: string
          status?: string
          tags?: string[]
          topic?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emma_note_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "emma_note_converted_task_id_fkey"
            columns: ["converted_task_id"]
            isOneToOne: false
            referencedRelation: "emma_task"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emma_note_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "emma_note_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "emma_note_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      emma_task: {
        Row: {
          context: Json | null
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          mission: string | null
          position: number
          priority: string
          profile_id: string
          status: string
          title: string
          triggered_at: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          context?: Json | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          mission?: string | null
          position?: number
          priority?: string
          profile_id: string
          status?: string
          title: string
          triggered_at?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          context?: Json | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          mission?: string | null
          position?: number
          priority?: string
          profile_id?: string
          status?: string
          title?: string
          triggered_at?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emma_task_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "emma_task_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "emma_task_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      emma_transcript: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          tool_name: string | null
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          tool_name?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          tool_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emma_transcript_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "emma_conversation"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_availability: {
        Row: {
          created_at: string
          created_by: string
          id: string
          preference_type: string
          profile_id: string
          reason: string | null
          rrule: string | null
          updated_at: string
          valid_from: string
          valid_to: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          preference_type: string
          profile_id: string
          reason?: string | null
          rrule?: string | null
          updated_at?: string
          valid_from: string
          valid_to?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          preference_type?: string
          profile_id?: string
          reason?: string | null
          rrule?: string | null
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_availability_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "employee_availability_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "employee_availability_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "employee_availability_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      employee_availability_preference: {
        Row: {
          created_at: string
          created_by: string
          day_of_week: number | null
          id: string
          note: string | null
          preference_kind: string
          profile_id: string
          rank: number
          time_of_day_end: string | null
          time_of_day_start: string | null
          updated_at: string
          valid_from: string
          valid_to: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          day_of_week?: number | null
          id?: string
          note?: string | null
          preference_kind: string
          profile_id: string
          rank: number
          time_of_day_end?: string | null
          time_of_day_start?: string | null
          updated_at?: string
          valid_from: string
          valid_to?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          day_of_week?: number | null
          id?: string
          note?: string | null
          preference_kind?: string
          profile_id?: string
          rank?: number
          time_of_day_end?: string | null
          time_of_day_start?: string | null
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_availability_preference_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "employee_availability_preference_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "employee_availability_preference_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "employee_availability_preference_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      employee_payroll_profile: {
        Row: {
          agreed_weekly_hours: number
          created_at: string
          employment_contract_id: string | null
          has_fagbrev: boolean
          id: string
          profile_id: string
          salary_type: string
          sector_experience_years: number
          seeded_at: string | null
          seeded_from_template_id: string | null
          seniority_start_date: string
          tariff_category: string
          tariff_override_id: string | null
          updated_at: string
          valid_from: string
          valid_until: string | null
          workspace_id: string
        }
        Insert: {
          agreed_weekly_hours: number
          created_at?: string
          employment_contract_id?: string | null
          has_fagbrev?: boolean
          id?: string
          profile_id: string
          salary_type: string
          sector_experience_years?: number
          seeded_at?: string | null
          seeded_from_template_id?: string | null
          seniority_start_date: string
          tariff_category: string
          tariff_override_id?: string | null
          updated_at?: string
          valid_from: string
          valid_until?: string | null
          workspace_id: string
        }
        Update: {
          agreed_weekly_hours?: number
          created_at?: string
          employment_contract_id?: string | null
          has_fagbrev?: boolean
          id?: string
          profile_id?: string
          salary_type?: string
          sector_experience_years?: number
          seeded_at?: string | null
          seeded_from_template_id?: string | null
          seniority_start_date?: string
          tariff_category?: string
          tariff_override_id?: string | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_payroll_profile_employment_contract_id_fkey"
            columns: ["employment_contract_id"]
            isOneToOne: false
            referencedRelation: "compliance_drift"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "employee_payroll_profile_employment_contract_id_fkey"
            columns: ["employment_contract_id"]
            isOneToOne: false
            referencedRelation: "employment_contract"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "employee_payroll_profile_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "employee_payroll_profile_seeded_from_template_id_fkey"
            columns: ["seeded_from_template_id"]
            isOneToOne: false
            referencedRelation: "payroll_profile_template"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_payroll_profile_tariff_override_id_fkey"
            columns: ["tariff_override_id"]
            isOneToOne: false
            referencedRelation: "tariff_rate_table"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_payroll_profile_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "employee_payroll_profile_workspace_id_fkey"
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
      employee_type: {
        Row: {
          accounting_account_code: string | null
          color_pallet: string | null
          created_at: string
          days_trial_period: number | null
          employee_type_id: string
          employment_form_derived: string | null
          fixed_salary: boolean | null
          max_hours_week: number | null
          max_vacation_days: number | null
          title: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          accounting_account_code?: string | null
          color_pallet?: string | null
          created_at?: string
          days_trial_period?: number | null
          employee_type_id?: string
          employment_form_derived?: string | null
          fixed_salary?: boolean | null
          max_hours_week?: number | null
          max_vacation_days?: number | null
          title: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          accounting_account_code?: string | null
          color_pallet?: string | null
          created_at?: string
          days_trial_period?: number | null
          employee_type_id?: string
          employment_form_derived?: string | null
          fixed_salary?: boolean | null
          max_hours_week?: number | null
          max_vacation_days?: number | null
          title?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_type_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "employee_type_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      employment_contract: {
        Row: {
          agreed_weekly_hours: number | null
          compliance_overrides: Json | null
          contract_id: string
          created_at: string
          created_by: string | null
          decline_reason_code: string | null
          decline_reason_text: string | null
          document_url: string | null
          employee_type_id: string | null
          employment_category: string
          employment_form: string | null
          employment_percentage: number | null
          end_date: string | null
          framework_snapshot: Json | null
          hourly_rate: number | null
          monthly_salary: number | null
          occupation_code: string | null
          parent_contract_id: string | null
          position_title: string
          profile_id: string
          remuneration_type: string | null
          signature_id: string | null
          signed_at: string | null
          signing_contract_id: string | null
          source: string
          start_date: string
          status: Database["public"]["Enums"]["contract_status"]
          updated_at: string
          working_hours_scheme: string | null
          workspace_id: string
        }
        Insert: {
          agreed_weekly_hours?: number | null
          compliance_overrides?: Json | null
          contract_id?: string
          created_at?: string
          created_by?: string | null
          decline_reason_code?: string | null
          decline_reason_text?: string | null
          document_url?: string | null
          employee_type_id?: string | null
          employment_category: string
          employment_form?: string | null
          employment_percentage?: number | null
          end_date?: string | null
          framework_snapshot?: Json | null
          hourly_rate?: number | null
          monthly_salary?: number | null
          occupation_code?: string | null
          parent_contract_id?: string | null
          position_title: string
          profile_id: string
          remuneration_type?: string | null
          signature_id?: string | null
          signed_at?: string | null
          signing_contract_id?: string | null
          source?: string
          start_date: string
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
          working_hours_scheme?: string | null
          workspace_id: string
        }
        Update: {
          agreed_weekly_hours?: number | null
          compliance_overrides?: Json | null
          contract_id?: string
          created_at?: string
          created_by?: string | null
          decline_reason_code?: string | null
          decline_reason_text?: string | null
          document_url?: string | null
          employee_type_id?: string | null
          employment_category?: string
          employment_form?: string | null
          employment_percentage?: number | null
          end_date?: string | null
          framework_snapshot?: Json | null
          hourly_rate?: number | null
          monthly_salary?: number | null
          occupation_code?: string | null
          parent_contract_id?: string | null
          position_title?: string
          profile_id?: string
          remuneration_type?: string | null
          signature_id?: string | null
          signed_at?: string | null
          signing_contract_id?: string | null
          source?: string
          start_date?: string
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
          working_hours_scheme?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employment_contract_employee_type_id_fkey"
            columns: ["employee_type_id"]
            isOneToOne: false
            referencedRelation: "employee_type"
            referencedColumns: ["employee_type_id"]
          },
          {
            foreignKeyName: "employment_contract_parent_contract_id_fkey"
            columns: ["parent_contract_id"]
            isOneToOne: false
            referencedRelation: "compliance_drift"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "employment_contract_parent_contract_id_fkey"
            columns: ["parent_contract_id"]
            isOneToOne: false
            referencedRelation: "employment_contract"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "employment_contract_signing_contract_id_fkey"
            columns: ["signing_contract_id"]
            isOneToOne: false
            referencedRelation: "contract"
            referencedColumns: ["contract_id"]
          },
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
      employment_contract_detail: {
        Row: {
          created_at: string
          detail_id: string
          effective_date: string
          employee_type_id: string | null
          employment_contract_id: string
          employment_form: string | null
          occupation_code: string | null
          remuneration_type: string | null
          source: string
          working_hours_scheme: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          detail_id?: string
          effective_date: string
          employee_type_id?: string | null
          employment_contract_id: string
          employment_form?: string | null
          occupation_code?: string | null
          remuneration_type?: string | null
          source?: string
          working_hours_scheme?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          detail_id?: string
          effective_date?: string
          employee_type_id?: string | null
          employment_contract_id?: string
          employment_form?: string | null
          occupation_code?: string | null
          remuneration_type?: string | null
          source?: string
          working_hours_scheme?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employment_contract_detail_employee_type_id_fkey"
            columns: ["employee_type_id"]
            isOneToOne: false
            referencedRelation: "employee_type"
            referencedColumns: ["employee_type_id"]
          },
          {
            foreignKeyName: "employment_contract_detail_employment_contract_id_fkey"
            columns: ["employment_contract_id"]
            isOneToOne: false
            referencedRelation: "compliance_drift"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "employment_contract_detail_employment_contract_id_fkey"
            columns: ["employment_contract_id"]
            isOneToOne: false
            referencedRelation: "employment_contract"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "employment_contract_detail_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "employment_contract_detail_workspace_id_fkey"
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
          min_role: string
          observer_escalation_hours: number
          requires_four_eyes: boolean
          updated_at: string
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          capability: string
          created_at?: string
          id?: string
          level?: string
          min_role?: string
          observer_escalation_hours?: number
          requires_four_eyes?: boolean
          updated_at?: string
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          capability?: string
          created_at?: string
          id?: string
          level?: string
          min_role?: string
          observer_escalation_hours?: number
          requires_four_eyes?: boolean
          updated_at?: string
          updated_by?: string | null
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
          cancelled_at: string | null
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
          cancelled_at?: string | null
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
          cancelled_at?: string | null
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
          workspace_id: string | null
        }
        Insert: {
          event_type: string
          fired_at?: string
          id?: string
          idempotency_key?: string | null
          payload?: Json
          workspace_id?: string | null
        }
        Update: {
          event_type?: string
          fired_at?: string
          id?: string
          idempotency_key?: string | null
          payload?: Json
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engine_event_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
          sensitivity: string | null
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
          sensitivity?: string | null
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
          sensitivity?: string | null
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
          journey_id: string | null
          mode: string
          name: string
          system_prompt: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          context_source?: string | null
          created_at?: string
          description?: string | null
          id: string
          is_active?: boolean
          journey_id?: string | null
          mode?: string
          name: string
          system_prompt?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          context_source?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          journey_id?: string | null
          mode?: string
          name?: string
          system_prompt?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engine_missions_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "engine_missions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
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
          allowed_channels: string[]
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
          allowed_channels?: string[]
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
          allowed_channels?: string[]
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
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
          expires_at: string | null
          guardian_whisper_count: number
          id: string
          journey_id: string | null
          mission_id: string | null
          mode: string
          profile_id: string | null
          stage_index: number
          stage_started_at: string | null
          status: string
          summary: string | null
          updated_at: string
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          callback_url?: string | null
          channel: string
          collected_data?: Json
          completed_at?: string | null
          context?: Json
          created_at?: string
          current_stage_id?: string | null
          expires_at?: string | null
          guardian_whisper_count?: number
          id?: string
          journey_id?: string | null
          mission_id?: string | null
          mode?: string
          profile_id?: string | null
          stage_index?: number
          stage_started_at?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          callback_url?: string | null
          channel?: string
          collected_data?: Json
          completed_at?: string | null
          context?: Json
          created_at?: string
          current_stage_id?: string | null
          expires_at?: string | null
          guardian_whisper_count?: number
          id?: string
          journey_id?: string | null
          mission_id?: string | null
          mode?: string
          profile_id?: string | null
          stage_index?: number
          stage_started_at?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engine_sessions_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey"
            referencedColumns: ["journey_id"]
          },
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
          journey_step_id: string | null
          mission_id: string
          next_stage: string | null
          personality_override: string | null
          stage_id: string
          stage_order: number
          success_criteria: string
          tuning_notes: string | null
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
          journey_step_id?: string | null
          mission_id: string
          next_stage?: string | null
          personality_override?: string | null
          stage_id: string
          stage_order: number
          success_criteria: string
          tuning_notes?: string | null
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
          journey_step_id?: string | null
          mission_id?: string
          next_stage?: string | null
          personality_override?: string | null
          stage_id?: string
          stage_order?: number
          success_criteria?: string
          tuning_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engine_stages_journey_step_id_fkey"
            columns: ["journey_step_id"]
            isOneToOne: false
            referencedRelation: "journey_step"
            referencedColumns: ["journey_step_id"]
          },
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
      engine_state_archive: {
        Row: {
          archived_at: string
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
          archived_at?: string
          assignee_id?: string | null
          completed_at?: string | null
          context?: Json
          current_step?: number
          depth?: number
          entity_id?: string | null
          entity_type?: string | null
          id: string
          last_error?: string | null
          parent_state_id?: string | null
          process_id: string
          result?: Json | null
          retry_count?: number
          started_at: string
          status: string
          steps_snapshot?: Json | null
          trigger_id?: string | null
          updated_at: string
          workspace_id: string
        }
        Update: {
          archived_at?: string
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
        Relationships: []
      }
      engine_state_step: {
        Row: {
          action_payload: Json
          action_type: string
          assignee_rule: string | null
          completed_at: string | null
          completed_by: string | null
          condition: Json | null
          created_at: string
          id: string
          result: Json | null
          state_id: string
          status: string
          step_order: number
          updated_at: string
        }
        Insert: {
          action_payload?: Json
          action_type: string
          assignee_rule?: string | null
          completed_at?: string | null
          completed_by?: string | null
          condition?: Json | null
          created_at?: string
          id?: string
          result?: Json | null
          state_id: string
          status?: string
          step_order: number
          updated_at?: string
        }
        Update: {
          action_payload?: Json
          action_type?: string
          assignee_rule?: string | null
          completed_at?: string | null
          completed_by?: string | null
          condition?: Json | null
          created_at?: string
          id?: string
          result?: Json | null
          state_id?: string
          status?: string
          step_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "engine_state_step_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "engine_state_step_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "engine_state"
            referencedColumns: ["id"]
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
      financial_close_config: {
        Row: {
          approval_deadline_hours: number
          approval_required: boolean
          cash_tolerance_type: string
          cash_tolerance_value: number
          config_id: string
          created_at: string
          require_cash_count: boolean
          tolerance_type: string
          tolerance_value: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          approval_deadline_hours?: number
          approval_required?: boolean
          cash_tolerance_type?: string
          cash_tolerance_value?: number
          config_id?: string
          created_at?: string
          require_cash_count?: boolean
          tolerance_type?: string
          tolerance_value?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          approval_deadline_hours?: number
          approval_required?: boolean
          cash_tolerance_type?: string
          cash_tolerance_value?: number
          config_id?: string
          created_at?: string
          require_cash_count?: boolean
          tolerance_type?: string
          tolerance_value?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_close_config_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "financial_close_config_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      framework_rule: {
        Row: {
          category: string
          code: string
          config_loosen_allowed: boolean
          config_tighten_allowed: boolean
          created_at: string
          default_outcome: Database["public"]["Enums"]["evaluation_outcome"]
          description: string
          description_no: string | null
          evaluation_config: Json
          framework_id: string
          outcome_overridable: boolean
          override_min_level: string | null
          rule_id: string
          rule_type: Database["public"]["Enums"]["framework_rule_type"]
          severity: string
          source_reference: string | null
          updated_at: string
        }
        Insert: {
          category: string
          code: string
          config_loosen_allowed?: boolean
          config_tighten_allowed?: boolean
          created_at?: string
          default_outcome?: Database["public"]["Enums"]["evaluation_outcome"]
          description: string
          description_no?: string | null
          evaluation_config?: Json
          framework_id: string
          outcome_overridable?: boolean
          override_min_level?: string | null
          rule_id?: string
          rule_type: Database["public"]["Enums"]["framework_rule_type"]
          severity?: string
          source_reference?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          config_loosen_allowed?: boolean
          config_tighten_allowed?: boolean
          created_at?: string
          default_outcome?: Database["public"]["Enums"]["evaluation_outcome"]
          description?: string
          description_no?: string | null
          evaluation_config?: Json
          framework_id?: string
          outcome_overridable?: boolean
          override_min_level?: string | null
          rule_id?: string
          rule_type?: Database["public"]["Enums"]["framework_rule_type"]
          severity?: string
          source_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "framework_rule_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "regulatory_framework"
            referencedColumns: ["framework_id"]
          },
        ]
      }
      framework_trigger: {
        Row: {
          code: string
          created_at: string
          description: string
          description_no: string | null
          evaluation_config: Json
          framework_id: string
          is_disableable: boolean
          is_enabled: boolean
          linked_rule_ids: string[] | null
          source_entity_type: string | null
          threshold_tune_allowed: boolean
          trigger_id: string
          trigger_mode: Database["public"]["Enums"]["framework_trigger_mode"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          description_no?: string | null
          evaluation_config?: Json
          framework_id: string
          is_disableable?: boolean
          is_enabled?: boolean
          linked_rule_ids?: string[] | null
          source_entity_type?: string | null
          threshold_tune_allowed?: boolean
          trigger_id?: string
          trigger_mode: Database["public"]["Enums"]["framework_trigger_mode"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          description_no?: string | null
          evaluation_config?: Json
          framework_id?: string
          is_disableable?: boolean
          is_enabled?: boolean
          linked_rule_ids?: string[] | null
          source_entity_type?: string | null
          threshold_tune_allowed?: boolean
          trigger_id?: string
          trigger_mode?: Database["public"]["Enums"]["framework_trigger_mode"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "framework_trigger_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "regulatory_framework"
            referencedColumns: ["framework_id"]
          },
        ]
      }
      gate_evaluation: {
        Row: {
          action_type: string
          actor_profile_id: string | null
          allow: boolean
          capability: string
          channel: string
          channel_allowed: boolean
          downgrade_to: string | null
          engine_process_id: string | null
          engine_state_id: string | null
          entity_id: string | null
          evaluated_at: string
          id: string
          min_role_required: string | null
          reason: string | null
          workspace_id: string
        }
        Insert: {
          action_type: string
          actor_profile_id?: string | null
          allow: boolean
          capability: string
          channel: string
          channel_allowed: boolean
          downgrade_to?: string | null
          engine_process_id?: string | null
          engine_state_id?: string | null
          entity_id?: string | null
          evaluated_at?: string
          id?: string
          min_role_required?: string | null
          reason?: string | null
          workspace_id: string
        }
        Update: {
          action_type?: string
          actor_profile_id?: string | null
          allow?: boolean
          capability?: string
          channel?: string
          channel_allowed?: boolean
          downgrade_to?: string | null
          engine_process_id?: string | null
          engine_state_id?: string | null
          entity_id?: string | null
          evaluated_at?: string
          id?: string
          min_role_required?: string | null
          reason?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gate_evaluation_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "gate_evaluation_engine_process_id_fkey"
            columns: ["engine_process_id"]
            isOneToOne: false
            referencedRelation: "engine_process"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_evaluation_engine_state_id_fkey"
            columns: ["engine_state_id"]
            isOneToOne: false
            referencedRelation: "engine_state"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_evaluation_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "gate_evaluation_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      guardian_log: {
        Row: {
          actor: string
          created_at: string
          data: Json | null
          event_type: string
          id: string
          session_id: string
          summary: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          actor: string
          created_at?: string
          data?: Json | null
          event_type: string
          id?: string
          session_id: string
          summary: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          actor?: string
          created_at?: string
          data?: Json | null
          event_type?: string
          id?: string
          session_id?: string
          summary?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "guardian_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      guardian_signal: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          data: Json | null
          description: string | null
          domain: string
          entity_id: string | null
          entity_label: string | null
          entity_type: string | null
          expires_at: string | null
          id: string
          resolved_at: string | null
          severity: string
          signal_type: string
          source_check_id: string | null
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          data?: Json | null
          description?: string | null
          domain: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          expires_at?: string | null
          id?: string
          resolved_at?: string | null
          severity: string
          signal_type: string
          source_check_id?: string | null
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          data?: Json | null
          description?: string | null
          domain?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          expires_at?: string | null
          id?: string
          resolved_at?: string | null
          severity?: string
          signal_type?: string
          source_check_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_signal_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "guardian_signal_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "guardian_signal_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      haccp_log: {
        Row: {
          ccp_reference: string
          corrective_action: string | null
          created_at: string
          equipment_id: string | null
          haccp_log_id: string
          is_within_range: boolean
          logged_at: string
          profile_id: string
          session_id: string | null
          temperature: number
          unit: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ccp_reference: string
          corrective_action?: string | null
          created_at?: string
          equipment_id?: string | null
          haccp_log_id?: string
          is_within_range: boolean
          logged_at?: string
          profile_id: string
          session_id?: string | null
          temperature: number
          unit?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ccp_reference?: string
          corrective_action?: string | null
          created_at?: string
          equipment_id?: string | null
          haccp_log_id?: string
          is_within_range?: boolean
          logged_at?: string
          profile_id?: string
          session_id?: string | null
          temperature?: number
          unit?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "haccp_log_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "asset"
            referencedColumns: ["asset_id"]
          },
          {
            foreignKeyName: "haccp_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "haccp_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "department_session"
            referencedColumns: ["department_session_id"]
          },
          {
            foreignKeyName: "haccp_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "haccp_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      handbook_chapter: {
        Row: {
          chapter_key: string
          content: Json
          created_at: string
          handbook_chapter_id: string
          title: string
          updated_at: string
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          chapter_key: string
          content?: Json
          created_at?: string
          handbook_chapter_id?: string
          title: string
          updated_at?: string
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          chapter_key?: string
          content?: Json
          created_at?: string
          handbook_chapter_id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "handbook_chapter_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "handbook_chapter_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "handbook_chapter_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      help_request: {
        Row: {
          created_at: string
          description: string | null
          id: string
          profile_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          profile_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          profile_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_request_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "help_request_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "help_request_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "help_request_workspace_id_fkey"
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
      inspection_link: {
        Row: {
          anonymization: string
          created_at: string
          inspection_link_id: string
          inspector_email: string | null
          inspector_name: string
          inspector_org: string
          issued_by: string
          justification: string
          revoked_at: string | null
          scope: Json
          token_hash: string
          valid_from: string
          valid_to: string
          workspace_id: string
        }
        Insert: {
          anonymization?: string
          created_at?: string
          inspection_link_id?: string
          inspector_email?: string | null
          inspector_name: string
          inspector_org: string
          issued_by: string
          justification: string
          revoked_at?: string | null
          scope: Json
          token_hash: string
          valid_from?: string
          valid_to: string
          workspace_id: string
        }
        Update: {
          anonymization?: string
          created_at?: string
          inspection_link_id?: string
          inspector_email?: string | null
          inspector_name?: string
          inspector_org?: string
          issued_by?: string
          justification?: string
          revoked_at?: string | null
          scope?: Json
          token_hash?: string
          valid_from?: string
          valid_to?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_link_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "inspection_link_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "inspection_link_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      inspection_link_view: {
        Row: {
          inspection_link_id: string
          inspection_link_view_id: string
          ip: unknown
          path: string
          scope_check_result: string
          user_agent: string | null
          viewed_at: string
        }
        Insert: {
          inspection_link_id: string
          inspection_link_view_id?: string
          ip?: unknown
          path: string
          scope_check_result: string
          user_agent?: string | null
          viewed_at?: string
        }
        Update: {
          inspection_link_id?: string
          inspection_link_view_id?: string
          ip?: unknown
          path?: string
          scope_check_result?: string
          user_agent?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_link_view_inspection_link_id_fkey"
            columns: ["inspection_link_id"]
            isOneToOne: false
            referencedRelation: "inspection_link"
            referencedColumns: ["inspection_link_id"]
          },
        ]
      }
      invitation: {
        Row: {
          company_id: string
          created_at: string
          department_ids: string[] | null
          direction: string
          email: string | null
          expires_at: string
          first_name: string | null
          invitation_id: string
          invite_employment_type: string | null
          invite_type: Database["public"]["Enums"]["invite_type"]
          invited_by: string | null
          last_name: string | null
          metadata: Json | null
          opened_at: string | null
          phone: string | null
          requested_by: string | null
          role: Database["public"]["Enums"]["profile_role"]
          source: string
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
          direction?: string
          email?: string | null
          expires_at?: string
          first_name?: string | null
          invitation_id?: string
          invite_employment_type?: string | null
          invite_type?: Database["public"]["Enums"]["invite_type"]
          invited_by?: string | null
          last_name?: string | null
          metadata?: Json | null
          opened_at?: string | null
          phone?: string | null
          requested_by?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          source?: string
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
          direction?: string
          email?: string | null
          expires_at?: string
          first_name?: string | null
          invitation_id?: string
          invite_employment_type?: string | null
          invite_type?: Database["public"]["Enums"]["invite_type"]
          invited_by?: string | null
          last_name?: string | null
          metadata?: Json | null
          opened_at?: string | null
          phone?: string | null
          requested_by?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          source?: string
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
            foreignKeyName: "fk_invitation_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "fk_invitation_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "invitation_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      invoice: {
        Row: {
          amount_excl_vat: number
          amount_incl_vat: number
          company_id: string
          created_at: string
          created_by: string | null
          credits_invoice_id: string | null
          currency: Database["public"]["Enums"]["currency"]
          due_at: string | null
          dunning_status: Database["public"]["Enums"]["dunning_status"] | null
          ehf_exported_at: string | null
          invoice_id: string
          invoice_number: number | null
          invoice_type: Database["public"]["Enums"]["invoice_type"]
          issued_at: string | null
          paid_at: string | null
          payment_channel: string | null
          payment_date: string | null
          payment_reference: string | null
          period_from: string
          period_to: string
          pricing_terms_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
          vat_amount: number
          vat_rate: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_excl_vat: number
          amount_incl_vat: number
          company_id: string
          created_at?: string
          created_by?: string | null
          credits_invoice_id?: string | null
          currency?: Database["public"]["Enums"]["currency"]
          due_at?: string | null
          dunning_status?: Database["public"]["Enums"]["dunning_status"] | null
          ehf_exported_at?: string | null
          invoice_id?: string
          invoice_number?: number | null
          invoice_type: Database["public"]["Enums"]["invoice_type"]
          issued_at?: string | null
          paid_at?: string | null
          payment_channel?: string | null
          payment_date?: string | null
          payment_reference?: string | null
          period_from: string
          period_to: string
          pricing_terms_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          vat_amount: number
          vat_rate?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_excl_vat?: number
          amount_incl_vat?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          credits_invoice_id?: string | null
          currency?: Database["public"]["Enums"]["currency"]
          due_at?: string | null
          dunning_status?: Database["public"]["Enums"]["dunning_status"] | null
          ehf_exported_at?: string | null
          invoice_id?: string
          invoice_number?: number | null
          invoice_type?: Database["public"]["Enums"]["invoice_type"]
          issued_at?: string | null
          paid_at?: string | null
          payment_channel?: string | null
          payment_date?: string | null
          payment_reference?: string | null
          period_from?: string
          period_to?: string
          pricing_terms_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "invoice_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "invoice_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invoice_credits_invoice_id_fkey"
            columns: ["credits_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_pricing_terms_id_fkey"
            columns: ["pricing_terms_id"]
            isOneToOne: false
            referencedRelation: "pricing_terms"
            referencedColumns: ["pricing_terms_id"]
          },
          {
            foreignKeyName: "invoice_pricing_terms_id_fkey"
            columns: ["pricing_terms_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["pricing_terms_id"]
          },
          {
            foreignKeyName: "invoice_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
        ]
      }
      invoice_dispatch: {
        Row: {
          attempts: number
          channel: Database["public"]["Enums"]["billing_dispatch_channel"]
          created_at: string
          delivered_at: string | null
          dispatch_rule_id: string | null
          engine_state_id: string | null
          error_code: string | null
          error_message: string | null
          external_reference: string | null
          invoice_dispatch_id: string
          invoice_id: string
          last_attempt_at: string | null
          status: Database["public"]["Enums"]["dispatch_status"]
          target: Json
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel: Database["public"]["Enums"]["billing_dispatch_channel"]
          created_at?: string
          delivered_at?: string | null
          dispatch_rule_id?: string | null
          engine_state_id?: string | null
          error_code?: string | null
          error_message?: string | null
          external_reference?: string | null
          invoice_dispatch_id?: string
          invoice_id: string
          last_attempt_at?: string | null
          status?: Database["public"]["Enums"]["dispatch_status"]
          target: Json
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel?: Database["public"]["Enums"]["billing_dispatch_channel"]
          created_at?: string
          delivered_at?: string | null
          dispatch_rule_id?: string | null
          engine_state_id?: string | null
          error_code?: string | null
          error_message?: string | null
          external_reference?: string | null
          invoice_dispatch_id?: string
          invoice_id?: string
          last_attempt_at?: string | null
          status?: Database["public"]["Enums"]["dispatch_status"]
          target?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_dispatch_dispatch_rule_id_fkey"
            columns: ["dispatch_rule_id"]
            isOneToOne: false
            referencedRelation: "billing_dispatch_rule"
            referencedColumns: ["dispatch_rule_id"]
          },
          {
            foreignKeyName: "invoice_dispatch_engine_state_id_fkey"
            columns: ["engine_state_id"]
            isOneToOne: false
            referencedRelation: "engine_state"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_dispatch_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice"
            referencedColumns: ["invoice_id"]
          },
        ]
      }
      invoice_line_item: {
        Row: {
          addon_key: string | null
          amount_excl_vat: number
          amount_incl_vat: number
          created_at: string
          description: string
          invoice_id: string
          line_item_id: string
          line_type: Database["public"]["Enums"]["invoice_line_type"]
          period_reference: string | null
          quantity: number
          unit_price: number
          usage_snapshot_id: string | null
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          addon_key?: string | null
          amount_excl_vat: number
          amount_incl_vat: number
          created_at?: string
          description: string
          invoice_id: string
          line_item_id?: string
          line_type: Database["public"]["Enums"]["invoice_line_type"]
          period_reference?: string | null
          quantity?: number
          unit_price: number
          usage_snapshot_id?: string | null
          vat_amount: number
          vat_rate?: number
        }
        Update: {
          addon_key?: string | null
          amount_excl_vat?: number
          amount_incl_vat?: number
          created_at?: string
          description?: string
          invoice_id?: string
          line_item_id?: string
          line_type?: Database["public"]["Enums"]["invoice_line_type"]
          period_reference?: string | null
          quantity?: number
          unit_price?: number
          usage_snapshot_id?: string | null
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_line_item_usage_snapshot"
            columns: ["usage_snapshot_id"]
            isOneToOne: false
            referencedRelation: "usage_snapshot"
            referencedColumns: ["usage_snapshot_id"]
          },
          {
            foreignKeyName: "invoice_line_item_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice"
            referencedColumns: ["invoice_id"]
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
          engine_process_id: string | null
          entity_type: string | null
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
          step_event_type: string | null
          tags: string[]
          test_assertion: string | null
          title: string
          trigger_description: string | null
          trigger_event: string | null
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
          engine_process_id?: string | null
          entity_type?: string | null
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
          step_event_type?: string | null
          tags?: string[]
          test_assertion?: string | null
          title: string
          trigger_description?: string | null
          trigger_event?: string | null
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
          engine_process_id?: string | null
          entity_type?: string | null
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
          step_event_type?: string | null
          tags?: string[]
          test_assertion?: string | null
          title?: string
          trigger_description?: string | null
          trigger_event?: string | null
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
            foreignKeyName: "journey_engine_process_id_fkey"
            columns: ["engine_process_id"]
            isOneToOne: false
            referencedRelation: "engine_process"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
          action_payload_override: Json | null
          action_type_override: string | null
          component: string | null
          created_at: string
          data_reads: string[]
          data_writes: string[]
          expects: string | null
          journey_id: string
          journey_step_id: string
          max_duration_seconds: number | null
          min_duration_seconds: number | null
          notes: string | null
          required_confirmation: boolean
          screen: string | null
          slug: string | null
          step_order: number
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          action: string
          action_payload_override?: Json | null
          action_type_override?: string | null
          component?: string | null
          created_at?: string
          data_reads?: string[]
          data_writes?: string[]
          expects?: string | null
          journey_id: string
          journey_step_id?: string
          max_duration_seconds?: number | null
          min_duration_seconds?: number | null
          notes?: string | null
          required_confirmation?: boolean
          screen?: string | null
          slug?: string | null
          step_order: number
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          action?: string
          action_payload_override?: Json | null
          action_type_override?: string | null
          component?: string | null
          created_at?: string
          data_reads?: string[]
          data_writes?: string[]
          expects?: string | null
          journey_id?: string
          journey_step_id?: string
          max_duration_seconds?: number | null
          min_duration_seconds?: number | null
          notes?: string | null
          required_confirmation?: boolean
          screen?: string | null
          slug?: string | null
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
      journey_version: {
        Row: {
          created_at: string
          created_by: string | null
          ir_json: Json | null
          journey_id: string
          journey_version_id: string
          status: Database["public"]["Enums"]["journey_version_status"]
          updated_at: string
          version_number: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ir_json?: Json | null
          journey_id: string
          journey_version_id?: string
          status?: Database["public"]["Enums"]["journey_version_status"]
          updated_at?: string
          version_number?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ir_json?: Json | null
          journey_id?: string
          journey_version_id?: string
          status?: Database["public"]["Enums"]["journey_version_status"]
          updated_at?: string
          version_number?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_version_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journey"
            referencedColumns: ["journey_id"]
          },
          {
            foreignKeyName: "journey_version_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "journey_version_workspace_id_fkey"
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
          valid_from: string | null
          valid_to: string | null
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
          valid_from?: string | null
          valid_to?: string | null
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
          valid_from?: string | null
          valid_to?: string | null
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
      knowledge_test_attempt: {
        Row: {
          ai_confidence: number | null
          answers: Json
          attempted_at: string
          created_at: string
          graded_by: string | null
          id: string
          knowledge_test_id: string
          passed: boolean
          profile_id: string
          protocol_assignment_id: string | null
          score: number | null
          workspace_id: string
        }
        Insert: {
          ai_confidence?: number | null
          answers?: Json
          attempted_at?: string
          created_at?: string
          graded_by?: string | null
          id?: string
          knowledge_test_id: string
          passed?: boolean
          profile_id: string
          protocol_assignment_id?: string | null
          score?: number | null
          workspace_id: string
        }
        Update: {
          ai_confidence?: number | null
          answers?: Json
          attempted_at?: string
          created_at?: string
          graded_by?: string | null
          id?: string
          knowledge_test_id?: string
          passed?: boolean
          profile_id?: string
          protocol_assignment_id?: string | null
          score?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_test_attempt_knowledge_test_id_fkey"
            columns: ["knowledge_test_id"]
            isOneToOne: false
            referencedRelation: "knowledge_test"
            referencedColumns: ["knowledge_test_id"]
          },
          {
            foreignKeyName: "knowledge_test_attempt_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "knowledge_test_attempt_protocol_assignment_id_fkey"
            columns: ["protocol_assignment_id"]
            isOneToOne: false
            referencedRelation: "protocol_assignment"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "knowledge_test_attempt_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "knowledge_test_attempt_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
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
      landing_waitlist_submission: {
        Row: {
          campaign_key: string
          company_name: string
          created_at: string
          email: string
          employee_count: string
          full_name: string
          id: string
          interested_package: string
          ip_address: unknown
          phone: string | null
          premium_reservation_interest: boolean
          session_id: string | null
          source_hostname: string | null
          source_path: string | null
          status: string
          user_agent: string | null
          variant: string | null
          visitor_id: string | null
        }
        Insert: {
          campaign_key: string
          company_name: string
          created_at?: string
          email: string
          employee_count: string
          full_name: string
          id?: string
          interested_package: string
          ip_address?: unknown
          phone?: string | null
          premium_reservation_interest?: boolean
          session_id?: string | null
          source_hostname?: string | null
          source_path?: string | null
          status?: string
          user_agent?: string | null
          variant?: string | null
          visitor_id?: string | null
        }
        Update: {
          campaign_key?: string
          company_name?: string
          created_at?: string
          email?: string
          employee_count?: string
          full_name?: string
          id?: string
          interested_package?: string
          ip_address?: unknown
          phone?: string | null
          premium_reservation_interest?: boolean
          session_id?: string | null
          source_hostname?: string | null
          source_path?: string | null
          status?: string
          user_agent?: string | null
          variant?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_waitlist_submission_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "landing_visitor"
            referencedColumns: ["id"]
          },
        ]
      }
      leader_pulse: {
        Row: {
          answer: string | null
          answered_at: string | null
          context: Json | null
          created_at: string
          delivered_at: string | null
          delivered_via: string | null
          id: string
          profile_id: string
          question: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          context?: Json | null
          created_at?: string
          delivered_at?: string | null
          delivered_via?: string | null
          id?: string
          profile_id: string
          question: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          context?: Json | null
          created_at?: string
          delivered_at?: string | null
          delivered_via?: string | null
          id?: string
          profile_id?: string
          question?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leader_pulse_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "leader_pulse_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "leader_pulse_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      legal_function: {
        Row: {
          created_at: string
          description: string | null
          legal_basis: string | null
          legal_function_id: string
          name: string
          profession_id: string | null
          slug: string
          sort_order: number
          training_hours: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          legal_basis?: string | null
          legal_function_id?: string
          name: string
          profession_id?: string | null
          slug: string
          sort_order?: number
          training_hours?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          legal_basis?: string | null
          legal_function_id?: string
          name?: string
          profession_id?: string | null
          slug?: string
          sort_order?: number
          training_hours?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_function_profession_id_fkey"
            columns: ["profession_id"]
            isOneToOne: false
            referencedRelation: "profession"
            referencedColumns: ["profession_id"]
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
          source: string
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
          source?: string
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
          source?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_location_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
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
      notification: {
        Row: {
          action_url: string | null
          body: string | null
          created_at: string
          group_key: string | null
          icon_type: string
          id: string
          is_read: boolean
          metadata: Json | null
          read_at: string | null
          recipient_id: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          group_key?: string | null
          icon_type?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          read_at?: string | null
          recipient_id: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          group_key?: string | null
          icon_type?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          read_at?: string | null
          recipient_id?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "notification_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "notification_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
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
          retry_count: number
          scheduled_for: string | null
          status: Database["public"]["Enums"]["notification_status"] | null
          title: string
          updated_at: string
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
          retry_count?: number
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["notification_status"] | null
          title: string
          updated_at?: string
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
          retry_count?: number
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["notification_status"] | null
          title?: string
          updated_at?: string
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
      notification_policy: {
        Row: {
          created_at: string
          domain: string
          is_active: boolean
          locale_overrides: Json | null
          notification_policy_id: string
          quiet_hours: Json | null
          rate_limit_per_day: number
          risk_level: string | null
          tier_ladder: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          domain: string
          is_active?: boolean
          locale_overrides?: Json | null
          notification_policy_id?: string
          quiet_hours?: Json | null
          rate_limit_per_day?: number
          risk_level?: string | null
          tier_ladder: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          is_active?: boolean
          locale_overrides?: Json | null
          notification_policy_id?: string
          quiet_hours?: Json | null
          rate_limit_per_day?: number
          risk_level?: string | null
          tier_ladder?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_policy_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "notification_policy_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      notification_preference: {
        Row: {
          browser_enabled: boolean | null
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
          browser_enabled?: boolean | null
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
          browser_enabled?: boolean | null
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
      notification_sent_log: {
        Row: {
          channel: string
          converted_at: string | null
          notification_policy_id: string | null
          notification_sent_log_id: string
          opened_at: string | null
          related_entity_id: string
          related_entity_type: string
          sent_at: string
          subject_profile_id: string
          tier: string
          workspace_id: string
        }
        Insert: {
          channel: string
          converted_at?: string | null
          notification_policy_id?: string | null
          notification_sent_log_id?: string
          opened_at?: string | null
          related_entity_id: string
          related_entity_type: string
          sent_at?: string
          subject_profile_id: string
          tier: string
          workspace_id: string
        }
        Update: {
          channel?: string
          converted_at?: string | null
          notification_policy_id?: string | null
          notification_sent_log_id?: string
          opened_at?: string | null
          related_entity_id?: string
          related_entity_type?: string
          sent_at?: string
          subject_profile_id?: string
          tier?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_sent_log_notification_policy_id_fkey"
            columns: ["notification_policy_id"]
            isOneToOne: false
            referencedRelation: "notification_policy"
            referencedColumns: ["notification_policy_id"]
          },
          {
            foreignKeyName: "notification_sent_log_subject_profile_id_fkey"
            columns: ["subject_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "notification_sent_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "notification_sent_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      observer_request: {
        Row: {
          claimed_at: string | null
          created_at: string
          notes: string | null
          observer_profile_id: string | null
          observer_request_id: string
          protocol_assignment_id: string
          requested_at: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["observer_request_status"]
          subject_profile_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          notes?: string | null
          observer_profile_id?: string | null
          observer_request_id?: string
          protocol_assignment_id: string
          requested_at?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["observer_request_status"]
          subject_profile_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          notes?: string | null
          observer_profile_id?: string | null
          observer_request_id?: string
          protocol_assignment_id?: string
          requested_at?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["observer_request_status"]
          subject_profile_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "observer_request_observer_profile_id_fkey"
            columns: ["observer_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "observer_request_protocol_assignment_id_fkey"
            columns: ["protocol_assignment_id"]
            isOneToOne: false
            referencedRelation: "protocol_assignment"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "observer_request_subject_profile_id_fkey"
            columns: ["subject_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "observer_request_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "observer_request_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
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
            foreignKeyName: "onboarding_session_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
      payment: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          external_id: string | null
          invoice_id: string
          paid_at: string | null
          payment_id: string
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          refunded_amount: number | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          currency: Database["public"]["Enums"]["currency"]
          external_id?: string | null
          invoice_id: string
          paid_at?: string | null
          payment_id?: string
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          refunded_amount?: number | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          external_id?: string | null
          invoice_id?: string
          paid_at?: string | null
          payment_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          refunded_amount?: number | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "payment_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "payment_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice"
            referencedColumns: ["invoice_id"]
          },
        ]
      }
      payment_attempt: {
        Row: {
          attempt_number: number
          created_at: string
          error_code: string | null
          error_message: string | null
          payment_attempt_id: string
          payment_id: string
          redacted_payload: Json
          status: string
          stripe_event_id: string
        }
        Insert: {
          attempt_number: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          payment_attempt_id?: string
          payment_id: string
          redacted_payload?: Json
          status: string
          stripe_event_id: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          payment_attempt_id?: string
          payment_id?: string
          redacted_payload?: Json
          status?: string
          stripe_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempt_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payment"
            referencedColumns: ["payment_id"]
          },
        ]
      }
      payroll_ledger_archive: {
        Row: {
          a_melding_code: string | null
          accounting_account_code: string | null
          archived_at: string
          base_salary: number | null
          bubble_record_id: string
          department_id: string | null
          hours: number | null
          payroll_ledger_id: string
          profile_id: string
          raw_json: Json
          schedule_shift_id: string | null
          source: string
          team_id: string | null
          total_salary: number | null
          transaction_date: string
          workspace_id: string
        }
        Insert: {
          a_melding_code?: string | null
          accounting_account_code?: string | null
          archived_at?: string
          base_salary?: number | null
          bubble_record_id: string
          department_id?: string | null
          hours?: number | null
          payroll_ledger_id?: string
          profile_id: string
          raw_json: Json
          schedule_shift_id?: string | null
          source?: string
          team_id?: string | null
          total_salary?: number | null
          transaction_date: string
          workspace_id: string
        }
        Update: {
          a_melding_code?: string | null
          accounting_account_code?: string | null
          archived_at?: string
          base_salary?: number | null
          bubble_record_id?: string
          department_id?: string | null
          hours?: number | null
          payroll_ledger_id?: string
          profile_id?: string
          raw_json?: Json
          schedule_shift_id?: string | null
          source?: string
          team_id?: string | null
          total_salary?: number | null
          transaction_date?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_ledger_archive_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "payroll_ledger_archive_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "payroll_ledger_archive_schedule_shift_id_fkey"
            columns: ["schedule_shift_id"]
            isOneToOne: false
            referencedRelation: "schedule_shift"
            referencedColumns: ["schedule_shift_id"]
          },
          {
            foreignKeyName: "payroll_ledger_archive_schedule_shift_id_fkey"
            columns: ["schedule_shift_id"]
            isOneToOne: false
            referencedRelation: "v_shift_lifecycle"
            referencedColumns: ["shift_id"]
          },
          {
            foreignKeyName: "payroll_ledger_archive_schedule_shift_id_fkey"
            columns: ["schedule_shift_id"]
            isOneToOne: false
            referencedRelation: "v_shift_lifecycle_employee"
            referencedColumns: ["shift_id"]
          },
          {
            foreignKeyName: "payroll_ledger_archive_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "payroll_ledger_archive_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "payroll_ledger_archive_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      payroll_profile_template: {
        Row: {
          agreed_weekly_hours: number | null
          created_at: string
          employment_category: string | null
          id: string
          is_locked: boolean | null
          is_system_template: boolean | null
          name: string
          salary_type: string
          seed_source: string | null
          seed_version: string | null
          seeded_at: string | null
          tariff_category: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agreed_weekly_hours?: number | null
          created_at?: string
          employment_category?: string | null
          id?: string
          is_locked?: boolean | null
          is_system_template?: boolean | null
          name: string
          salary_type: string
          seed_source?: string | null
          seed_version?: string | null
          seeded_at?: string | null
          tariff_category?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agreed_weekly_hours?: number | null
          created_at?: string
          employment_category?: string | null
          id?: string
          is_locked?: boolean | null
          is_system_template?: boolean | null
          name?: string
          salary_type?: string
          seed_source?: string | null
          seed_version?: string | null
          seeded_at?: string | null
          tariff_category?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_profile_template_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "payroll_profile_template_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      planning_cycle: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          name: string
          planning_cycle_id: string
          start_date: string
          status: Database["public"]["Enums"]["planning_cycle_status"]
          total_revenue_target: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          name: string
          planning_cycle_id?: string
          start_date: string
          status?: Database["public"]["Enums"]["planning_cycle_status"]
          total_revenue_target?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          name?: string
          planning_cycle_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["planning_cycle_status"]
          total_revenue_target?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_cycle_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "planning_cycle_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "planning_cycle_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      planning_event: {
        Row: {
          category: Database["public"]["Enums"]["planning_event_category"]
          confidence: number | null
          created_at: string
          created_by: string | null
          demand_multiplier: number
          description: string | null
          end_date: string | null
          event_date: string
          expected_covers: number | null
          external_source_url: string | null
          hours_override_id: string | null
          is_recurring: boolean
          name: string
          planning_cycle_id: string | null
          planning_event_id: string
          provenance: Json
          recurrence_rule: string | null
          source: Database["public"]["Enums"]["planning_event_source"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["planning_event_category"]
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          demand_multiplier?: number
          description?: string | null
          end_date?: string | null
          event_date: string
          expected_covers?: number | null
          external_source_url?: string | null
          hours_override_id?: string | null
          is_recurring?: boolean
          name: string
          planning_cycle_id?: string | null
          planning_event_id?: string
          provenance?: Json
          recurrence_rule?: string | null
          source?: Database["public"]["Enums"]["planning_event_source"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["planning_event_category"]
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          demand_multiplier?: number
          description?: string | null
          end_date?: string | null
          event_date?: string
          expected_covers?: number | null
          external_source_url?: string | null
          hours_override_id?: string | null
          is_recurring?: boolean
          name?: string
          planning_cycle_id?: string | null
          planning_event_id?: string
          provenance?: Json
          recurrence_rule?: string | null
          source?: Database["public"]["Enums"]["planning_event_source"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_event_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "planning_event_planning_cycle_id_fkey"
            columns: ["planning_cycle_id"]
            isOneToOne: false
            referencedRelation: "planning_cycle"
            referencedColumns: ["planning_cycle_id"]
          },
          {
            foreignKeyName: "planning_event_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "planning_event_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      planning_factors: {
        Row: {
          actual_value: number | null
          created_at: string
          dimension: string
          factor_type: string
          id: string
          period_date: string
          planned_value: number
          season_id: string | null
          updated_at: string
          variance_pct: number | null
          workspace_id: string
        }
        Insert: {
          actual_value?: number | null
          created_at?: string
          dimension: string
          factor_type: string
          id?: string
          period_date: string
          planned_value: number
          season_id?: string | null
          updated_at?: string
          variance_pct?: number | null
          workspace_id: string
        }
        Update: {
          actual_value?: number | null
          created_at?: string
          dimension?: string
          factor_type?: string
          id?: string
          period_date?: string
          planned_value?: number
          season_id?: string | null
          updated_at?: string
          variance_pct?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_factors_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "season"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "planning_factors_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "planning_factors_workspace_id_fkey"
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
            foreignKeyName: "platform_api_key_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
      platform_communication_channel_result: {
        Row: {
          channel: string
          communication_id: string
          created_at: string
          failed_count: number
          id: string
          provider: string | null
          provider_batch_id: string | null
          recipient_count: number
          sent_count: number
        }
        Insert: {
          channel: string
          communication_id: string
          created_at?: string
          failed_count?: number
          id?: string
          provider?: string | null
          provider_batch_id?: string | null
          recipient_count?: number
          sent_count?: number
        }
        Update: {
          channel?: string
          communication_id?: string
          created_at?: string
          failed_count?: number
          id?: string
          provider?: string | null
          provider_batch_id?: string | null
          recipient_count?: number
          sent_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "platform_communication_channel_result_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "platform_communication_log"
            referencedColumns: ["communication_id"]
          },
        ]
      }
      platform_communication_log: {
        Row: {
          audience_filter: Json | null
          campaign_id: string | null
          channel: string
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
          scheduled_for: string | null
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
          campaign_id?: string | null
          channel?: string
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
          scheduled_for?: string | null
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
          campaign_id?: string | null
          channel?: string
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
          scheduled_for?: string | null
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
          channel: string
          created_at: string
          created_by: string | null
          in_app_action_url: string | null
          in_app_body: string | null
          in_app_icon_type: string | null
          in_app_mode: string | null
          in_app_priority: number | null
          in_app_title: string | null
          is_active: boolean
          name: string
          placeholders: Json
          push_action_url: string | null
          push_body: string | null
          push_title: string | null
          sections: Json
          sms_body: string | null
          status: string
          subject: string
          template_id: string
          updated_at: string
        }
        Insert: {
          category?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          in_app_action_url?: string | null
          in_app_body?: string | null
          in_app_icon_type?: string | null
          in_app_mode?: string | null
          in_app_priority?: number | null
          in_app_title?: string | null
          is_active?: boolean
          name: string
          placeholders?: Json
          push_action_url?: string | null
          push_body?: string | null
          push_title?: string | null
          sections?: Json
          sms_body?: string | null
          status?: string
          subject?: string
          template_id?: string
          updated_at?: string
        }
        Update: {
          category?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          in_app_action_url?: string | null
          in_app_body?: string | null
          in_app_icon_type?: string | null
          in_app_mode?: string | null
          in_app_priority?: number | null
          in_app_title?: string | null
          is_active?: boolean
          name?: string
          placeholders?: Json
          push_action_url?: string | null
          push_body?: string | null
          push_title?: string | null
          sections?: Json
          sms_body?: string | null
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
          provenance: Json
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
          provenance?: Json
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
          provenance?: Json
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
          profession_id: string | null
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
          profession_id?: string | null
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
          profession_id?: string | null
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "fk_position_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "position_profession_id_fkey"
            columns: ["profession_id"]
            isOneToOne: false
            referencedRelation: "profession"
            referencedColumns: ["profession_id"]
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
          agreement_period: unknown
          billing_interval: string
          company_id: string
          contract_id: string | null
          created_at: string
          created_by: string | null
          currency: Database["public"]["Enums"]["currency"]
          delivery_channel: string
          discount_label: string | null
          discount_percent: number | null
          effective_from: string
          effective_until: string | null
          free_users: number
          invoice_format: string
          monthly_cost: number | null
          notes: string | null
          onboarding_cost: number | null
          onboarding_package: string | null
          overage_price_per_user: number | null
          price_per_employee: number
          pricing_terms_id: string
          trial_days: number | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          agreement_period?: unknown
          billing_interval?: string
          company_id: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency"]
          delivery_channel?: string
          discount_label?: string | null
          discount_percent?: number | null
          effective_from: string
          effective_until?: string | null
          free_users?: number
          invoice_format?: string
          monthly_cost?: number | null
          notes?: string | null
          onboarding_cost?: number | null
          onboarding_package?: string | null
          overage_price_per_user?: number | null
          price_per_employee: number
          pricing_terms_id?: string
          trial_days?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          agreement_period?: unknown
          billing_interval?: string
          company_id?: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency"]
          delivery_channel?: string
          discount_label?: string | null
          discount_percent?: number | null
          effective_from?: string
          effective_until?: string | null
          free_users?: number
          invoice_format?: string
          monthly_cost?: number | null
          notes?: string | null
          onboarding_cost?: number | null
          onboarding_package?: string | null
          overage_price_per_user?: number | null
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
            foreignKeyName: "pricing_terms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
          provenance: Json
          skill_requirements: Json | null
          sort_order: number | null
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_active?: boolean
          name: string
          procedure_id?: string
          procedure_type?: Database["public"]["Enums"]["procedure_type"]
          protocol_id: string
          provenance?: Json
          skill_requirements?: Json | null
          sort_order?: number | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          is_active?: boolean
          name?: string
          procedure_id?: string
          procedure_type?: Database["public"]["Enums"]["procedure_type"]
          protocol_id?: string
          provenance?: Json
          skill_requirements?: Json | null
          sort_order?: number | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
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
          media_urls: Json | null
          procedure_id: string
          provenance: Json
          step_id: string
          step_order: number
          title: string
          training_content: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          estimated_minutes?: number | null
          is_required?: boolean
          media_urls?: Json | null
          procedure_id: string
          provenance?: Json
          step_id?: string
          step_order?: number
          title: string
          training_content?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          estimated_minutes?: number | null
          is_required?: boolean
          media_urls?: Json | null
          procedure_id?: string
          provenance?: Json
          step_id?: string
          step_order?: number
          title?: string
          training_content?: string | null
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
      procedure_step_completion: {
        Row: {
          completed_at: string
          created_at: string
          evidence: Json | null
          id: string
          procedure_step_id: string
          profile_id: string
          protocol_assignment_id: string | null
          workspace_id: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          evidence?: Json | null
          id?: string
          procedure_step_id: string
          profile_id: string
          protocol_assignment_id?: string | null
          workspace_id: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          evidence?: Json | null
          id?: string
          procedure_step_id?: string
          profile_id?: string
          protocol_assignment_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_step_completion_procedure_step_id_fkey"
            columns: ["procedure_step_id"]
            isOneToOne: false
            referencedRelation: "procedure_step"
            referencedColumns: ["step_id"]
          },
          {
            foreignKeyName: "procedure_step_completion_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "procedure_step_completion_protocol_assignment_id_fkey"
            columns: ["protocol_assignment_id"]
            isOneToOne: false
            referencedRelation: "protocol_assignment"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "procedure_step_completion_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "procedure_step_completion_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      profession: {
        Row: {
          created_at: string
          description: string | null
          is_universal: boolean
          name: string
          profession_id: string
          slug: string
          sort_order: number
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_universal?: boolean
          name: string
          profession_id?: string
          slug: string
          sort_order?: number
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          is_universal?: boolean
          name?: string
          profession_id?: string
          slug?: string
          sort_order?: number
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profession_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "profession_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      profession_industry: {
        Row: {
          created_at: string
          nace_code: string
          profession_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          nace_code: string
          profession_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          nace_code?: string
          profession_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profession_industry_profession_id_fkey"
            columns: ["profession_id"]
            isOneToOne: false
            referencedRelation: "profession"
            referencedColumns: ["profession_id"]
          },
        ]
      }
      profession_training: {
        Row: {
          created_at: string
          is_required: boolean
          profession_id: string
          profession_training_id: string
          protocol_id: string
          updated_at: string
          weight: number
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          is_required?: boolean
          profession_id: string
          profession_training_id?: string
          protocol_id: string
          updated_at?: string
          weight?: number
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          is_required?: boolean
          profession_id?: string
          profession_training_id?: string
          protocol_id?: string
          updated_at?: string
          weight?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profession_training_profession_id_fkey"
            columns: ["profession_id"]
            isOneToOne: false
            referencedRelation: "profession"
            referencedColumns: ["profession_id"]
          },
          {
            foreignKeyName: "profession_training_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocol"
            referencedColumns: ["protocol_id"]
          },
          {
            foreignKeyName: "profession_training_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "profession_training_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      profile: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          authority_level: Database["public"]["Enums"]["authority_level"] | null
          avatar_url: string | null
          bank_account: string | null
          city: string | null
          company_id: string | null
          contracted_weekly_hours: number | null
          created_at: string
          department_id: string | null
          departments: string[] | null
          display_name: string
          employee_number: string | null
          expo_push_token: string | null
          external_employee_number: string | null
          has_fagbrev: boolean
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
          salary_identifier: string | null
          seniority_start_date: string | null
          source: string
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
          authority_level?:
            | Database["public"]["Enums"]["authority_level"]
            | null
          avatar_url?: string | null
          bank_account?: string | null
          city?: string | null
          company_id?: string | null
          contracted_weekly_hours?: number | null
          created_at?: string
          department_id?: string | null
          departments?: string[] | null
          display_name: string
          employee_number?: string | null
          expo_push_token?: string | null
          external_employee_number?: string | null
          has_fagbrev?: boolean
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
          salary_identifier?: string | null
          seniority_start_date?: string | null
          source?: string
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
          authority_level?:
            | Database["public"]["Enums"]["authority_level"]
            | null
          avatar_url?: string | null
          bank_account?: string | null
          city?: string | null
          company_id?: string | null
          contracted_weekly_hours?: number | null
          created_at?: string
          department_id?: string | null
          departments?: string[] | null
          display_name?: string
          employee_number?: string | null
          expo_push_token?: string | null
          external_employee_number?: string | null
          has_fagbrev?: boolean
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
          salary_identifier?: string | null
          seniority_start_date?: string | null
          source?: string
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
            foreignKeyName: "fk_profile_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
      profile_access: {
        Row: {
          created_at: string
          granted_by: string
          profile_id: string
          scope: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          granted_by?: string
          profile_id: string
          scope: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          granted_by?: string
          profile_id?: string
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_access_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      profile_legal_function: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          created_at: string
          legal_function_id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          legal_function_id: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          legal_function_id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_legal_function_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "profile_legal_function_legal_function_id_fkey"
            columns: ["legal_function_id"]
            isOneToOne: false
            referencedRelation: "legal_function"
            referencedColumns: ["legal_function_id"]
          },
          {
            foreignKeyName: "profile_legal_function_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      profile_position: {
        Row: {
          created_at: string
          is_primary: boolean
          position_id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          is_primary?: boolean
          position_id: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          is_primary?: boolean
          position_id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_position_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "position"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "profile_position_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      protocol: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          evidence_tier: Database["public"]["Enums"]["evidence_tier"]
          name: string
          owner_profile_id: string
          policy_id: string
          protocol_id: string
          provenance: Json
          status: Database["public"]["Enums"]["protocol_status"]
          updated_at: string
          valid_from: string | null
          valid_to: string | null
          version: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          evidence_tier?: Database["public"]["Enums"]["evidence_tier"]
          name: string
          owner_profile_id: string
          policy_id: string
          protocol_id?: string
          provenance?: Json
          status?: Database["public"]["Enums"]["protocol_status"]
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          version?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          evidence_tier?: Database["public"]["Enums"]["evidence_tier"]
          name?: string
          owner_profile_id?: string
          policy_id?: string
          protocol_id?: string
          provenance?: Json
          status?: Database["public"]["Enums"]["protocol_status"]
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
          assigned_by: string | null
          assigned_ref_id: string | null
          assigned_via: Database["public"]["Enums"]["assignment_source"] | null
          assignment_id: string
          completed_at: string | null
          confirmations_signed: number
          confirmations_total: number
          created_at: string
          next_review_at: string | null
          procedures_completed: number
          procedures_total: number
          profile_id: string
          protocol_id: string
          protocol_version: string | null
          status: Database["public"]["Enums"]["protocol_assignment_status"]
          tests_passed: number
          tests_total: number
          updated_at: string
          waived_by: string | null
          waived_reason: string | null
          workspace_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          assigned_ref_id?: string | null
          assigned_via?: Database["public"]["Enums"]["assignment_source"] | null
          assignment_id?: string
          completed_at?: string | null
          confirmations_signed?: number
          confirmations_total?: number
          created_at?: string
          next_review_at?: string | null
          procedures_completed?: number
          procedures_total?: number
          profile_id: string
          protocol_id: string
          protocol_version?: string | null
          status?: Database["public"]["Enums"]["protocol_assignment_status"]
          tests_passed?: number
          tests_total?: number
          updated_at?: string
          waived_by?: string | null
          waived_reason?: string | null
          workspace_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          assigned_ref_id?: string | null
          assigned_via?: Database["public"]["Enums"]["assignment_source"] | null
          assignment_id?: string
          completed_at?: string | null
          confirmations_signed?: number
          confirmations_total?: number
          created_at?: string
          next_review_at?: string | null
          procedures_completed?: number
          procedures_total?: number
          profile_id?: string
          protocol_id?: string
          protocol_version?: string | null
          status?: Database["public"]["Enums"]["protocol_assignment_status"]
          tests_passed?: number
          tests_total?: number
          updated_at?: string
          waived_by?: string | null
          waived_reason?: string | null
          workspace_id?: string
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
          {
            foreignKeyName: "fk_protocol_assignment_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "fk_protocol_assignment_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "protocol_assignment_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "protocol_assignment_waived_by_fkey"
            columns: ["waived_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      public_holiday: {
        Row: {
          country_code: string
          holiday_date: string
          is_full_day: boolean
          name: string
          name_no: string
        }
        Insert: {
          country_code?: string
          holiday_date: string
          is_full_day?: boolean
          name: string
          name_no: string
        }
        Update: {
          country_code?: string
          holiday_date?: string
          is_full_day?: boolean
          name?: string
          name_no?: string
        }
        Relationships: []
      }
      regulatory_framework: {
        Row: {
          code: string
          created_at: string
          description: string | null
          framework_id: string
          industry: string
          is_active: boolean
          jurisdiction: string
          metadata: Json | null
          name: string
          parent_framework_id: string | null
          updated_at: string
          version: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          framework_id?: string
          industry: string
          is_active?: boolean
          jurisdiction?: string
          metadata?: Json | null
          name: string
          parent_framework_id?: string | null
          updated_at?: string
          version?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          framework_id?: string
          industry?: string
          is_active?: boolean
          jurisdiction?: string
          metadata?: Json | null
          name?: string
          parent_framework_id?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_framework_parent_framework_id_fkey"
            columns: ["parent_framework_id"]
            isOneToOne: false
            referencedRelation: "regulatory_framework"
            referencedColumns: ["framework_id"]
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
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
          adhoc_approved_at: string | null
          adhoc_approved_by: string | null
          approved_at: string | null
          approved_by: string | null
          breaks: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          custom_rate: number | null
          custom_rate_type:
            | Database["payroll"]["Enums"]["custom_rate_type"]
            | null
          day_category: Database["public"]["Enums"]["day_category"]
          department_id: string | null
          employee_id: string | null
          end_time: string
          indicator: string
          is_adhoc: boolean | null
          is_published: boolean
          location_id: string | null
          notes: string | null
          position_id: string | null
          role: string
          schedule_shift_id: string
          shift_date: string
          shift_type_id: string | null
          source: string
          start_time: string
          status: Database["public"]["Enums"]["shift_status"]
          team_id: string | null
          template_shift_id: string | null
          updated_at: string
          work_hours: number
          workspace_id: string
          zone: string | null
        }
        Insert: {
          adhoc_approved_at?: string | null
          adhoc_approved_by?: string | null
          approved_at?: string | null
          approved_by?: string | null
          breaks?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          custom_rate?: number | null
          custom_rate_type?:
            | Database["payroll"]["Enums"]["custom_rate_type"]
            | null
          day_category: Database["public"]["Enums"]["day_category"]
          department_id?: string | null
          employee_id?: string | null
          end_time: string
          indicator?: string
          is_adhoc?: boolean | null
          is_published?: boolean
          location_id?: string | null
          notes?: string | null
          position_id?: string | null
          role: string
          schedule_shift_id?: string
          shift_date: string
          shift_type_id?: string | null
          source?: string
          start_time: string
          status?: Database["public"]["Enums"]["shift_status"]
          team_id?: string | null
          template_shift_id?: string | null
          updated_at?: string
          work_hours?: number
          workspace_id: string
          zone?: string | null
        }
        Update: {
          adhoc_approved_at?: string | null
          adhoc_approved_by?: string | null
          approved_at?: string | null
          approved_by?: string | null
          breaks?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          custom_rate?: number | null
          custom_rate_type?:
            | Database["payroll"]["Enums"]["custom_rate_type"]
            | null
          day_category?: Database["public"]["Enums"]["day_category"]
          department_id?: string | null
          employee_id?: string | null
          end_time?: string
          indicator?: string
          is_adhoc?: boolean | null
          is_published?: boolean
          location_id?: string | null
          notes?: string | null
          position_id?: string | null
          role?: string
          schedule_shift_id?: string
          shift_date?: string
          shift_type_id?: string | null
          source?: string
          start_time?: string
          status?: Database["public"]["Enums"]["shift_status"]
          team_id?: string | null
          template_shift_id?: string | null
          updated_at?: string
          work_hours?: number
          workspace_id?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_shift_adhoc_approved_by_fkey"
            columns: ["adhoc_approved_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "schedule_shift_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "schedule_shift_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "schedule_shift_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "schedule_shift_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "schedule_shift_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["location_id"]
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
            foreignKeyName: "schedule_shift_template_shift_id_fkey"
            columns: ["template_shift_id"]
            isOneToOne: false
            referencedRelation: "schedule_template_shift"
            referencedColumns: ["schedule_template_shift_id"]
          },
          {
            foreignKeyName: "schedule_shift_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
      schedule_shift_lock_audit: {
        Row: {
          actor_user_id: string | null
          created_at: string
          id: string
          is_enforced: boolean
          is_overridden_by_high_access: boolean
          lock_mode: string
          new_row: Json | null
          old_row: Json
          operation: string
          reason_code: string
          schedule_shift_id: string
          shift_date: string
          start_time: string
          workspace_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          id?: string
          is_enforced: boolean
          is_overridden_by_high_access?: boolean
          lock_mode: string
          new_row?: Json | null
          old_row: Json
          operation: string
          reason_code: string
          schedule_shift_id: string
          shift_date: string
          start_time: string
          workspace_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          id?: string
          is_enforced?: boolean
          is_overridden_by_high_access?: boolean
          lock_mode?: string
          new_row?: Json | null
          old_row?: Json
          operation?: string
          reason_code?: string
          schedule_shift_id?: string
          shift_date?: string
          start_time?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_shift_lock_audit_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "schedule_shift_lock_audit_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      schedule_shift_lock_policy: {
        Row: {
          created_at: string
          lock_mode: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          lock_mode?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          lock_mode?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_shift_lock_policy_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "schedule_shift_lock_policy_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
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
          department_id: string | null
          include_assignments: boolean
          name: string
          provenance: Json
          schedule_template_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          department: string
          department_id?: string | null
          include_assignments?: boolean
          name: string
          provenance?: Json
          schedule_template_id?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          department?: string
          department_id?: string | null
          include_assignments?: boolean
          name?: string
          provenance?: Json
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
            foreignKeyName: "schedule_template_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "schedule_template_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
          end_anchor_type: Database["public"]["Enums"]["anchor_type"] | null
          end_offset_min: number | null
          end_time: string
          indicator: string
          label: string | null
          notes: string | null
          provenance: Json
          role: string
          schedule_template_shift_id: string
          shift_function: Database["public"]["Enums"]["shift_function"] | null
          slot_count: number
          slot_order: number | null
          start_anchor_type: Database["public"]["Enums"]["anchor_type"] | null
          start_offset_min: number | null
          start_time: string
          template_id: string
          updated_at: string
          work_hours: number
          workspace_id: string | null
          zone: string | null
        }
        Insert: {
          breaks?: number
          created_at?: string
          day_category: Database["public"]["Enums"]["day_category"]
          employee_id?: string | null
          end_anchor_type?: Database["public"]["Enums"]["anchor_type"] | null
          end_offset_min?: number | null
          end_time: string
          indicator?: string
          label?: string | null
          notes?: string | null
          provenance?: Json
          role: string
          schedule_template_shift_id?: string
          shift_function?: Database["public"]["Enums"]["shift_function"] | null
          slot_count?: number
          slot_order?: number | null
          start_anchor_type?: Database["public"]["Enums"]["anchor_type"] | null
          start_offset_min?: number | null
          start_time: string
          template_id: string
          updated_at?: string
          work_hours?: number
          workspace_id?: string | null
          zone?: string | null
        }
        Update: {
          breaks?: number
          created_at?: string
          day_category?: Database["public"]["Enums"]["day_category"]
          employee_id?: string | null
          end_anchor_type?: Database["public"]["Enums"]["anchor_type"] | null
          end_offset_min?: number | null
          end_time?: string
          indicator?: string
          label?: string | null
          notes?: string | null
          provenance?: Json
          role?: string
          schedule_template_shift_id?: string
          shift_function?: Database["public"]["Enums"]["shift_function"] | null
          slot_count?: number
          slot_order?: number | null
          start_anchor_type?: Database["public"]["Enums"]["anchor_type"] | null
          start_offset_min?: number | null
          start_time?: string
          template_id?: string
          updated_at?: string
          work_hours?: number
          workspace_id?: string | null
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
          {
            foreignKeyName: "schedule_template_shift_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "schedule_template_shift_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
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
          opening_hours: Json | null
          parent_season_id: string | null
          planning_cycle_id: string | null
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
          opening_hours?: Json | null
          parent_season_id?: string | null
          planning_cycle_id?: string | null
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
          opening_hours?: Json | null
          parent_season_id?: string | null
          planning_cycle_id?: string | null
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "fk_season_workspace"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "season_planning_cycle_id_fkey"
            columns: ["planning_cycle_id"]
            isOneToOne: false
            referencedRelation: "planning_cycle"
            referencedColumns: ["planning_cycle_id"]
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
          target_margin: number | null
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
          target_margin?: number | null
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
          target_margin?: number | null
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
      season_goal: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          metric_key: string | null
          season_goal_id: string
          season_id: string
          sort_order: number
          status: Database["public"]["Enums"]["season_goal_status"]
          target_unit: string | null
          target_value: number | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          metric_key?: string | null
          season_goal_id?: string
          season_id: string
          sort_order?: number
          status?: Database["public"]["Enums"]["season_goal_status"]
          target_unit?: string | null
          target_value?: number | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          metric_key?: string | null
          season_goal_id?: string
          season_id?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["season_goal_status"]
          target_unit?: string | null
          target_value?: number | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_goal_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "season_goal_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "season"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "season_goal_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "season_goal_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      season_policy_binding: {
        Row: {
          activated_by: string | null
          created_at: string
          is_active: boolean
          notes: string | null
          policy_id: string
          season_id: string
          season_policy_binding_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          activated_by?: string | null
          created_at?: string
          is_active?: boolean
          notes?: string | null
          policy_id: string
          season_id: string
          season_policy_binding_id?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          activated_by?: string | null
          created_at?: string
          is_active?: boolean
          notes?: string | null
          policy_id?: string
          season_id?: string
          season_policy_binding_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_policy_binding_activated_by_fkey"
            columns: ["activated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "season_policy_binding_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policy"
            referencedColumns: ["policy_id"]
          },
          {
            foreignKeyName: "season_policy_binding_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "season"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "season_policy_binding_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "season_policy_binding_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      service_config: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          docker_image: string | null
          docker_service_name: string | null
          env_schema: Json
          health_endpoint: string | null
          host_url: string | null
          is_critical: boolean
          name: string
          port: number | null
          service_id: string
          slug: string
          status: Database["public"]["Enums"]["service_status"]
          tags: string[]
          type: Database["public"]["Enums"]["service_type"]
          updated_at: string
          vault_secrets: string[]
          vercel_project_id: string | null
          version: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          docker_image?: string | null
          docker_service_name?: string | null
          env_schema?: Json
          health_endpoint?: string | null
          host_url?: string | null
          is_critical?: boolean
          name: string
          port?: number | null
          service_id?: string
          slug: string
          status?: Database["public"]["Enums"]["service_status"]
          tags?: string[]
          type: Database["public"]["Enums"]["service_type"]
          updated_at?: string
          vault_secrets?: string[]
          vercel_project_id?: string | null
          version?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          docker_image?: string | null
          docker_service_name?: string | null
          env_schema?: Json
          health_endpoint?: string | null
          host_url?: string | null
          is_critical?: boolean
          name?: string
          port?: number | null
          service_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["service_status"]
          tags?: string[]
          type?: Database["public"]["Enums"]["service_type"]
          updated_at?: string
          vault_secrets?: string[]
          vercel_project_id?: string | null
          version?: string | null
        }
        Relationships: []
      }
      service_config_log: {
        Row: {
          applied: boolean
          applied_at: string | null
          change_type: Database["public"]["Enums"]["config_change_type"]
          changed_by: string
          created_at: string
          field_name: string
          log_id: string
          new_value: string | null
          old_value: string | null
          service_id: string
        }
        Insert: {
          applied?: boolean
          applied_at?: string | null
          change_type: Database["public"]["Enums"]["config_change_type"]
          changed_by: string
          created_at?: string
          field_name: string
          log_id?: string
          new_value?: string | null
          old_value?: string | null
          service_id: string
        }
        Update: {
          applied?: boolean
          applied_at?: string | null
          change_type?: Database["public"]["Enums"]["config_change_type"]
          changed_by?: string
          created_at?: string
          field_name?: string
          log_id?: string
          new_value?: string | null
          old_value?: string | null
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_config_log_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_config"
            referencedColumns: ["service_id"]
          },
        ]
      }
      session_hook: {
        Row: {
          created_at: string
          department_id: string
          hook_type: Database["public"]["Enums"]["session_hook_type"]
          id: string
          is_active: boolean
          linked_procedure_id: string | null
          linked_routine_id: string | null
          repeat_interval_min: number | null
          trigger_offset_min: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          hook_type: Database["public"]["Enums"]["session_hook_type"]
          id?: string
          is_active?: boolean
          linked_procedure_id?: string | null
          linked_routine_id?: string | null
          repeat_interval_min?: number | null
          trigger_offset_min?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          hook_type?: Database["public"]["Enums"]["session_hook_type"]
          id?: string
          is_active?: boolean
          linked_procedure_id?: string | null
          linked_routine_id?: string | null
          repeat_interval_min?: number | null
          trigger_offset_min?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_hook_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "session_hook_linked_procedure_id_fkey"
            columns: ["linked_procedure_id"]
            isOneToOne: false
            referencedRelation: "procedure"
            referencedColumns: ["procedure_id"]
          },
          {
            foreignKeyName: "session_hook_linked_routine_id_fkey"
            columns: ["linked_routine_id"]
            isOneToOne: false
            referencedRelation: "routine"
            referencedColumns: ["routine_id"]
          },
          {
            foreignKeyName: "session_hook_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "session_hook_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      session_note: {
        Row: {
          content: string
          created_at: string
          created_by: string
          department_session_id: string
          id: string
          note_type: Database["public"]["Enums"]["session_note_type"]
          workspace_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          department_session_id: string
          id?: string
          note_type?: Database["public"]["Enums"]["session_note_type"]
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          department_session_id?: string
          id?: string
          note_type?: Database["public"]["Enums"]["session_note_type"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_note_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "session_note_department_session_id_fkey"
            columns: ["department_session_id"]
            isOneToOne: false
            referencedRelation: "department_session"
            referencedColumns: ["department_session_id"]
          },
          {
            foreignKeyName: "session_note_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "session_note_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      session_task: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          department_session_id: string
          description: string | null
          evidence: Json | null
          id: string
          is_compliance_required: boolean
          session_hook_id: string | null
          status: Database["public"]["Enums"]["session_task_status"]
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          department_session_id: string
          description?: string | null
          evidence?: Json | null
          id?: string
          is_compliance_required?: boolean
          session_hook_id?: string | null
          status?: Database["public"]["Enums"]["session_task_status"]
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          department_session_id?: string
          description?: string | null
          evidence?: Json | null
          id?: string
          is_compliance_required?: boolean
          session_hook_id?: string | null
          status?: Database["public"]["Enums"]["session_task_status"]
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_task_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "session_task_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "session_task_department_session_id_fkey"
            columns: ["department_session_id"]
            isOneToOne: false
            referencedRelation: "department_session"
            referencedColumns: ["department_session_id"]
          },
          {
            foreignKeyName: "session_task_session_hook_id_fkey"
            columns: ["session_hook_id"]
            isOneToOne: false
            referencedRelation: "session_hook"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_task_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "session_task_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      settlement_image: {
        Row: {
          captured_by: string | null
          image_id: string
          image_type: Database["public"]["Enums"]["close_image_type"] | null
          ocr_confidence: number | null
          ocr_parsed: Json | null
          ocr_processed_at: string | null
          ocr_raw_text: string | null
          parse_status: string | null
          reconciliation_id: string
          source_type: Database["public"]["Enums"]["settlement_source_type"]
          storage_path: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string
          workspace_id: string
        }
        Insert: {
          captured_by?: string | null
          image_id?: string
          image_type?: Database["public"]["Enums"]["close_image_type"] | null
          ocr_confidence?: number | null
          ocr_parsed?: Json | null
          ocr_processed_at?: string | null
          ocr_raw_text?: string | null
          parse_status?: string | null
          reconciliation_id: string
          source_type: Database["public"]["Enums"]["settlement_source_type"]
          storage_path: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by: string
          workspace_id: string
        }
        Update: {
          captured_by?: string | null
          image_id?: string
          image_type?: Database["public"]["Enums"]["close_image_type"] | null
          ocr_confidence?: number | null
          ocr_parsed?: Json | null
          ocr_processed_at?: string | null
          ocr_raw_text?: string | null
          parse_status?: string | null
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
            foreignKeyName: "settlement_image_captured_by_fkey"
            columns: ["captured_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
            foreignKeyName: "shift_approval_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "v_shift_lifecycle"
            referencedColumns: ["shift_id"]
          },
          {
            foreignKeyName: "shift_approval_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "v_shift_lifecycle_employee"
            referencedColumns: ["shift_id"]
          },
          {
            foreignKeyName: "shift_approval_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
      shift_clock_config: {
        Row: {
          adhoc_requires_approval: boolean
          adhoc_shifts_enabled: boolean
          created_at: string
          department_id: string | null
          gps_radius_meters: number
          gps_reference_lat: number | null
          gps_reference_lng: number | null
          gps_required: boolean
          id: string
          punch_window_minutes: number
          team_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          adhoc_requires_approval?: boolean
          adhoc_shifts_enabled?: boolean
          created_at?: string
          department_id?: string | null
          gps_radius_meters?: number
          gps_reference_lat?: number | null
          gps_reference_lng?: number | null
          gps_required?: boolean
          id?: string
          punch_window_minutes?: number
          team_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          adhoc_requires_approval?: boolean
          adhoc_shifts_enabled?: boolean
          created_at?: string
          department_id?: string | null
          gps_radius_meters?: number
          gps_reference_lat?: number | null
          gps_reference_lng?: number | null
          gps_required?: boolean
          id?: string
          punch_window_minutes?: number
          team_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_clock_config_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "shift_clock_config_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "shift_clock_config_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "shift_clock_config_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      shift_cost_snapshot: {
        Row: {
          base_cost: number
          base_hours: number
          base_rate: number
          basis: Database["public"]["Enums"]["snapshot_basis"]
          calculated_at: string
          calculation_version: number
          effective_end: string | null
          effective_start: string | null
          gross_cost: number
          holiday_cost: number
          id: string
          interpretation_id: string | null
          night_cost: number
          overtime_cost: number
          payroll_profile_id: string | null
          profile_id: string | null
          regular_cost: number
          schedule_shift_id: string
          source_event: string | null
          supplements: Json
          tariff_rate_snapshot: Json
          total_cost: number
          workspace_id: string
        }
        Insert: {
          base_cost: number
          base_hours: number
          base_rate: number
          basis?: Database["public"]["Enums"]["snapshot_basis"]
          calculated_at?: string
          calculation_version?: number
          effective_end?: string | null
          effective_start?: string | null
          gross_cost?: number
          holiday_cost?: number
          id?: string
          interpretation_id?: string | null
          night_cost?: number
          overtime_cost?: number
          payroll_profile_id?: string | null
          profile_id?: string | null
          regular_cost?: number
          schedule_shift_id: string
          source_event?: string | null
          supplements?: Json
          tariff_rate_snapshot?: Json
          total_cost: number
          workspace_id: string
        }
        Update: {
          base_cost?: number
          base_hours?: number
          base_rate?: number
          basis?: Database["public"]["Enums"]["snapshot_basis"]
          calculated_at?: string
          calculation_version?: number
          effective_end?: string | null
          effective_start?: string | null
          gross_cost?: number
          holiday_cost?: number
          id?: string
          interpretation_id?: string | null
          night_cost?: number
          overtime_cost?: number
          payroll_profile_id?: string | null
          profile_id?: string | null
          regular_cost?: number
          schedule_shift_id?: string
          source_event?: string | null
          supplements?: Json
          tariff_rate_snapshot?: Json
          total_cost?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_cost_snapshot_interpretation_id_fkey"
            columns: ["interpretation_id"]
            isOneToOne: false
            referencedRelation: "shift_hour_interpretation"
            referencedColumns: ["interpretation_id"]
          },
          {
            foreignKeyName: "shift_cost_snapshot_interpretation_id_fkey"
            columns: ["interpretation_id"]
            isOneToOne: false
            referencedRelation: "v_shift_lifecycle"
            referencedColumns: ["interpretation_id"]
          },
          {
            foreignKeyName: "shift_cost_snapshot_interpretation_id_fkey"
            columns: ["interpretation_id"]
            isOneToOne: false
            referencedRelation: "v_shift_lifecycle_employee"
            referencedColumns: ["interpretation_id"]
          },
          {
            foreignKeyName: "shift_cost_snapshot_payroll_profile_id_fkey"
            columns: ["payroll_profile_id"]
            isOneToOne: false
            referencedRelation: "employee_payroll_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_cost_snapshot_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "shift_cost_snapshot_schedule_shift_id_fkey"
            columns: ["schedule_shift_id"]
            isOneToOne: false
            referencedRelation: "schedule_shift"
            referencedColumns: ["schedule_shift_id"]
          },
          {
            foreignKeyName: "shift_cost_snapshot_schedule_shift_id_fkey"
            columns: ["schedule_shift_id"]
            isOneToOne: false
            referencedRelation: "v_shift_lifecycle"
            referencedColumns: ["shift_id"]
          },
          {
            foreignKeyName: "shift_cost_snapshot_schedule_shift_id_fkey"
            columns: ["schedule_shift_id"]
            isOneToOne: false
            referencedRelation: "v_shift_lifecycle_employee"
            referencedColumns: ["shift_id"]
          },
          {
            foreignKeyName: "shift_cost_snapshot_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "shift_cost_snapshot_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      shift_hour_interpretation: {
        Row: {
          break_deductions: number
          created_at: string
          department_id: string | null
          derivation_version: number
          derived_at: string
          derived_by: string
          framework_rule_ids: string[]
          holiday_hours: number
          interpretation_id: string
          night_hours: number
          overtime_hours: number
          regular_hours: number
          shift_id: string
          time_entry_ids: string[]
          total_interpreted_hours: number
          updated_at: string
          weekend_hours: number
          workspace_id: string
        }
        Insert: {
          break_deductions?: number
          created_at?: string
          department_id?: string | null
          derivation_version?: number
          derived_at?: string
          derived_by?: string
          framework_rule_ids?: string[]
          holiday_hours?: number
          interpretation_id?: string
          night_hours?: number
          overtime_hours?: number
          regular_hours?: number
          shift_id: string
          time_entry_ids?: string[]
          total_interpreted_hours?: number
          updated_at?: string
          weekend_hours?: number
          workspace_id: string
        }
        Update: {
          break_deductions?: number
          created_at?: string
          department_id?: string | null
          derivation_version?: number
          derived_at?: string
          derived_by?: string
          framework_rule_ids?: string[]
          holiday_hours?: number
          interpretation_id?: string
          night_hours?: number
          overtime_hours?: number
          regular_hours?: number
          shift_id?: string
          time_entry_ids?: string[]
          total_interpreted_hours?: number
          updated_at?: string
          weekend_hours?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_hour_interpretation_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "shift_hour_interpretation_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "schedule_shift"
            referencedColumns: ["schedule_shift_id"]
          },
          {
            foreignKeyName: "shift_hour_interpretation_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "v_shift_lifecycle"
            referencedColumns: ["shift_id"]
          },
          {
            foreignKeyName: "shift_hour_interpretation_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "v_shift_lifecycle_employee"
            referencedColumns: ["shift_id"]
          },
          {
            foreignKeyName: "shift_hour_interpretation_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "shift_hour_interpretation_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      shift_note: {
        Row: {
          content: string
          created_at: string
          id: string
          profile_id: string
          shift_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          profile_id: string
          shift_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          profile_id?: string
          shift_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_note_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "shift_note_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "schedule_shift"
            referencedColumns: ["schedule_shift_id"]
          },
          {
            foreignKeyName: "shift_note_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "v_shift_lifecycle"
            referencedColumns: ["shift_id"]
          },
          {
            foreignKeyName: "shift_note_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "v_shift_lifecycle_employee"
            referencedColumns: ["shift_id"]
          },
          {
            foreignKeyName: "shift_note_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "shift_note_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      signup_progress: {
        Row: {
          auth_id: string
          completed: boolean
          created_at: string
          current_step: number
          id: string
          step_data: Json
          updated_at: string
        }
        Insert: {
          auth_id: string
          completed?: boolean
          created_at?: string
          current_step?: number
          id?: string
          step_data?: Json
          updated_at?: string
        }
        Update: {
          auth_id?: string
          completed?: boolean
          created_at?: string
          current_step?: number
          id?: string
          step_data?: Json
          updated_at?: string
        }
        Relationships: []
      }
      supplier: {
        Row: {
          address: string | null
          category: string | null
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          is_active: boolean
          name: string
          notes: string | null
          org_number: string | null
          payment_terms: string | null
          postal_code: string | null
          supplier_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          address?: string | null
          category?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          is_active?: boolean
          name: string
          notes?: string | null
          org_number?: string | null
          payment_terms?: string | null
          postal_code?: string | null
          supplier_id?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          address?: string | null
          category?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          org_number?: string | null
          payment_terms?: string | null
          postal_code?: string | null
          supplier_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "supplier_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      supplier_order: {
        Row: {
          created_at: string
          currency: string | null
          delivery_date: string | null
          delivery_rating: number | null
          department_id: string | null
          notes: string | null
          order_date: string
          order_id: string
          status: string
          supplier_id: string
          total_amount: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          delivery_date?: string | null
          delivery_rating?: number | null
          department_id?: string | null
          notes?: string | null
          order_date: string
          order_id?: string
          status?: string
          supplier_id: string
          total_amount?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          delivery_date?: string | null
          delivery_rating?: number | null
          department_id?: string | null
          notes?: string | null
          order_date?: string
          order_id?: string
          status?: string
          supplier_id?: string
          total_amount?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_order_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "supplier_order_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "supplier_order_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "supplier_order_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      tariff_rate_table: {
        Row: {
          amount: number
          created_at: string
          effective_from: string
          effective_until: string | null
          id: string
          metadata: Json | null
          profession_id: string | null
          provenance: Json
          rate_type: string
          seeded_at: string | null
          seeded_from_framework_binding_id: string | null
          seniority_years: number | null
          source: Database["public"]["Enums"]["tariff_source"]
          unit: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          effective_from: string
          effective_until?: string | null
          id?: string
          metadata?: Json | null
          profession_id?: string | null
          provenance?: Json
          rate_type: string
          seeded_at?: string | null
          seeded_from_framework_binding_id?: string | null
          seniority_years?: number | null
          source?: Database["public"]["Enums"]["tariff_source"]
          unit?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          metadata?: Json | null
          profession_id?: string | null
          provenance?: Json
          rate_type?: string
          seeded_at?: string | null
          seeded_from_framework_binding_id?: string | null
          seniority_years?: number | null
          source?: Database["public"]["Enums"]["tariff_source"]
          unit?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tariff_rate_table_profession_id_fkey"
            columns: ["profession_id"]
            isOneToOne: false
            referencedRelation: "profession"
            referencedColumns: ["profession_id"]
          },
          {
            foreignKeyName: "tariff_rate_table_seeded_from_framework_binding_id_fkey"
            columns: ["seeded_from_framework_binding_id"]
            isOneToOne: false
            referencedRelation: "workspace_framework_binding"
            referencedColumns: ["id"]
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
          source: string
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
          source?: string
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
          source?: string
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
      telegram_callback_action: {
        Row: {
          action_payload: Json
          action_type: string
          created_at: string
          id: string
          resolved: boolean
          resolved_at: string | null
          session_id: string
          updated_at: string
        }
        Insert: {
          action_payload: Json
          action_type: string
          created_at?: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          session_id: string
          updated_at?: string
        }
        Update: {
          action_payload?: Json
          action_type?: string
          created_at?: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_callback_action_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "engine_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_chat_bridge: {
        Row: {
          channel_id: string
          closed_at: string | null
          created_at: string
          id: string
          session_id: string
          status: string
          telegram_chat_id: number
          updated_at: string
        }
        Insert: {
          channel_id: string
          closed_at?: string | null
          created_at?: string
          id?: string
          session_id: string
          status?: string
          telegram_chat_id: number
          updated_at?: string
        }
        Update: {
          channel_id?: string
          closed_at?: string | null
          created_at?: string
          id?: string
          session_id?: string
          status?: string
          telegram_chat_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_chat_bridge_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_chat_bridge_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "engine_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_poll_action: {
        Row: {
          created_at: string
          id: string
          options: Json
          resolved: boolean
          resolved_at: string | null
          session_id: string
          telegram_poll_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          options: Json
          resolved?: boolean
          resolved_at?: string | null
          session_id: string
          telegram_poll_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          options?: Json
          resolved?: boolean
          resolved_at?: string | null
          session_id?: string
          telegram_poll_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_poll_action_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "engine_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_snapshot: {
        Row: {
          active_users: number
          billable_users: number
          company_id: string
          computed_at: string
          computed_by: string | null
          counted_profile_ids: Json
          free_users_applied: number
          period_from: string
          period_to: string
          source_query_hash: string
          usage_snapshot_id: string
          workspace_id: string
        }
        Insert: {
          active_users: number
          billable_users: number
          company_id: string
          computed_at?: string
          computed_by?: string | null
          counted_profile_ids: Json
          free_users_applied: number
          period_from: string
          period_to: string
          source_query_hash: string
          usage_snapshot_id?: string
          workspace_id: string
        }
        Update: {
          active_users?: number
          billable_users?: number
          company_id?: string
          computed_at?: string
          computed_by?: string | null
          counted_profile_ids?: Json
          free_users_applied?: number
          period_from?: string
          period_to?: string
          source_query_hash?: string
          usage_snapshot_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_snapshot_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "usage_snapshot_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "usage_snapshot_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "usage_snapshot_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
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
      waste_log: {
        Row: {
          category: Database["public"]["Enums"]["waste_category"]
          created_at: string
          department_id: string | null
          estimated_cost: number | null
          item_description: string
          quantity: number | null
          reason: string | null
          recorded_at: string
          recorded_by: string | null
          session_id: string | null
          unit: string | null
          updated_at: string
          waste_log_id: string
          workspace_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["waste_category"]
          created_at?: string
          department_id?: string | null
          estimated_cost?: number | null
          item_description: string
          quantity?: number | null
          reason?: string | null
          recorded_at?: string
          recorded_by?: string | null
          session_id?: string | null
          unit?: string | null
          updated_at?: string
          waste_log_id?: string
          workspace_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["waste_category"]
          created_at?: string
          department_id?: string | null
          estimated_cost?: number | null
          item_description?: string
          quantity?: number | null
          reason?: string | null
          recorded_at?: string
          recorded_by?: string | null
          session_id?: string | null
          unit?: string | null
          updated_at?: string
          waste_log_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waste_log_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "waste_log_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "waste_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "department_session"
            referencedColumns: ["department_session_id"]
          },
          {
            foreignKeyName: "waste_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "waste_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
          company_id: string | null
          contract_status: string | null
          country: Database["public"]["Enums"]["country"]
          cover_photo_url: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          deactivated_at: string | null
          description: string | null
          email: string | null
          extended_description: string | null
          google_maps_url: string | null
          google_place_id: string | null
          google_price_level: string | null
          google_rating: number | null
          google_rating_count: number | null
          grace_period_ends: string | null
          has_website: boolean
          intelligence_data: Json | null
          is_active: boolean
          is_searchable: boolean
          join_code: string | null
          language: Database["public"]["Enums"]["preferred_language"]
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          max_profiles: number | null
          name: string
          onboarding_completed: boolean
          onboarding_guide_progress: Json | null
          override_access: boolean | null
          override_expires: string | null
          override_note: string | null
          phone: string | null
          postal_code: string | null
          setup_guide_completed: boolean
          short_description: string | null
          slogan: string | null
          slug: string
          source: string
          status: Database["public"]["Enums"]["workspace_status"]
          suspended_at: string | null
          timezone: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          verification_deadline: string | null
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
          company_id?: string | null
          contract_status?: string | null
          country?: Database["public"]["Enums"]["country"]
          cover_photo_url?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          deactivated_at?: string | null
          description?: string | null
          email?: string | null
          extended_description?: string | null
          google_maps_url?: string | null
          google_place_id?: string | null
          google_price_level?: string | null
          google_rating?: number | null
          google_rating_count?: number | null
          grace_period_ends?: string | null
          has_website?: boolean
          intelligence_data?: Json | null
          is_active?: boolean
          is_searchable?: boolean
          join_code?: string | null
          language?: Database["public"]["Enums"]["preferred_language"]
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          max_profiles?: number | null
          name: string
          onboarding_completed?: boolean
          onboarding_guide_progress?: Json | null
          override_access?: boolean | null
          override_expires?: string | null
          override_note?: string | null
          phone?: string | null
          postal_code?: string | null
          setup_guide_completed?: boolean
          short_description?: string | null
          slogan?: string | null
          slug: string
          source?: string
          status?: Database["public"]["Enums"]["workspace_status"]
          suspended_at?: string | null
          timezone?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          verification_deadline?: string | null
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
          company_id?: string | null
          contract_status?: string | null
          country?: Database["public"]["Enums"]["country"]
          cover_photo_url?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          deactivated_at?: string | null
          description?: string | null
          email?: string | null
          extended_description?: string | null
          google_maps_url?: string | null
          google_place_id?: string | null
          google_price_level?: string | null
          google_rating?: number | null
          google_rating_count?: number | null
          grace_period_ends?: string | null
          has_website?: boolean
          intelligence_data?: Json | null
          is_active?: boolean
          is_searchable?: boolean
          join_code?: string | null
          language?: Database["public"]["Enums"]["preferred_language"]
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          max_profiles?: number | null
          name?: string
          onboarding_completed?: boolean
          onboarding_guide_progress?: Json | null
          override_access?: boolean | null
          override_expires?: string | null
          override_note?: string | null
          phone?: string | null
          postal_code?: string | null
          setup_guide_completed?: boolean
          short_description?: string | null
          slogan?: string | null
          slug?: string
          source?: string
          status?: Database["public"]["Enums"]["workspace_status"]
          suspended_at?: string | null
          timezone?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          verification_deadline?: string | null
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
          {
            foreignKeyName: "fk_workspace_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["company_id"]
          },
        ]
      }
      workspace_bootstrap_run: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: string | null
          error_payload: Json | null
          framework_binding_id: string | null
          id: string
          source_path: string
          started_at: string | null
          status: string
          steps_completed: string[] | null
          updated_at: string
          warnings: Json | null
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: string | null
          error_payload?: Json | null
          framework_binding_id?: string | null
          id?: string
          source_path: string
          started_at?: string | null
          status: string
          steps_completed?: string[] | null
          updated_at?: string
          warnings?: Json | null
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: string | null
          error_payload?: Json | null
          framework_binding_id?: string | null
          id?: string
          source_path?: string
          started_at?: string | null
          status?: string
          steps_completed?: string[] | null
          updated_at?: string
          warnings?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_bootstrap_run_framework_binding_id_fkey"
            columns: ["framework_binding_id"]
            isOneToOne: false
            referencedRelation: "workspace_framework_binding"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_bootstrap_run_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_bootstrap_run_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
      workspace_doc_chunk: {
        Row: {
          chunk_id: string
          chunk_index: number
          content: string
          content_hash: string
          created_at: string
          embedding: string | null
          metadata: Json
          source_hash: string
          source_id: string | null
          source_path: string
          source_type: string
          title: string | null
          token_count: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          chunk_id?: string
          chunk_index?: number
          content: string
          content_hash: string
          created_at?: string
          embedding?: string | null
          metadata?: Json
          source_hash: string
          source_id?: string | null
          source_path: string
          source_type: string
          title?: string | null
          token_count?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          chunk_id?: string
          chunk_index?: number
          content?: string
          content_hash?: string
          created_at?: string
          embedding?: string | null
          metadata?: Json
          source_hash?: string
          source_id?: string | null
          source_path?: string
          source_type?: string
          title?: string | null
          token_count?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_doc_chunk_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_doc_chunk_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      workspace_framework_binding: {
        Row: {
          activated_at: string
          activated_by: string | null
          created_at: string
          deactivated_at: string | null
          framework_id: string
          id: string
          is_active: boolean
          updated_at: string
          workspace_id: string
        }
        Insert: {
          activated_at?: string
          activated_by?: string | null
          created_at?: string
          deactivated_at?: string | null
          framework_id: string
          id?: string
          is_active?: boolean
          updated_at?: string
          workspace_id: string
        }
        Update: {
          activated_at?: string
          activated_by?: string | null
          created_at?: string
          deactivated_at?: string | null
          framework_id?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_framework_binding_activated_by_fkey"
            columns: ["activated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "workspace_framework_binding_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "regulatory_framework"
            referencedColumns: ["framework_id"]
          },
          {
            foreignKeyName: "workspace_framework_binding_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_framework_binding_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      workspace_kpi_copy: {
        Row: {
          created_at: string
          explanation: string
          id: string
          locale: string
          metric: string
          source: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          explanation: string
          id?: string
          locale?: string
          metric: string
          source?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          explanation?: string
          id?: string
          locale?: string
          metric?: string
          source?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_kpi_copy_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_kpi_copy_workspace_id_fkey"
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_kpi_target_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      workspace_note: {
        Row: {
          admin_id: string
          content: string
          created_at: string
          note_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          admin_id: string
          content: string
          created_at?: string
          note_id?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          admin_id?: string
          content?: string
          created_at?: string
          note_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_note_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "workspace_note_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_note_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      workspace_operating_hours: {
        Row: {
          close_time: string | null
          created_at: string
          day_of_week: number
          id: string
          is_closed: boolean | null
          open_time: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          close_time?: string | null
          created_at?: string
          day_of_week: number
          id?: string
          is_closed?: boolean | null
          open_time?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          close_time?: string | null
          created_at?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean | null
          open_time?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_operating_hours_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_operating_hours_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      workspace_rule_override: {
        Row: {
          approved_by: string | null
          created_at: string
          id: string
          override_config: Json | null
          override_outcome:
            | Database["public"]["Enums"]["evaluation_outcome"]
            | null
          reason: string
          rule_id: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          workspace_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          id?: string
          override_config?: Json | null
          override_outcome?:
            | Database["public"]["Enums"]["evaluation_outcome"]
            | null
          reason: string
          rule_id: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          workspace_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          id?: string
          override_config?: Json | null
          override_outcome?:
            | Database["public"]["Enums"]["evaluation_outcome"]
            | null
          reason?: string
          rule_id?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_rule_override_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "workspace_rule_override_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "framework_rule"
            referencedColumns: ["rule_id"]
          },
          {
            foreignKeyName: "workspace_rule_override_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_rule_override_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      workspace_trigger_override: {
        Row: {
          approved_by: string | null
          created_at: string
          id: string
          is_disabled: boolean
          override_config: Json | null
          reason: string
          trigger_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          id?: string
          is_disabled?: boolean
          override_config?: Json | null
          reason: string
          trigger_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          id?: string
          is_disabled?: boolean
          override_config?: Json | null
          reason?: string
          trigger_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_trigger_override_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "workspace_trigger_override_trigger_id_fkey"
            columns: ["trigger_id"]
            isOneToOne: false
            referencedRelation: "framework_trigger"
            referencedColumns: ["trigger_id"]
          },
          {
            foreignKeyName: "workspace_trigger_override_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "workspace_trigger_override_workspace_id_fkey"
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
      compliance_drift: {
        Row: {
          computed_at: string | null
          contract_id: string | null
          drift: Json | null
          framework_id: string | null
          framework_snapshot: Json | null
          profile_id: string | null
          workspace_id: string | null
        }
        Relationships: [
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
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
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
      v_current_plan_preview: {
        Row: {
          active_users_current_month: number | null
          billing_interval: string | null
          company_id: string | null
          company_name: string | null
          delivery_channel: string | null
          free_users: number | null
          invoice_format: string | null
          monthly_cost: number | null
          overage_price_per_user: number | null
          price_per_employee: number | null
          pricing_terms_id: string | null
          workspace_id: string | null
          workspace_name: string | null
        }
        Relationships: []
      }
      v_invoice_dunning_notes: {
        Row: {
          actor_user_id: string | null
          billing_log_id: number | null
          company_id: string | null
          contact_channel: string | null
          created_at: string | null
          invoice_id: string | null
          note: string | null
          source: string | null
        }
        Insert: {
          actor_user_id?: string | null
          billing_log_id?: number | null
          company_id?: string | null
          contact_channel?: never
          created_at?: string | null
          invoice_id?: string | null
          note?: never
          source?: string | null
        }
        Update: {
          actor_user_id?: string | null
          billing_log_id?: number | null
          company_id?: string | null
          contact_channel?: never
          created_at?: string | null
          invoice_id?: string | null
          note?: never
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_activity_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "user_identity"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "billing_activity_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "billing_activity_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "billing_activity_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice"
            referencedColumns: ["invoice_id"]
          },
        ]
      }
      v_shift_lifecycle: {
        Row: {
          approval_id: string | null
          approval_status:
            | Database["public"]["Enums"]["shift_approval_status"]
            | null
          approved_hours: number | null
          cost_snapshot_id: string | null
          department_id: string | null
          employee_id: string | null
          gross_cost: number | null
          has_blocking_deviation: boolean | null
          has_deviation: boolean | null
          interpretation_id: string | null
          interpreted_hours: number | null
          last_punch_in: string | null
          last_punch_out: string | null
          phase: string | null
          reconciliation_id: string | null
          reconciliation_status:
            | Database["public"]["Enums"]["reconciliation_status"]
            | null
          scheduled_hours: number | null
          session_status:
            | Database["public"]["Enums"]["department_session_status"]
            | null
          shift_date: string | null
          shift_id: string | null
          shift_status: Database["public"]["Enums"]["shift_status"] | null
          time_entry_status:
            | Database["timesheet"]["Enums"]["time_entry_status"]
            | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_shift_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "schedule_shift_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "schedule_shift_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "schedule_shift_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "shift_approval_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "daily_reconciliation"
            referencedColumns: ["reconciliation_id"]
          },
        ]
      }
      v_shift_lifecycle_employee: {
        Row: {
          approval_id: string | null
          approval_status:
            | Database["public"]["Enums"]["shift_approval_status"]
            | null
          approved_hours: number | null
          department_id: string | null
          employee_id: string | null
          has_blocking_deviation: boolean | null
          has_deviation: boolean | null
          interpretation_id: string | null
          interpreted_hours: number | null
          last_punch_in: string | null
          last_punch_out: string | null
          phase: string | null
          reconciliation_id: string | null
          reconciliation_status:
            | Database["public"]["Enums"]["reconciliation_status"]
            | null
          scheduled_hours: number | null
          session_status:
            | Database["public"]["Enums"]["department_session_status"]
            | null
          shift_date: string | null
          shift_id: string | null
          shift_status: Database["public"]["Enums"]["shift_status"] | null
          time_entry_status:
            | Database["timesheet"]["Enums"]["time_entry_status"]
            | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_shift_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "schedule_shift_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "schedule_shift_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_current_plan_preview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "schedule_shift_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "shift_approval_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "daily_reconciliation"
            referencedColumns: ["reconciliation_id"]
          },
        ]
      }
    }
    Functions: {
      _role_rank: { Args: { p_role: string }; Returns: number }
      activate_season: {
        Args: { p_season_id: string; p_workspace_id: string }
        Returns: Json
      }
      activate_workspace_v3: {
        Args: { p_data: Json; p_user_id: string }
        Returns: string
      }
      admin_submit_employee_pii: {
        Args: {
          p_field_group: string
          p_profile_id: string
          p_reason: string
          p_values: Json
        }
        Returns: Json
      }
      anonymize_contract: {
        Args: { p_contract_id: string }
        Returns: undefined
      }
      anonymize_user: { Args: { target_user_id: string }; Returns: undefined }
      append_conversation_turn: {
        Args: { p_session_id: string; p_turn: Json }
        Returns: undefined
      }
      approve_shift_swap: {
        Args: { p_approved: boolean; p_reason?: string; p_swap_id: string }
        Returns: undefined
      }
      archive_completed_engine_states: {
        Args: { p_retention_days?: number }
        Returns: number
      }
      archive_onboarding_workspaces: {
        Args: { p_workspace_ids: string[] }
        Returns: undefined
      }
      assert_gate_caller: {
        Args: { p_actor_profile_id: string }
        Returns: undefined
      }
      can_override_schedule_shift_lock: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      can_read_shift_cost: { Args: { wid: string }; Returns: boolean }
      cancel_shift_swap: {
        Args: { p_swap_id: string }
        Returns: {
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
          workspace_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "engine_state"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      canonical_json: { Args: { input: Json }; Returns: Json }
      cascade_gate_write: {
        Args: {
          p_action: string
          p_actor_profile_id: string
          p_capability: string
          p_current_data: Json
          p_entity_id: string
          p_entity_type: string
          p_proposed_data: Json
          p_workspace_id: string
        }
        Returns: Json
      }
      check_assignment_completion_fn_direct: {
        Args: { p_assignment_id: string }
        Returns: undefined
      }
      check_contract_intake_completion: {
        Args: { p_profile_id: string; p_workspace_id: string }
        Returns: Json
      }
      cleanup_expired_api_keys: { Args: never; Returns: number }
      compute_compliance_diff: {
        Args: { p_framework_id: string; p_snapshot: Json }
        Returns: Json
      }
      compute_platform_metrics: { Args: never; Returns: undefined }
      count_dangling_company_members: { Args: never; Returns: number }
      count_empty_workspaces: { Args: never; Returns: number }
      create_channel: {
        Args: {
          p_channel_type: Database["public"]["Enums"]["comm_channel_type"]
          p_created_by?: string
          p_member_profile_ids?: string[]
          p_name?: string
          p_workspace_id: string
        }
        Returns: Json
      }
      create_dm_conversation: {
        Args: {
          p_creator_profile_id: string
          p_name?: string
          p_target_profile_id: string
          p_workspace_id: string
        }
        Returns: string
      }
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
      decline_contract_intake: {
        Args: {
          p_profile_id: string
          p_reason?: string
          p_workspace_id: string
        }
        Returns: Json
      }
      decrypt_envelope: {
        Args: { p_envelope_id: string }
        Returns: {
          pii_class: string
          raw: string
          workspace_id: string
        }[]
      }
      delete_vault_secret: { Args: { secret_name: string }; Returns: boolean }
      derive_shift_hours: { Args: { p_shift_id: string }; Returns: Json }
      dispatch_push_notification: {
        Args: {
          p_body: string
          p_data?: Json
          p_event: string
          p_profile_id: string
          p_title: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      dispatch_swap_notification: {
        Args: {
          p_body: string
          p_event_key: string
          p_metadata?: Json
          p_recipient_id: string
          p_title: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      effective_dispatch_rules: {
        Args: { p_invoice_id: string; p_trigger_event: string }
        Returns: {
          action: Database["public"]["Enums"]["dispatch_rule_action"]
          channel: Database["public"]["Enums"]["billing_dispatch_channel"]
          company_id: string
          dispatch_rule_id: string
          is_enabled: boolean
          rule_source: string
          target: Json
          template_id: string
          trigger_event: string
          workspace_id: string
        }[]
      }
      expire_stale_invitations: { Args: never; Returns: number }
      fetch_pending_outbox: {
        Args: { p_batch_size?: number }
        Returns: {
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
          retry_count: number
          scheduled_for: string | null
          status: Database["public"]["Enums"]["notification_status"] | null
          title: string
          updated_at: string
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      finalize_onboarding_workspace: {
        Args: { p_data: Json; p_workspace_id: string }
        Returns: string
      }
      gate_action: {
        Args: {
          p_action_type: string
          p_actor_profile_id: string
          p_approvers_present?: string[]
          p_capability: string
          p_channel: string
          p_engine_process_id?: string
          p_engine_state_id?: string
          p_entity_id?: string
          p_workspace_id: string
        }
        Returns: Json
      }
      generate_contract_number: { Args: never; Returns: string }
      get_api_workspace_id: { Args: never; Returns: string }
      get_channel_messages: {
        Args: { p_channel_id: string; p_cursor?: string; p_limit?: number }
        Returns: {
          attachments: Json
          channel_id: string
          client_message_id: string
          content: string
          created_at: string
          deleted_at: string
          edited_at: string
          is_pinned: boolean
          message_id: string
          message_type: Database["public"]["Enums"]["channel_message_type"]
          origin_type: Database["public"]["Enums"]["channel_origin_type"]
          reactions: Json
          reply_to_content: string
          reply_to_id: string
          reply_to_sender_name: string
          sender_avatar: string
          sender_id: string
          sender_name: string
          sender_role: string
          system_data: Json
          visibility_scope: Database["public"]["Enums"]["channel_message_visibility"]
        }[]
      }
      get_invitation_by_token: { Args: { p_token: string }; Returns: Json }
      get_invoice_basis: {
        Args: { p_invoice_id: string }
        Returns: {
          amount_excl_vat: number
          amount_incl_vat: number
          company_id: string
          company_name: string
          currency: string
          invoice_id: string
          invoice_number: number
          issued_at: string
          line_items: Json
          period_from: string
          period_to: string
          pricing_terms_at_issue: Json
          status: string
          usage_snapshots: Json
          vat_amount: number
          vat_rate: number
        }[]
      }
      get_my_channels: {
        Args: { p_workspace_id: string }
        Returns: {
          audio_policy: Database["public"]["Enums"]["channel_audio_policy"]
          avatar_url: string
          channel_id: string
          channel_type: Database["public"]["Enums"]["comm_channel_type"]
          description: string
          is_archived: boolean
          is_read_only: boolean
          last_message_at: string
          last_message_content: string
          last_message_sender_avatar: string
          last_message_sender_name: string
          member_count: number
          name: string
          other_member_avatar: string
          other_member_name: string
          other_member_profile_id: string
          unread_count: number
          video_policy: Database["public"]["Enums"]["channel_video_policy"]
          workspace_id: string
        }[]
      }
      get_schedule_shift_lock_mode: {
        Args: { p_workspace_id: string }
        Returns: string
      }
      get_secret: { Args: { secret_name: string }; Returns: string }
      get_unread_counts: {
        Args: { p_workspace_id: string }
        Returns: {
          channel_id: string
          unread_count: number
        }[]
      }
      get_workspace_ids_for_user: { Args: { uid: string }; Returns: string[] }
      get_workspace_readiness: {
        Args: { p_workspace_id: string }
        Returns: {
          completed: number
          profile_id: string
          total: number
        }[]
      }
      handle_schedule_shift_lock_violation: {
        Args: {
          p_new_row: Json
          p_old_row: Json
          p_operation: string
          p_reason_code: string
          p_schedule_shift_id: string
          p_shift_date: string
          p_start_time: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      increment_communication_counter: {
        Args: { p_communication_id: string; p_field: string }
        Returns: undefined
      }
      initiate_shift_swap: {
        Args: {
          p_reason?: string
          p_requester_shift_id: string
          p_target_profile_id: string
          p_target_shift_id: string
        }
        Returns: string
      }
      is_admin_in_company: {
        Args: { p_company_id: string; p_user_id: string }
        Returns: boolean
      }
      is_admin_in_workspace: {
        Args: { uid: string; wid: string }
        Returns: boolean
      }
      is_email_verified: { Args: { user_uuid: string }; Returns: boolean }
      is_participant_in_conversation: {
        Args: { conv_id: string }
        Returns: boolean
      }
      log_api_key_usage: {
        Args: { p_endpoint: string; p_key_id: string; p_status: number }
        Returns: undefined
      }
      lookup_workspace_by_code: {
        Args: { code: string }
        Returns: {
          logo_url: string
          name: string
          workspace_id: string
        }[]
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
      match_workspace_docs: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_workspace_id: string
          query_embedding: string
        }
        Returns: {
          chunk_id: string
          content: string
          similarity: number
          source_path: string
          source_type: string
          title: string
        }[]
      }
      provision_onboarding_workspace: {
        Args: {
          p_company_name: string
          p_intelligence_data?: Json
          p_user_id: string
        }
        Returns: string
      }
      record_schedule_shift_lock_audit:
        | {
            Args: {
              p_is_enforced: boolean
              p_is_overridden_by_high_access: boolean
              p_lock_mode: string
              p_new_row: Json
              p_old_row: Json
              p_operation: string
              p_reason_code: string
              p_schedule_shift_id: string
              p_shift_date: string
              p_start_time: string
              p_workspace_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_is_enforced: boolean
              p_lock_mode: string
              p_new_row: Json
              p_old_row: Json
              p_operation: string
              p_reason_code: string
              p_schedule_shift_id: string
              p_shift_date: string
              p_start_time: string
              p_workspace_id: string
            }
            Returns: undefined
          }
      resolve_cascade_tasks: { Args: { p_workspace_id: string }; Returns: Json }
      respond_to_shift_swap: {
        Args: { p_accepted: boolean; p_reason?: string; p_swap_id: string }
        Returns: undefined
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
      schedule_shift_is_temporally_locked: {
        Args: {
          p_shift_date: string
          p_start_time: string
          p_workspace_id: string
        }
        Returns: boolean
      }
      search_dependency_graph: {
        Args: { p_limit?: number; p_query: string; p_workspace_id: string }
        Returns: {
          policy_id: string
          policy_name: string
          procedure_id: string
          procedure_name: string
          protocol_id: string
          protocol_name: string
        }[]
      }
      search_instance: {
        Args: { p_limit?: number; p_query: string; p_workspace_id: string }
        Returns: {
          deep_link: string
          group_name: string
          relevance: number
          result_id: string
          subtitle: string
          title: string
        }[]
      }
      search_workspaces: {
        Args: { query: string }
        Returns: {
          logo_url: string
          name: string
          workspace_id: string
        }[]
      }
      seed_onboarding_journey: {
        Args: { p_workspace_id: string }
        Returns: string
      }
      snapshot_shift_cost: {
        Args: { p_interpretation_id: string }
        Returns: Json
      }
      submit_own_pii: {
        Args: { p_field_group: string; p_values: Json; p_workspace_id: string }
        Returns: Json
      }
      track_invitation_opened: { Args: { p_token: string }; Returns: boolean }
      trigger_due_emma_tasks: { Args: never; Returns: number }
      upsert_secret: {
        Args: { p_description?: string; p_name: string; p_secret: string }
        Returns: string
      }
    }
    Enums: {
      absence_status: "pending" | "approved" | "rejected"
      anchor_type: "fixed" | "open" | "close"
      api_key_type: "workspace" | "service"
      api_key_version_status: "current" | "previous" | "revoked"
      asset_type: "equipment" | "safety" | "storage" | "station" | "other"
      assignment_source:
        | "workspace"
        | "department"
        | "team"
        | "location"
        | "position"
        | "manual"
        | "season"
      audit_operation: "INSERT" | "UPDATE" | "DELETE"
      auth_provider: "supabase" | "google" | "microsoft"
      authority_level: "duty" | "deputy" | "leader"
      billing_dispatch_channel:
        | "email_customer"
        | "email_internal"
        | "http_api"
        | "peppol_ehf"
        | "stripe_invoice"
      billing_integration_type: "fiken" | "tripletex" | "stripe" | "placeholder"
      booking_status: "confirmed" | "pending" | "cancelled"
      budget_period_type: "monthly" | "weekly" | "daily" | "hourly"
      budget_status: "draft" | "active" | "locked"
      cascade_initiator:
        | "cascade_engine"
        | "admin_manual"
        | "c1_calibration"
        | "bootstrap"
      change_proposal_status:
        | "pending"
        | "approved"
        | "applied"
        | "rejected"
        | "expired"
        | "failed"
      channel_ai_text_mode: "disabled" | "mention_only" | "proactive"
      channel_ai_voice_mode: "disabled" | "listen_only" | "interactive"
      channel_ai_voice_policy: "disabled" | "listen_only" | "interactive"
      channel_audio_policy: "disabled" | "ptt" | "open_mic" | "listen_only"
      channel_call_status: "active" | "ending" | "ended"
      channel_call_type: "direct" | "group" | "ptt"
      channel_delivery_mode: "timeline" | "silent" | "notification_only"
      channel_integration_status: "active" | "paused" | "error"
      channel_member_role: "member" | "admin" | "representative"
      channel_message_type:
        | "text"
        | "image"
        | "file"
        | "voice_clip"
        | "system"
        | "brief"
        | "handoff"
        | "announcement"
        | "reminder"
        | "summary"
      channel_message_visibility: "all_members" | "admins" | "targeted_members"
      channel_notification_priority: "critical" | "high" | "normal" | "low"
      channel_origin_type:
        | "human"
        | "ai"
        | "system"
        | "webhook"
        | "scheduler"
        | "workflow"
      channel_presence_status: "online" | "away" | "offline"
      channel_privacy_mode: "public" | "private_per_requester"
      channel_recording_policy: "off" | "optional" | "auto"
      channel_video_policy: "disabled" | "optional" | "default_on" | "required"
      chat_conversation_type: "group" | "dm" | "ai"
      close_image_type:
        | "isettle_settlement"
        | "pos_closing_screen"
        | "z_report"
        | "cash_drawer"
        | "receipt_bundle"
        | "other"
      comm_channel_type:
        | "department"
        | "team"
        | "session"
        | "custom"
        | "direct"
        | "news"
        | "skill"
        | "desk"
        | "query_thread"
      communication_channel: "email" | "sms" | "push" | "in_app"
      communication_status:
        | "pending"
        | "sent"
        | "delivered"
        | "failed"
        | "opened"
        | "clicked"
      company_member_role: "owner" | "admin" | "member"
      config_change_type: "runtime" | "restart"
      contract_status:
        | "draft"
        | "sent"
        | "viewed"
        | "signed"
        | "expired"
        | "terminated"
        | "pending_data"
        | "declined"
        | "ready_to_send"
        | "migration_incomplete"
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
      department_type: "operational" | "administrative" | "hybrid"
      deviation_domain:
        | "safety"
        | "customer"
        | "procedure"
        | "system"
        | "material"
      deviation_severity: "low" | "medium" | "high" | "critical"
      deviation_status: "open" | "acknowledged" | "resolved" | "escalated"
      dispatch_rule_action: "send" | "suppress"
      dispatch_status:
        | "pending"
        | "in_flight"
        | "delivered"
        | "failed"
        | "bounced"
      doc_type:
        | "adr"
        | "module"
        | "architecture"
        | "cross_cutting"
        | "plan"
        | "research"
        | "roadmap"
        | "other"
      dunning_status:
        | "none"
        | "in_negotiation"
        | "reminder_sent"
        | "escalated"
        | "reminder_1"
        | "reminder_2"
        | "collection_notice"
      enforcement_status: "aspirational" | "enforced"
      evaluation_outcome:
        | "allowed"
        | "allowed_with_exception"
        | "review_required"
        | "blocked"
      evidence_tier:
        | "quiz"
        | "quiz_plus_observer"
        | "quiz_plus_observer_plus_confirmation"
        | "four_eyes"
      external_provider: "tripletex" | "planday" | "visma"
      framework_rule_type: "gate" | "constraint" | "advisory" | "commercial"
      framework_trigger_mode:
        | "state_change"
        | "time_based"
        | "threshold"
        | "external_event"
      framework_trigger_type:
        | "operating_hours"
        | "season_transition"
        | "template_change"
        | "event_added"
        | "manual_override"
        | "framework_rule_change"
        | "external_sync"
      industry: "restaurant" | "hotel" | "cafe" | "bar" | "catering" | "other"
      invite_status: "pending" | "accepted" | "expired" | "cancelled"
      invite_type: "email" | "sms" | "link"
      invoice_line_type:
        | "base_plan"
        | "user_overage"
        | "addon"
        | "onboarding"
        | "adjustment"
      invoice_status:
        | "draft"
        | "issued"
        | "sent"
        | "paid"
        | "overdue"
        | "void"
        | "uncollectible"
      invoice_type: "recurring" | "onboarding" | "credit_note" | "one_off"
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
      journey_test_type: "automated" | "manual" | "protocol"
      journey_version_status:
        | "draft"
        | "ready_test"
        | "testing"
        | "ready_publish"
        | "published"
        | "archived"
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
      notification_channel: "push" | "sms" | "email" | "voice" | "in_app"
      notification_mode: "training" | "work" | "community"
      notification_status:
        | "pending"
        | "processing"
        | "delivered"
        | "failed"
        | "suppressed"
      observer_request_status:
        | "pending"
        | "claimed"
        | "approved"
        | "rejected"
        | "expired"
      payment_method_type:
        | "stripe_card"
        | "stripe_bank"
        | "bank_transfer"
        | "manual_adjustment"
        | "accountant_manual"
      payment_status:
        | "pending"
        | "processing"
        | "succeeded"
        | "failed"
        | "refunded"
        | "partially_refunded"
      planning_cycle_status: "draft" | "active" | "archived"
      planning_event_category:
        | "external_scraped"
        | "cultural_commercial"
        | "internal"
        | "weather"
        | "recurring"
      planning_event_source:
        | "manual"
        | "scraped_municipality"
        | "scraped_cultural"
        | "weather_api"
        | "booking_integration"
        | "historical_import"
      policy_scope: "workspace" | "department" | "team" | "location"
      policy_type:
        | "operational"
        | "haccp"
        | "hr"
        | "safety"
        | "access"
        | "payroll"
        | "custom"
        | "ai_operations"
      preferred_language: "no" | "sv" | "en" | "da" | "fi"
      procedure_type:
        | "standard"
        | "onboarding"
        | "safety"
        | "maintenance"
        | "custom"
      profile_role: "employee" | "manager" | "admin" | "owner" | "system"
      profile_status: "trainee" | "active" | "inactive" | "offboarding"
      protocol_assignment_status:
        | "pending"
        | "completed"
        | "expired"
        | "not_started"
        | "in_progress"
        | "waived"
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
      season_goal_status: "active" | "completed" | "cancelled"
      season_status: "draft" | "active" | "archived"
      season_type: "default" | "calendar" | "focus" | "cycle" | "custom"
      service_status: "active" | "stopped" | "error" | "unconfigured"
      service_type: "docker" | "vercel" | "edge-function" | "external"
      session_hook_type:
        | "pre_open"
        | "open"
        | "scheduled"
        | "pre_close"
        | "close"
      session_note_type: "handoff" | "closing" | "general"
      session_task_status:
        | "pending"
        | "available"
        | "in_progress"
        | "completed"
        | "skipped"
        | "overdue"
        | "escalated"
      settlement_source_type:
        | "pos"
        | "terminal"
        | "z_report"
        | "cash_count"
        | "other"
      shift_approval_status: "pending" | "approved" | "edited" | "disputed"
      shift_function:
        | "opening"
        | "closing"
        | "supporting"
        | "rush_hour"
        | "sub_supply"
      shift_status:
        | "created"
        | "assigned"
        | "published"
        | "active"
        | "completed"
        | "unpublished"
      snapshot_basis: "planned" | "actual"
      supplement_claim_status: "pending" | "approved" | "rejected"
      sync_direction: "inbound" | "outbound" | "bidirectional"
      sync_status: "pending" | "synced" | "failed" | "conflict"
      tariff_source: "riksavtalen" | "allmenngjoring" | "internal"
      team_type:
        | "operational"
        | "access"
        | "cross_department"
        | "seasonal"
        | "custom"
      trigger_type: "scheduled" | "event"
      waste_category:
        | "food_prep"
        | "food_spoilage"
        | "food_overproduction"
        | "food_returned"
        | "beverage"
        | "packaging"
        | "other"
      wizard_phase:
        | "discovery"
        | "classification"
        | "steps"
        | "testing"
        | "documentation"
        | "review"
      wizard_session_status: "active" | "completed" | "abandoned"
      workspace_status: "sandbox" | "active" | "suspended" | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  timesheet: {
    Tables: {
      time_entry: {
        Row: {
          break_locations: Json | null
          breaks: Json | null
          created_at: string
          notes: string | null
          profile_id: string
          punch_in: string
          punch_in_location: Json | null
          punch_out: string | null
          punch_out_location: Json | null
          shift_id: string
          source: string
          status: Database["timesheet"]["Enums"]["time_entry_status"]
          time_entry_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          break_locations?: Json | null
          breaks?: Json | null
          created_at?: string
          notes?: string | null
          profile_id: string
          punch_in: string
          punch_in_location?: Json | null
          punch_out?: string | null
          punch_out_location?: Json | null
          shift_id: string
          source?: string
          status?: Database["timesheet"]["Enums"]["time_entry_status"]
          time_entry_id?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          break_locations?: Json | null
          breaks?: Json | null
          created_at?: string
          notes?: string | null
          profile_id?: string
          punch_in?: string
          punch_in_location?: Json | null
          punch_out?: string | null
          punch_out_location?: Json | null
          shift_id?: string
          source?: string
          status?: Database["timesheet"]["Enums"]["time_entry_status"]
          time_entry_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      time_entry_status: "clocked_in" | "completed" | "edited"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  websites: {
    Tables: {
      website: {
        Row: {
          booking_provider: string
          booking_url: string | null
          contact_address: Json | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          default_meta_description: string | null
          default_meta_title: string | null
          default_og_image_path: string | null
          deleted_at: string | null
          name: string
          site_slug: string
          social_links: Json | null
          tagline: string | null
          template_key: string
          template_version: number
          theme: Json
          updated_at: string
          visibility: string
          website_id: string
          workspace_id: string
        }
        Insert: {
          booking_provider?: string
          booking_url?: string | null
          contact_address?: Json | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          default_meta_description?: string | null
          default_meta_title?: string | null
          default_og_image_path?: string | null
          deleted_at?: string | null
          name: string
          site_slug: string
          social_links?: Json | null
          tagline?: string | null
          template_key: string
          template_version: number
          theme?: Json
          updated_at?: string
          visibility?: string
          website_id?: string
          workspace_id: string
        }
        Update: {
          booking_provider?: string
          booking_url?: string | null
          contact_address?: Json | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          default_meta_description?: string | null
          default_meta_title?: string | null
          default_og_image_path?: string | null
          deleted_at?: string | null
          name?: string
          site_slug?: string
          social_links?: Json | null
          tagline?: string | null
          template_key?: string
          template_version?: number
          theme?: Json
          updated_at?: string
          visibility?: string
          website_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      website_asset: {
        Row: {
          alt_text: string
          created_at: string
          deleted_at: string | null
          file_name: string
          file_size_bytes: number | null
          height: number | null
          mime_type: string
          storage_path: string
          updated_at: string
          uploaded_by: string | null
          website_asset_id: string
          website_id: string
          width: number | null
          workspace_id: string
        }
        Insert: {
          alt_text?: string
          created_at?: string
          deleted_at?: string | null
          file_name: string
          file_size_bytes?: number | null
          height?: number | null
          mime_type: string
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
          website_asset_id?: string
          website_id: string
          width?: number | null
          workspace_id: string
        }
        Update: {
          alt_text?: string
          created_at?: string
          deleted_at?: string | null
          file_name?: string
          file_size_bytes?: number | null
          height?: number | null
          mime_type?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
          website_asset_id?: string
          website_id?: string
          width?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_asset_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "website"
            referencedColumns: ["website_id"]
          },
        ]
      }
      website_domain: {
        Row: {
          created_at: string
          deleted_at: string | null
          domain: string
          domain_type: string
          hostname: string | null
          is_primary: boolean
          is_verified: boolean
          redirect_behavior: string
          ssl_status: string
          status: string
          updated_at: string
          verification_token: string | null
          verified_at: string | null
          website_domain_id: string
          website_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          domain: string
          domain_type: string
          hostname?: string | null
          is_primary?: boolean
          is_verified?: boolean
          redirect_behavior?: string
          ssl_status?: string
          status?: string
          updated_at?: string
          verification_token?: string | null
          verified_at?: string | null
          website_domain_id?: string
          website_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          domain?: string
          domain_type?: string
          hostname?: string | null
          is_primary?: boolean
          is_verified?: boolean
          redirect_behavior?: string
          ssl_status?: string
          status?: string
          updated_at?: string
          verification_token?: string | null
          verified_at?: string | null
          website_domain_id?: string
          website_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_domain_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "website"
            referencedColumns: ["website_id"]
          },
        ]
      }
      website_draft_revision: {
        Row: {
          change_summary: string | null
          changed_by: string | null
          created_at: string
          created_by: string | null
          draft_data: Json | null
          revision_id: string
          revision_number: number | null
          schema_version: number | null
          source: string
          template_key: string | null
          template_version: number | null
          website_id: string
          workspace_id: string
        }
        Insert: {
          change_summary?: string | null
          changed_by?: string | null
          created_at?: string
          created_by?: string | null
          draft_data?: Json | null
          revision_id?: string
          revision_number?: number | null
          schema_version?: number | null
          source: string
          template_key?: string | null
          template_version?: number | null
          website_id: string
          workspace_id: string
        }
        Update: {
          change_summary?: string | null
          changed_by?: string | null
          created_at?: string
          created_by?: string | null
          draft_data?: Json | null
          revision_id?: string
          revision_number?: number | null
          schema_version?: number | null
          source?: string
          template_key?: string | null
          template_version?: number | null
          website_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_draft_revision_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "website"
            referencedColumns: ["website_id"]
          },
        ]
      }
      website_menu: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          is_visible: boolean
          name: string
          pdf_storage_path: string | null
          sort_order: number
          source_type: string
          updated_at: string
          website_id: string
          website_menu_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          is_visible?: boolean
          name: string
          pdf_storage_path?: string | null
          sort_order?: number
          source_type?: string
          updated_at?: string
          website_id: string
          website_menu_id?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          is_visible?: boolean
          name?: string
          pdf_storage_path?: string | null
          sort_order?: number
          source_type?: string
          updated_at?: string
          website_id?: string
          website_menu_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_menu_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "website"
            referencedColumns: ["website_id"]
          },
        ]
      }
      website_menu_category: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          name: string
          sort_order: number
          updated_at: string
          website_id: string
          website_menu_category_id: string
          website_menu_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          name: string
          sort_order?: number
          updated_at?: string
          website_id: string
          website_menu_category_id?: string
          website_menu_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
          website_id?: string
          website_menu_category_id?: string
          website_menu_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_menu_category_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "website"
            referencedColumns: ["website_id"]
          },
          {
            foreignKeyName: "website_menu_category_website_menu_id_fkey"
            columns: ["website_menu_id"]
            isOneToOne: false
            referencedRelation: "website_menu"
            referencedColumns: ["website_menu_id"]
          },
        ]
      }
      website_menu_item: {
        Row: {
          allergens: string[] | null
          created_at: string
          currency: string
          deleted_at: string | null
          description: string | null
          dietary_tags: string[] | null
          image_asset_id: string | null
          is_visible: boolean
          name: string
          price: number | null
          sort_order: number
          updated_at: string
          website_id: string
          website_menu_category_id: string
          website_menu_item_id: string
          workspace_id: string
        }
        Insert: {
          allergens?: string[] | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          dietary_tags?: string[] | null
          image_asset_id?: string | null
          is_visible?: boolean
          name: string
          price?: number | null
          sort_order?: number
          updated_at?: string
          website_id: string
          website_menu_category_id: string
          website_menu_item_id?: string
          workspace_id: string
        }
        Update: {
          allergens?: string[] | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          dietary_tags?: string[] | null
          image_asset_id?: string | null
          is_visible?: boolean
          name?: string
          price?: number | null
          sort_order?: number
          updated_at?: string
          website_id?: string
          website_menu_category_id?: string
          website_menu_item_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_menu_item_image_fk"
            columns: ["image_asset_id"]
            isOneToOne: false
            referencedRelation: "website_asset"
            referencedColumns: ["website_asset_id"]
          },
          {
            foreignKeyName: "website_menu_item_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "website"
            referencedColumns: ["website_id"]
          },
          {
            foreignKeyName: "website_menu_item_website_menu_category_id_fkey"
            columns: ["website_menu_category_id"]
            isOneToOne: false
            referencedRelation: "website_menu_category"
            referencedColumns: ["website_menu_category_id"]
          },
        ]
      }
      website_page: {
        Row: {
          created_at: string
          deleted_at: string | null
          is_visible: boolean
          meta_description: string | null
          meta_title: string | null
          og_image_path: string | null
          page_type: string
          slug: string
          sort_order: number
          title: string
          updated_at: string
          website_id: string
          website_page_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          is_visible?: boolean
          meta_description?: string | null
          meta_title?: string | null
          og_image_path?: string | null
          page_type: string
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
          website_id: string
          website_page_id?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          is_visible?: boolean
          meta_description?: string | null
          meta_title?: string | null
          og_image_path?: string | null
          page_type?: string
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
          website_id?: string
          website_page_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_page_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "website"
            referencedColumns: ["website_id"]
          },
        ]
      }
      website_preview_session: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          preview_session_id: string
          revision_id: string
          revoked_at: string | null
          token: string
          website_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          preview_session_id?: string
          revision_id: string
          revoked_at?: string | null
          token: string
          website_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          preview_session_id?: string
          revision_id?: string
          revoked_at?: string | null
          token?: string
          website_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_preview_session_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "website_draft_revision"
            referencedColumns: ["revision_id"]
          },
          {
            foreignKeyName: "website_preview_session_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "website"
            referencedColumns: ["website_id"]
          },
        ]
      }
      website_publish_event: {
        Row: {
          action: string
          created_at: string
          performed_by: string | null
          publish_event_id: string
          snapshot_id: string | null
          website_id: string
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string
          performed_by?: string | null
          publish_event_id?: string
          snapshot_id?: string | null
          website_id: string
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string
          performed_by?: string | null
          publish_event_id?: string
          snapshot_id?: string | null
          website_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_publish_event_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "website_published_snapshot"
            referencedColumns: ["snapshot_id"]
          },
          {
            foreignKeyName: "website_publish_event_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "website"
            referencedColumns: ["website_id"]
          },
        ]
      }
      website_published_snapshot: {
        Row: {
          created_at: string
          deleted_at: string | null
          is_active: boolean
          published_at: string
          published_by: string | null
          snapshot_data: Json
          snapshot_hash: string
          snapshot_id: string
          updated_at: string
          version: number
          website_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          is_active?: boolean
          published_at?: string
          published_by?: string | null
          snapshot_data: Json
          snapshot_hash: string
          snapshot_id?: string
          updated_at?: string
          version: number
          website_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          is_active?: boolean
          published_at?: string
          published_by?: string | null
          snapshot_data?: Json
          snapshot_hash?: string
          snapshot_id?: string
          updated_at?: string
          version?: number
          website_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_published_snapshot_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "website"
            referencedColumns: ["website_id"]
          },
        ]
      }
      website_section: {
        Row: {
          content: Json
          created_at: string
          deleted_at: string | null
          is_visible: boolean
          section_type: string
          settings: Json
          sort_order: number
          updated_at: string
          website_page_id: string
          website_section_id: string
          workspace_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          deleted_at?: string | null
          is_visible?: boolean
          section_type: string
          settings?: Json
          sort_order?: number
          updated_at?: string
          website_page_id: string
          website_section_id?: string
          workspace_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          deleted_at?: string | null
          is_visible?: boolean
          section_type?: string
          settings?: Json
          sort_order?: number
          updated_at?: string
          website_page_id?: string
          website_section_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_section_website_page_id_fkey"
            columns: ["website_page_id"]
            isOneToOne: false
            referencedRelation: "website_page"
            referencedColumns: ["website_page_id"]
          },
        ]
      }
      website_spokesperson: {
        Row: {
          assigned_at: string
          assigned_by: string
          bio: string
          content_schedule: Json
          created_at: string
          decline_reason: string | null
          profile_id: string
          quote: string
          responded_at: string | null
          role_title: string
          status: Database["websites"]["Enums"]["spokesperson_status"]
          updated_at: string
          website_id: string
          website_section_id: string
          website_spokesperson_id: string
          workspace_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          bio?: string
          content_schedule?: Json
          created_at?: string
          decline_reason?: string | null
          profile_id: string
          quote?: string
          responded_at?: string | null
          role_title?: string
          status?: Database["websites"]["Enums"]["spokesperson_status"]
          updated_at?: string
          website_id: string
          website_section_id: string
          website_spokesperson_id?: string
          workspace_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          bio?: string
          content_schedule?: Json
          created_at?: string
          decline_reason?: string | null
          profile_id?: string
          quote?: string
          responded_at?: string | null
          role_title?: string
          status?: Database["websites"]["Enums"]["spokesperson_status"]
          updated_at?: string
          website_id?: string
          website_section_id?: string
          website_spokesperson_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_spokesperson_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "website"
            referencedColumns: ["website_id"]
          },
          {
            foreignKeyName: "website_spokesperson_website_section_id_fkey"
            columns: ["website_section_id"]
            isOneToOne: true
            referencedRelation: "website_section"
            referencedColumns: ["website_section_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_active_site_snapshot_by_host: {
        Args: { p_host: string }
        Returns: Json
      }
      get_preview_site_by_token: { Args: { p_token: string }; Returns: Json }
    }
    Enums: {
      spokesperson_status: "pending" | "approved" | "declined" | "revoked"
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
  payroll: {
    Enums: {
      absence_category: [
        "vacation",
        "sick_self",
        "sick_doctor",
        "parental",
        "care_of_child",
        "military",
        "training",
        "welfare",
        "toil",
        "unpaid",
        "other",
      ],
      absence_ledger_type: [
        "entitlement",
        "carry_over",
        "usage",
        "adjustment",
        "expiry",
        "payout",
      ],
      break_trigger_type: ["after_duration", "time_of_day"],
      custom_rate_type: ["per_hour", "per_shift"],
      deviation_severity: ["error", "warning", "info"],
      meal_rule_type: ["deduction", "contribution"],
      period_status: ["open", "locked", "approved", "exported"],
      rate_adjustment_type: ["none", "replace", "add", "percentage"],
      rule_severity: ["block", "warn"],
      salary_code_category: [
        "worked_hours",
        "supplement",
        "overtime",
        "absence",
        "deduction",
        "monthly_salary",
      ],
      sick_leave_grade: [
        "full",
        "graded_75",
        "graded_50",
        "graded_25",
        "graded_custom",
      ],
      supplement_rate_type: ["fixed_per_hour", "percentage", "fixed_per_shift"],
      supplement_start_type: ["time_of_day", "after_shift_start"],
      supplement_type: [
        "normal",
        "week_based",
        "day_based",
        "manual",
        "holiday",
        "contract_rule",
      ],
      timebank_entry_type: [
        "accrual",
        "withdrawal",
        "adjustment",
        "expiry",
        "carry_over",
        "payout",
      ],
      wage_type: ["hourly", "per_shift", "monthly"],
    },
  },
  public: {
    Enums: {
      absence_status: ["pending", "approved", "rejected"],
      anchor_type: ["fixed", "open", "close"],
      api_key_type: ["workspace", "service"],
      api_key_version_status: ["current", "previous", "revoked"],
      asset_type: ["equipment", "safety", "storage", "station", "other"],
      assignment_source: [
        "workspace",
        "department",
        "team",
        "location",
        "position",
        "manual",
        "season",
      ],
      audit_operation: ["INSERT", "UPDATE", "DELETE"],
      auth_provider: ["supabase", "google", "microsoft"],
      authority_level: ["duty", "deputy", "leader"],
      billing_dispatch_channel: [
        "email_customer",
        "email_internal",
        "http_api",
        "peppol_ehf",
        "stripe_invoice",
      ],
      billing_integration_type: ["fiken", "tripletex", "stripe", "placeholder"],
      booking_status: ["confirmed", "pending", "cancelled"],
      budget_period_type: ["monthly", "weekly", "daily", "hourly"],
      budget_status: ["draft", "active", "locked"],
      cascade_initiator: [
        "cascade_engine",
        "admin_manual",
        "c1_calibration",
        "bootstrap",
      ],
      change_proposal_status: [
        "pending",
        "approved",
        "applied",
        "rejected",
        "expired",
        "failed",
      ],
      channel_ai_text_mode: ["disabled", "mention_only", "proactive"],
      channel_ai_voice_mode: ["disabled", "listen_only", "interactive"],
      channel_ai_voice_policy: ["disabled", "listen_only", "interactive"],
      channel_audio_policy: ["disabled", "ptt", "open_mic", "listen_only"],
      channel_call_status: ["active", "ending", "ended"],
      channel_call_type: ["direct", "group", "ptt"],
      channel_delivery_mode: ["timeline", "silent", "notification_only"],
      channel_integration_status: ["active", "paused", "error"],
      channel_member_role: ["member", "admin", "representative"],
      channel_message_type: [
        "text",
        "image",
        "file",
        "voice_clip",
        "system",
        "brief",
        "handoff",
        "announcement",
        "reminder",
        "summary",
      ],
      channel_message_visibility: ["all_members", "admins", "targeted_members"],
      channel_notification_priority: ["critical", "high", "normal", "low"],
      channel_origin_type: [
        "human",
        "ai",
        "system",
        "webhook",
        "scheduler",
        "workflow",
      ],
      channel_presence_status: ["online", "away", "offline"],
      channel_privacy_mode: ["public", "private_per_requester"],
      channel_recording_policy: ["off", "optional", "auto"],
      channel_video_policy: ["disabled", "optional", "default_on", "required"],
      chat_conversation_type: ["group", "dm", "ai"],
      close_image_type: [
        "isettle_settlement",
        "pos_closing_screen",
        "z_report",
        "cash_drawer",
        "receipt_bundle",
        "other",
      ],
      comm_channel_type: [
        "department",
        "team",
        "session",
        "custom",
        "direct",
        "news",
        "skill",
        "desk",
        "query_thread",
      ],
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
      config_change_type: ["runtime", "restart"],
      contract_status: [
        "draft",
        "sent",
        "viewed",
        "signed",
        "expired",
        "terminated",
        "pending_data",
        "declined",
        "ready_to_send",
        "migration_incomplete",
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
      department_type: ["operational", "administrative", "hybrid"],
      deviation_domain: [
        "safety",
        "customer",
        "procedure",
        "system",
        "material",
      ],
      deviation_severity: ["low", "medium", "high", "critical"],
      deviation_status: ["open", "acknowledged", "resolved", "escalated"],
      dispatch_rule_action: ["send", "suppress"],
      dispatch_status: [
        "pending",
        "in_flight",
        "delivered",
        "failed",
        "bounced",
      ],
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
      dunning_status: [
        "none",
        "in_negotiation",
        "reminder_sent",
        "escalated",
        "reminder_1",
        "reminder_2",
        "collection_notice",
      ],
      enforcement_status: ["aspirational", "enforced"],
      evaluation_outcome: [
        "allowed",
        "allowed_with_exception",
        "review_required",
        "blocked",
      ],
      evidence_tier: [
        "quiz",
        "quiz_plus_observer",
        "quiz_plus_observer_plus_confirmation",
        "four_eyes",
      ],
      external_provider: ["tripletex", "planday", "visma"],
      framework_rule_type: ["gate", "constraint", "advisory", "commercial"],
      framework_trigger_mode: [
        "state_change",
        "time_based",
        "threshold",
        "external_event",
      ],
      framework_trigger_type: [
        "operating_hours",
        "season_transition",
        "template_change",
        "event_added",
        "manual_override",
        "framework_rule_change",
        "external_sync",
      ],
      industry: ["restaurant", "hotel", "cafe", "bar", "catering", "other"],
      invite_status: ["pending", "accepted", "expired", "cancelled"],
      invite_type: ["email", "sms", "link"],
      invoice_line_type: [
        "base_plan",
        "user_overage",
        "addon",
        "onboarding",
        "adjustment",
      ],
      invoice_status: [
        "draft",
        "issued",
        "sent",
        "paid",
        "overdue",
        "void",
        "uncollectible",
      ],
      invoice_type: ["recurring", "onboarding", "credit_note", "one_off"],
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
      journey_test_type: ["automated", "manual", "protocol"],
      journey_version_status: [
        "draft",
        "ready_test",
        "testing",
        "ready_publish",
        "published",
        "archived",
      ],
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
      notification_channel: ["push", "sms", "email", "voice", "in_app"],
      notification_mode: ["training", "work", "community"],
      notification_status: [
        "pending",
        "processing",
        "delivered",
        "failed",
        "suppressed",
      ],
      observer_request_status: [
        "pending",
        "claimed",
        "approved",
        "rejected",
        "expired",
      ],
      payment_method_type: [
        "stripe_card",
        "stripe_bank",
        "bank_transfer",
        "manual_adjustment",
        "accountant_manual",
      ],
      payment_status: [
        "pending",
        "processing",
        "succeeded",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      planning_cycle_status: ["draft", "active", "archived"],
      planning_event_category: [
        "external_scraped",
        "cultural_commercial",
        "internal",
        "weather",
        "recurring",
      ],
      planning_event_source: [
        "manual",
        "scraped_municipality",
        "scraped_cultural",
        "weather_api",
        "booking_integration",
        "historical_import",
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
        "ai_operations",
      ],
      preferred_language: ["no", "sv", "en", "da", "fi"],
      procedure_type: [
        "standard",
        "onboarding",
        "safety",
        "maintenance",
        "custom",
      ],
      profile_role: ["employee", "manager", "admin", "owner", "system"],
      profile_status: ["trainee", "active", "inactive", "offboarding"],
      protocol_assignment_status: [
        "pending",
        "completed",
        "expired",
        "not_started",
        "in_progress",
        "waived",
      ],
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
      season_goal_status: ["active", "completed", "cancelled"],
      season_status: ["draft", "active", "archived"],
      season_type: ["default", "calendar", "focus", "cycle", "custom"],
      service_status: ["active", "stopped", "error", "unconfigured"],
      service_type: ["docker", "vercel", "edge-function", "external"],
      session_hook_type: [
        "pre_open",
        "open",
        "scheduled",
        "pre_close",
        "close",
      ],
      session_note_type: ["handoff", "closing", "general"],
      session_task_status: [
        "pending",
        "available",
        "in_progress",
        "completed",
        "skipped",
        "overdue",
        "escalated",
      ],
      settlement_source_type: [
        "pos",
        "terminal",
        "z_report",
        "cash_count",
        "other",
      ],
      shift_approval_status: ["pending", "approved", "edited", "disputed"],
      shift_function: [
        "opening",
        "closing",
        "supporting",
        "rush_hour",
        "sub_supply",
      ],
      shift_status: [
        "created",
        "assigned",
        "published",
        "active",
        "completed",
        "unpublished",
      ],
      snapshot_basis: ["planned", "actual"],
      supplement_claim_status: ["pending", "approved", "rejected"],
      sync_direction: ["inbound", "outbound", "bidirectional"],
      sync_status: ["pending", "synced", "failed", "conflict"],
      tariff_source: ["riksavtalen", "allmenngjoring", "internal"],
      team_type: [
        "operational",
        "access",
        "cross_department",
        "seasonal",
        "custom",
      ],
      trigger_type: ["scheduled", "event"],
      waste_category: [
        "food_prep",
        "food_spoilage",
        "food_overproduction",
        "food_returned",
        "beverage",
        "packaging",
        "other",
      ],
      wizard_phase: [
        "discovery",
        "classification",
        "steps",
        "testing",
        "documentation",
        "review",
      ],
      wizard_session_status: ["active", "completed", "abandoned"],
      workspace_status: ["sandbox", "active", "suspended", "archived"],
    },
  },
  timesheet: {
    Enums: {
      time_entry_status: ["clocked_in", "completed", "edited"],
    },
  },
  websites: {
    Enums: {
      spokesperson_status: ["pending", "approved", "declined", "revoked"],
    },
  },
} as const

