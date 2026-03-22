"use client";

/**
 * Client-side rule evaluation for shift creation/editing.
 * Provides instant feedback (warning badges) as manager edits a shift.
 *
 * Data flow:
 * 1. Load framework rules + workspace overrides (cached 10min)
 * 2. Load employee rule context (birth date, contract type)
 * 3. Get existing shifts for the week (from shift query cache)
 * 4. Build EntityContext via buildEntityContext()
 * 5. Call evaluateFrameworkRules() — pure, no DB access
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { buildEntityContext } from "@/lib/cascade/build-entity-context";
import { evaluateFrameworkRules } from "@/lib/cascade/evaluate-framework-rules";
import type {
  EvaluationResult,
  FrameworkRuleRow,
  WorkspaceRuleOverrideRow,
} from "@/lib/cascade/types";

import { useEmployeeRuleContext } from "./use-employee-rule-context";

type DraftShift = {
  employeeId: string | undefined;
  date: string;
  startTime: string;
  endTime: string;
};

type ShiftForContext = {
  startTime: string;
  endTime: string;
  date: string;
};

/** Load framework rules + workspace overrides for rule evaluation */
function useFrameworkRulesData() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: ["cascade", "framework-rules", workspaceId],
    queryFn: async () => {
      const supabase = createClient();

      const { data: binding } = await supabase
        .from("workspace_framework_binding")
        .select("framework_id")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .single();

      if (!binding)
        return { rules: [] as FrameworkRuleRow[], overrides: [] as WorkspaceRuleOverrideRow[] };

      const [rulesRes, overridesRes] = await Promise.all([
        supabase
          .from("framework_rule")
          .select(
            "rule_id, code, rule_type, category, description, default_outcome, severity, outcome_overridable, evaluation_config, source_reference",
          )
          .eq("framework_id", binding.framework_id),
        supabase
          .from("workspace_rule_override")
          .select("id, rule_id, override_outcome, override_config, valid_from, valid_until")
          .eq("workspace_id", workspaceId),
      ]);

      const rules: FrameworkRuleRow[] = (rulesRes.data ?? []).map((r) => ({
        ruleId: r.rule_id,
        code: r.code,
        ruleType: r.rule_type as FrameworkRuleRow["ruleType"],
        category: r.category,
        description: r.description,
        defaultOutcome: r.default_outcome as FrameworkRuleRow["defaultOutcome"],
        severity: r.severity,
        outcomeOverridable: r.outcome_overridable,
        evaluationConfig: (r.evaluation_config ?? {}) as Record<string, unknown>,
        sourceReference: r.source_reference,
      }));

      const overrides: WorkspaceRuleOverrideRow[] = (overridesRes.data ?? []).map((o) => ({
        overrideId: o.id,
        ruleId: o.rule_id,
        overrideOutcome: o.override_outcome as WorkspaceRuleOverrideRow["overrideOutcome"],
        overrideConfig: (o.override_config ?? {}) as Record<string, unknown>,
        validFrom: o.valid_from,
        validUntil: o.valid_until,
      }));

      return { rules, overrides };
    },
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Real-time rule evaluation for a shift being created/edited.
 *
 * @param draftShift - The shift currently being edited in the modal
 * @param existingShifts - Employee's other shifts for the week (from useShifts cache)
 */
export function useShiftRuleCheck(draftShift: DraftShift, existingShifts: ShiftForContext[]) {
  const { data: rulesData, isLoading: rulesLoading } = useFrameworkRulesData();
  const { data: employeeCtx, isLoading: employeeLoading } = useEmployeeRuleContext(
    draftShift.employeeId,
  );

  const result = useMemo<EvaluationResult | null>(() => {
    if (!rulesData?.rules.length || !draftShift.employeeId || !draftShift.date) {
      return null;
    }

    const entityContext = buildEntityContext(
      existingShifts,
      {
        startTime: draftShift.startTime,
        endTime: draftShift.endTime,
        date: draftShift.date,
      },
      {
        birthDate: employeeCtx?.birthDate ?? null,
        contractType: employeeCtx?.contractType ?? null,
      },
    );

    return evaluateFrameworkRules(entityContext, rulesData.rules, rulesData.overrides ?? []);
  }, [rulesData, employeeCtx, draftShift, existingShifts]);

  return {
    result,
    isLoading: rulesLoading || employeeLoading,
  };
}
