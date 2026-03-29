"use client";

// Hook for loading cascade framework rules + workspace overrides.
//
// Framework rules come from the regulatory_framework bound to this workspace
// via workspace_framework_binding. Workspace overrides let admins loosen or
// tighten individual rules within the bounds set by outcome_overridable.
//
// Exports:
//   useFrameworkRules()  — fetch rules + overrides, merged into display shape
//   toggleOverride       — upsert/delete workspace_rule_override rows

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EvaluationOutcome =
  | "allowed"
  | "allowed_with_exception"
  | "review_required"
  | "blocked";

export type FrameworkRuleDisplay = {
  ruleId: string;
  code: string;
  ruleType: string;
  category: string;
  description: string;
  descriptionNo: string;
  defaultOutcome: EvaluationOutcome;
  severity: string;
  outcomeOverridable: boolean;
  sourceReference: string | null;
  // Override state
  overrideId: string | null;
  overrideOutcome: EvaluationOutcome | null;
  overrideValidFrom: string | null;
  overrideValidUntil: string | null;
  overrideReason: string | null;
};

export type ToggleOverridePayload = {
  ruleId: string;
  overrideId: string | null;
  outcome: EvaluationOutcome | null;
  reason: string;
  validFrom: string | null;
  validUntil: string | null;
};

// ─── Query key ────────────────────────────────────────────────────────────────

function frameworkRulesKey(workspaceId: string) {
  return ["settings", "framework-rules", workspaceId] as const;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFrameworkRules() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: frameworkRulesKey(wsId ?? "none"),
    queryFn: async (): Promise<FrameworkRuleDisplay[]> => {
      // 1. Get active binding
      const { data: binding, error: bindingError } = await supabase
        .from("workspace_framework_binding")
        .select("framework_id")
        .eq("workspace_id", wsId!)
        .eq("is_active", true)
        .maybeSingle();

      if (bindingError || !binding) return [];

      // 2. Load rules + overrides in parallel
      const [rulesRes, overridesRes] = await Promise.all([
        supabase
          .from("framework_rule")
          .select(
            "rule_id, code, rule_type, category, description, description_no, default_outcome, severity, outcome_overridable, source_reference",
          )
          .eq("framework_id", binding.framework_id)
          .order("code", { ascending: true }),
        supabase
          .from("workspace_rule_override")
          .select("id, rule_id, override_outcome, valid_from, valid_until, reason")
          .eq("workspace_id", wsId!),
      ]);

      if (rulesRes.error) throw new Error(rulesRes.error.message);

      const overridesByRuleId = new Map((overridesRes.data ?? []).map((o) => [o.rule_id, o]));

      // 3. Merge into display shape
      return (rulesRes.data ?? []).map((rule) => {
        const override = overridesByRuleId.get(rule.rule_id);
        return {
          ruleId: rule.rule_id,
          code: rule.code,
          ruleType: rule.rule_type,
          category: rule.category,
          description: rule.description,
          descriptionNo: rule.description_no ?? rule.description,
          defaultOutcome: rule.default_outcome as EvaluationOutcome,
          severity: rule.severity,
          outcomeOverridable: rule.outcome_overridable,
          sourceReference: rule.source_reference,
          overrideId: override?.id ?? null,
          overrideOutcome: (override?.override_outcome as EvaluationOutcome) ?? null,
          overrideValidFrom: override?.valid_from ?? null,
          overrideValidUntil: override?.valid_until ?? null,
          overrideReason: override?.reason ?? null,
        };
      });
    },
    enabled: !!wsId,
    staleTime: 10 * 60 * 1000,
  });

  const toggleOverride = useMutation({
    mutationFn: async (payload: ToggleOverridePayload) => {
      // If outcome is null, delete the override (revert to default)
      if (payload.outcome === null && payload.overrideId) {
        const { error } = await supabase
          .from("workspace_rule_override")
          .delete()
          .eq("id", payload.overrideId);
        if (error) throw new Error(error.message);
        return;
      }

      // Upsert override
      if (payload.overrideId) {
        const { error } = await supabase
          .from("workspace_rule_override")
          .update({
            override_outcome: payload.outcome,
            reason: payload.reason,
            valid_from: payload.validFrom,
            valid_until: payload.validUntil,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payload.overrideId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("workspace_rule_override").insert({
          workspace_id: wsId!,
          rule_id: payload.ruleId,
          override_outcome: payload.outcome,
          reason: payload.reason,
          valid_from: payload.validFrom,
          valid_until: payload.validUntil,
        });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      void emit({
        event: "button clicked",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: { trackingId: "framework-rule-override-toggled" },
      });
      queryClient.invalidateQueries({
        queryKey: frameworkRulesKey(wsId!),
      });
      toast.success("Regeloverstyring oppdatert");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke oppdatere: ${error.message}`);
    },
  });

  return {
    rules: query.data ?? [],
    isLoading: query.isLoading,
    toggleOverride,
  };
}
