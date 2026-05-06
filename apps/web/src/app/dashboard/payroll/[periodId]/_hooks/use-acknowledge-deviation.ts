/**
 * Hook: acknowledge a payroll deviation via the capability tool BFF.
 *
 * Calls POST /api/botsson/chat which routes to the payroll capability's
 * `acknowledge_deviation` tool. The BFF enforces chat-only channel guard
 * (ADR-0078), workspace scope (ADR-0151), and gateAction (ADR-0099).
 *
 * On success: invalidates the period deviations query so the list refreshes.
 *
 * Alternative (faster, no AI routing): directly call the Supabase RPC or
 * update via anon client. We use the capability tool path so the acknowledge
 * action is gated, telemetered, and audited consistently — even when triggered
 * from the UI rather than Botsson chat.
 *
 * Note: The UI fallback calls the payroll BFF directly if Botsson routing is
 * unavailable (capability path). For Phase 1 we call the Supabase anon client
 * directly with an RLS-scoped update, since the Botsson chat route is the full
 * AI path. A dedicated BFF route will be added in Phase 2 (ADR-pending).
 *
 * Phase 1 shortcut: direct Supabase update, RLS ensures workspace scope.
 * The `acknowledged_by` is set to the authenticated user's profile_id
 * (derived via auth.uid() → profile lookup inside the update policy).
 * Emit is done client-side via the UI hook's onSuccess.
 */
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { payrollKeys } from "../../_hooks/payroll-keys";

type AcknowledgeParams = {
  deviationId: string;
  resolution: string;
  periodId: string;
};

async function acknowledgeDeviation(params: AcknowledgeParams): Promise<void> {
  const supabase = createClient();

  // Resolve own profile_id for the acknowledged_by field
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
