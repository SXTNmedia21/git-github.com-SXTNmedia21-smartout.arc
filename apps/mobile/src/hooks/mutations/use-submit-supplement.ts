/**
 * Offline-first manual supplement claim submission.
 *
 * Enqueues a write to the SQLite sync queue and optimistically adds the new
 * claim to the ["my-supplement-claims"] query cache. The SyncWorker picks
 * it up and inserts into payroll.manual_supplement when online.
 */

import { useCallback } from "react";
import { randomUUID } from "expo-crypto";
import { useQueryClient } from "@tanstack/react-query";

import { enqueue } from "@/lib/sync/queue";
import { supabase } from "@/lib/supabase";
import { emit } from "@smartout/telemetry";
import type { Database } from "@smartout/supabase/database.types";
import type { MySupplementClaimsResult } from "@/hooks/queries/use-my-supplement-claims";

type ManualSupplement = Database["payroll"]["Tables"]["manual_supplement"]["Row"];

export type SubmitSupplementPayload = {
  /** The supplement type description (e.g. "Overtidstillegg", "Reisegodtgjørelse") */
  description: string;
  /** Amount in NOK */
  amount: number;
  /** YYYY-MM-DD date the supplement applies to */
  date: string;
  /** Employee comment explaining the claim */
  comment: string;
  /** The shift this supplement is tied to — required by the DB schema */
  scheduleShiftId: string;
  /** Optional supplement_rule_id if the claim maps to a known rule */
  supplementRuleId?: string;
};

async function getProfileContext(): Promise<{
  profileId: string;
  workspaceId: string;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile, error } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (error || !profile) throw error ?? new Error("Profile not found");

  return {
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
  };
}

/**
 * Hook that returns a submitSupplement function.
 *
 * Works offline via the sync queue and optimistically adds the new claim to
 * the supplement-claims cache so the UI reflects it instantly.
 */
export function useSubmitSupplement() {
  const queryClient = useQueryClient();

  const submitSupplement = useCallback(
    async (input: SubmitSupplementPayload) => {
      const { profileId, workspaceId } = await getProfileContext();
      const claimId = randomUUID();
      const now = new Date().toISOString();

      const payload: ManualSupplement = {
        id: claimId,
        added_by: profileId,
        workspace_id: workspaceId,
        schedule_shift_id: input.scheduleShiftId,
        supplement_rule_id: input.supplementRuleId ?? null,
        description: input.description,
        amount: input.amount,
        employee_comment: input.comment,
        salary_code: null,
        status: "pending",
        reviewed_at: null,
        reviewed_by: null,
        created_at: now,
        updated_at: now,
      };

      await enqueue("supplement_claim", payload);

      // Optimistically prepend the new claim to the list
      queryClient.setQueryData<MySupplementClaimsResult>(["my-supplement-claims"], (prev) => ({
        claims: [payload, ...(prev?.claims ?? [])],
      }));

      void emit({
        event: "shift supplement_claimed",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: {
          entity: { entity_type: "shift", entity_id: input.scheduleShiftId },
          data: {
            shift_id: input.scheduleShiftId,
            supplement_rule_id: input.supplementRuleId ?? "",
            amount: input.amount,
          },
        },
      });
    },
    [queryClient],
  );

  return { submitSupplement };
}
