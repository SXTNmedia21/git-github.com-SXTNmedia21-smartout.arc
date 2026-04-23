"use client";

/**
 * useSupplements.ts — Fetches available supplement rules and manages employee
 * claims for a given shift.
 *
 * Supplement rules live in the payroll schema and are workspace-scoped.
 * Only rules with supplement_type = 'manual' are exposed here — those are
 * the ones employees can self-claim (vs automated rules applied at settlement).
 *
 * Claims are inserted into payroll.manual_supplement with status='pending'
 * and reviewed by a manager before payroll runs.
 *
 * Connected to: ShiftClock supplements tab component
 */

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit, nonEmpty } from "@smartout/telemetry";
import type { SupplementOption } from "@smartout/shift-clock";

// ── Types ─────────────────────────────────────────────────────

type ClaimedSupplement = {
  id: string;
  supplement_rule_id: string | null;
  schedule_shift_id: string;
  description: string;
  employee_comment: string | null;
  amount: number;
  status: string | null;
  salary_code: string | null;
  created_at: string;
};

// ── Query key factory ─────────────────────────────────────────

const supplementKeys = {
  available: (workspaceId: string) => ["supplements-available", workspaceId] as const,
  claimed: (shiftId: string) => ["supplements-claimed", shiftId] as const,
};

// ── Hook ──────────────────────────────────────────────────────

export function useSupplements(shiftId: string | null) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  const workspaceId = workspace.workspace_id;

  // ── Query: available supplement rules (manual only) ───────

  const availableQuery = useQuery<SupplementOption[]>({
    queryKey: supplementKeys.available(workspaceId),
    queryFn: async () => {
      const supabase = createClient();

      // payroll schema — use .schema() to target it explicitly
      const { data, error } = await supabase
        .schema("payroll")
        .from("supplement_rule")
        .select("id, name, salary_code, rate_value, rate_type, allow_rate_override, is_active")
        .eq("workspace_id", workspaceId)
        .eq("supplement_type", "manual")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      // Map database rows to the shared SupplementOption type
      return (data ?? []).map(
        (rule): SupplementOption => ({
          id: rule.id,
          name: rule.name,
          description: rule.name, // description not stored separately on supplement_rule
          salaryCode: rule.salary_code ?? "",
          amount: rule.rate_value,
          rateType: (rule.rate_type as "per_hour" | "per_shift") ?? "per_shift",
          commentRequired: rule.allow_rate_override,
        }),
      );
    },
    staleTime: 10 * 60 * 1000, // Rules rarely change during a shift — 10 min cache
  });

  // ── Query: claimed supplements for this shift ─────────────

  const claimedQuery = useQuery<ClaimedSupplement[]>({
    queryKey: supplementKeys.claimed(shiftId ?? ""),
    enabled: !!shiftId,
    queryFn: async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .schema("payroll")
        .from("manual_supplement")
        .select(
          "id, supplement_rule_id, schedule_shift_id, description, employee_comment, amount, status, salary_code, created_at",
        )
        .eq("schedule_shift_id", shiftId!);

      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Mutation: claim a supplement ──────────────────────────

  const claimSupplementMutation = useMutation({
    mutationFn: async ({
      supplementRuleId,
      employeeComment,
    }: {
      supplementRuleId: string;
      employeeComment?: string;
    }) => {
      if (!shiftId || !profileId) throw new Error("Missing shift or profile");

      // Look up the rule to get amount and description for the claim record
      const rule = availableQuery.data?.find((r) => r.id === supplementRuleId);
      if (!rule) throw new Error("Supplement rule not found");

      const supabase = createClient();
      const { data, error } = await supabase
        .schema("payroll")
        .from("manual_supplement")
        .insert({
          supplement_rule_id: supplementRuleId,
          schedule_shift_id: shiftId,
          workspace_id: workspaceId,
          added_by: profileId,
          amount: rule.amount,
          description: rule.name,
          salary_code: rule.salaryCode || null,
          employee_comment: employeeComment ?? null,
          status: "pending",
        })
        .select("id, amount")
        .single();

      if (error) throw error;
      return { ...data, supplementRuleId };
    },

    onSuccess: (data) => {
      void emit({
        event: "shift supplement_claimed",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity_type: "shift" as const,
          entity_id: shiftId ?? "",
          data: {
            shift_id: shiftId ?? "",
            supplement_rule_id: data.supplementRuleId,
            amount: data.amount,
          },
        },
      });

      void queryClient.invalidateQueries({
        queryKey: supplementKeys.claimed(shiftId ?? ""),
      });
    },
  });

  // ── Public API ────────────────────────────────────────────

  return {
    availableSupplements: availableQuery.data ?? [],
    claimedSupplements: claimedQuery.data ?? [],
    claimSupplement: (supplementRuleId: string, employeeComment?: string) =>
      claimSupplementMutation.mutateAsync({ supplementRuleId, employeeComment }),
    isLoading:
      availableQuery.isLoading || claimedQuery.isLoading || claimSupplementMutation.isPending,
  };
}
