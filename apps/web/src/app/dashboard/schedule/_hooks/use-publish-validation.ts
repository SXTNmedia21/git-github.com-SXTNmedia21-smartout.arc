"use client";

/**
 * Batch validates framework rules for shifts being published.
 * Groups shifts by employee, evaluates rules for each, returns aggregate summary.
 * Used by the publish confirmation dialog as the operational gate.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { buildEntityContext } from "@/lib/cascade/build-entity-context";
import { evaluateFrameworkRules } from "@/lib/cascade/evaluate-framework-rules";
import type {
  EvaluationOutcomeLevel,
  FrameworkRuleRow,
  WorkspaceRuleOverrideRow,
} from "@/lib/cascade/types";

export type PublishValidationHit = {
  shiftId: string;
  employeeName: string;
  outcome: EvaluationOutcomeLevel;
  reason: string;
};

export type PublishValidationResult = {
  totalShifts: number;
  warnings: number;
  blocked: number;
  hits: PublishValidationHit[];
};

type ShiftForValidation = {
  id: string;
  employeeId: string | null;
  employeeName: string;
  dateId: string;
  startTime: string;
  endTime: string;
};

export function usePublishValidation(shiftsToPublish: ShiftForValidation[], enabled: boolean) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  // Load rules (same pattern as useShiftRuleCheck)
  const rulesQuery = useQuery({
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
    enabled,
  });

  const result = useMemo<PublishValidationResult>(() => {
    const rules = rulesQuery.data?.rules ?? [];
    const overrides = rulesQuery.data?.overrides ?? [];

    if (!rules.length || !shiftsToPublish.length) {
      return { totalShifts: shiftsToPublish.length, warnings: 0, blocked: 0, hits: [] };
    }

    const hits: PublishValidationHit[] = [];

    // Group shifts by employee for context building
    const byEmployee = new Map<string, ShiftForValidation[]>();
    for (const shift of shiftsToPublish) {
      if (!shift.employeeId) continue;
      const existing = byEmployee.get(shift.employeeId) ?? [];
      existing.push(shift);
      byEmployee.set(shift.employeeId, existing);
    }

    // Evaluate each employee's shifts
    for (const [, empShifts] of byEmployee) {
      for (const shift of empShifts) {
        const otherShifts = empShifts
          .filter((s) => s.id !== shift.id)
          .map((s) => ({ startTime: s.startTime, endTime: s.endTime, date: s.dateId }));

        const entityContext = buildEntityContext(
          otherShifts,
          { startTime: shift.startTime, endTime: shift.endTime, date: shift.dateId },
          { birthDate: null, contractType: null },
        );

        const evalResult = evaluateFrameworkRules(entityContext, rules, overrides);

        for (const hit of evalResult.hits) {
          hits.push({
            shiftId: shift.id,
            employeeName: shift.employeeName,
            outcome: hit.outcome,
            reason: hit.reason,
          });
        }
      }
    }

    const warnings = hits.filter(
      (h) => h.outcome === "allowed_with_exception" || h.outcome === "review_required",
    ).length;
    const blocked = hits.filter((h) => h.outcome === "blocked").length;

    return { totalShifts: shiftsToPublish.length, warnings, blocked, hits };
  }, [rulesQuery.data, shiftsToPublish]);

  return {
    result,
    isLoading: rulesQuery.isLoading,
  };
}
