"use client";

// Hook layer for payroll.working_time_rule.
//
// Working time rules are NOT free-form CRUD — they are a fixed set of 6 AML
// (arbeidsmiljøloven) compliance rules that a workspace either has or doesn't
// have. The three exports here cover the three lifecycle moments:
//
//   useWorkingTimeRules()       — fetch current rules for the workspace
//   useUpsertWorkingTimeRules() — bulk-save all 6 rules in one shot
//   useActivateDefaults()       — insert all 6 defaults when none exist yet

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RuleSeverity = "block" | "warn";

export type WorkingTimeRuleRow = {
  id: string;
  workspace_id: string;
  code: string;
  name: string;
  description: string | null;
  severity: RuleSeverity;
  threshold_value: number;
  scope_type: string;
  scope_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// The subset the UI can mutate on each rule card.
// name is required because the DB column is NOT NULL and upsert needs it.
export type WorkingTimeRuleUpdate = {
  id: string;
  code: string;
  name: string;
  threshold_value: number;
  severity: RuleSeverity;
  is_active: boolean;
};

// ─── Default rule definitions (W01–W06) ───────────────────────────────────────
//
// These match the Norwegian Arbeidsmiljøloven requirements:
//   W01/W02 — max daily/weekly hours (AML §10-8)
//   W03/W04 — mandatory rest periods (AML §10-8)
//   W05     — max consecutive working days (AML §10-8)
//   W06     — youth work restrictions (AML §11)

export type DefaultRule = {
  code: string;
  name: string;
  description: string;
  threshold_value: number;
  severity: RuleSeverity;
  scope_type: string;
};

export const DEFAULT_WORKING_TIME_RULES: DefaultRule[] = [
  {
    code: "W01",
    name: "Maks timer per dag",
    description: "Arbeidstid skal ikke overstige denne grensen per dag",
    threshold_value: 9,
    severity: "warn",
    scope_type: "workspace",
  },
  {
    code: "W02",
    name: "Maks timer per uke",
    description: "Ukentlig arbeidstid skal ikke overstige denne grensen",
    threshold_value: 40,
    severity: "warn",
    scope_type: "workspace",
  },
  {
    code: "W03",
    name: "Minimum daglig hvile",
    description: "Ansatte må ha minst denne hvilen mellom vakter",
    threshold_value: 11,
    severity: "warn",
    scope_type: "workspace",
  },
  {
    code: "W04",
    name: "Minimum ukentlig hvile",
    description: "Ansatte må ha minst denne sammenhengende hvilen per uke",
    threshold_value: 35,
    severity: "warn",
    scope_type: "workspace",
  },
  {
    code: "W05",
    name: "Maks sammenhengende dager",
    description: "Ansatte skal ikke jobbe flere dager uten fridag",
    threshold_value: 6,
    severity: "warn",
    scope_type: "workspace",
  },
  {
    code: "W06",
    name: "Unges arbeidstid",
    description: "Spesielle regler for ansatte under 18 år",
    threshold_value: 0,
    severity: "block",
    scope_type: "workspace",
  },
];

// ─── Query key ────────────────────────────────────────────────────────────────

function workingTimeRulesKey(workspaceId: string) {
  return ["settings", "working-time-rules", workspaceId] as const;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetches all working time rules for the current workspace, ordered by code.
 * Returns an empty array (not undefined) when no rules exist — callers use
 * the empty state to show the "Aktiver AML-regler" prompt.
 */
export function useWorkingTimeRules() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: workingTimeRulesKey(wsId ?? "none"),
    queryFn: async (): Promise<WorkingTimeRuleRow[]> => {
      const { data, error } = await supabase
        .schema("payroll")
        .from("working_time_rule")
        .select("*")
        .eq("workspace_id", wsId!)
        .order("code", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as WorkingTimeRuleRow[];
    },
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Bulk-upserts all 6 rule cards in a single DB call.
 * Uses the natural key (workspace_id, code, scope_type, scope_id) so re-running
 * after partial inserts is idempotent.
 */
export function useUpsertWorkingTimeRules() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: WorkingTimeRuleUpdate[]) => {
      const rows = updates.map((u) => ({
        id: u.id,
        workspace_id: wsId!,
        code: u.code,
        name: u.name,
        threshold_value: u.threshold_value,
        severity: u.severity,
        is_active: u.is_active,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.schema("payroll").from("working_time_rule").upsert(rows, {
        onConflict: "workspace_id,code,scope_type,scope_id",
        ignoreDuplicates: false,
      });

      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, updates) => {
      void emit({
        event: "working_time_rules updated",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          data: {
            rule_codes: updates.map((u) => u.code),
            active_count: updates.filter((u) => u.is_active).length,
          },
        },
      });
      void queryClient.invalidateQueries({
        queryKey: workingTimeRulesKey(wsId!),
      });
      toast.success("Arbeidstidsregler lagret");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke lagre: ${error.message}`);
    },
  });
}

/**
 * Inserts all 6 default AML rules for a workspace that has none yet.
 * Safe to call repeatedly — uses upsert so partial prior inserts don't fail.
 */
export function useActivateDefaults() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const rows = DEFAULT_WORKING_TIME_RULES.map((rule) => ({
        workspace_id: wsId!,
        code: rule.code,
        name: rule.name,
        description: rule.description,
        severity: rule.severity,
        threshold_value: rule.threshold_value,
        scope_type: rule.scope_type,
        scope_id: null,
        is_active: true,
      }));

      const { error } = await supabase.schema("payroll").from("working_time_rule").upsert(rows, {
        onConflict: "workspace_id,code,scope_type,scope_id",
        ignoreDuplicates: true,
      });

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void emit({
        event: "working_time_rules updated",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          data: {
            rule_codes: DEFAULT_WORKING_TIME_RULES.map((r) => r.code),
            active_count: DEFAULT_WORKING_TIME_RULES.length,
          },
        },
      });
      void queryClient.invalidateQueries({
        queryKey: workingTimeRulesKey(wsId!),
      });
      toast.success("AML-regler aktivert");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke aktivere: ${error.message}`);
    },
  });
}
