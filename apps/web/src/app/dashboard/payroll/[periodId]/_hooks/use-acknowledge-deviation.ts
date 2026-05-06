/**
 * Hook: acknowledge a payroll deviation (Phase 1 UI path).
 *
 * Phase 1 shortcut: direct Supabase update scoped by RLS. The capability tool
 * path (acknowledge_deviation via Botsson chat) delegates to the same DB write
 * with the addition of gate_action. A dedicated BFF route with gate_action will
 * be added in Phase 2 (ADR-pending), at which point this hook routes through it.
 *
 * Implementation sequence:
 *   1. Resolve own profile_id (auth.uid() → profile lookup).
 *   2. Fetch deviation row to obtain workspace_id, check_id, and severity
 *      (required for telemetry + fail-fast on not-found per L-0177).
 *   3. Perform the UPDATE.
 *   4. Emit `payroll.deviation_acknowledged` with nonEmpty-guarded IDs (ADR-0134).
 *
 * On success: invalidates the period deviations query so the list refreshes.
 */
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { payrollKeys } from "../../_hooks/payroll-keys";

type AcknowledgeParams = {
  deviationId: string;
  resolution: string;
  periodId: string;
};

async function acknowledgeDeviation(params: AcknowledgeParams): Promise<void> {
  const supabase = createClient();

  // Step 1: Resolve own profile_id for the acknowledged_by field.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile, error: profileErr } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (profileErr || !profile) throw new Error("Profile not found");

  // Step 2: Fetch deviation row to get workspace_id, check_id, and severity
  // before updating. Fail-fast on not-found (L-0177) — no silent fallback.
  // Table lives in payroll schema — access via .schema("payroll").from("deviation").
  const { data: deviation, error: devErr } = await supabase
    .schema("payroll")
    .from("deviation")
    .select("workspace_id, check_id, severity")
    .eq("id", params.deviationId)
    .maybeSingle();

  if (devErr || !deviation) throw new Error("Deviation not found");

  // Step 3: Perform the update. RLS ensures the caller is scoped to their workspace.
  const { error } = await supabase
    .schema("payroll")
    .from("deviation")
    .update({
      acknowledged_by: profile.profile_id,
      acknowledged_at: new Date().toISOString(),
      resolution: params.resolution,
    })
    .eq("id", params.deviationId);

  if (error) throw error;

  // Step 4: Emit telemetry. nonEmpty() throws in dev/test if IDs are missing,
  // and drops the event in prod — prevents corrupt activity_trail rows (ADR-0134).
  void emit({
    event: "payroll.deviation_acknowledged",
    workspace_id: nonEmpty(deviation.workspace_id, "workspace_id"),
    actor_id: nonEmpty(profile.profile_id, "actor_id"),
    properties: {
      entity: {
        entity_type: "profile",
        entity_id: profile.profile_id,
      },
      data: {
        deviation_id: params.deviationId,
        period_id: params.periodId,
        check_code: deviation.check_id,
        severity: deviation.severity as "error" | "warning",
        acknowledged_by_profile_id: profile.profile_id,
        gate_evaluation_id: null,
      },
    },
  });
}

export function useAcknowledgeDeviation(periodId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acknowledgeDeviation,
    onSuccess: () => {
      // Invalidate deviations so the list refreshes (unack count changes)
      void queryClient.invalidateQueries({
        queryKey: payrollKeys.deviations(periodId),
      });
      // Also invalidate the period list (deviation counts in PeriodCard)
      void queryClient.invalidateQueries({
        queryKey: payrollKeys.all,
      });
    },
  });
}
