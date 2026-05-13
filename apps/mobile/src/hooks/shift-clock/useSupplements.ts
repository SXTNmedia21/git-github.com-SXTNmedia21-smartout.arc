/**
 * useSupplements — Manual supplement options and offline-first claim submission.
 *
 * Supplements are extra wage components an employee can manually claim during
 * or after a shift (e.g. "used own car", "worked a public holiday", "brought
 * equipment"). They live in payroll.supplement_rule (config) and
 * payroll.manual_supplement (per-shift claims).
 *
 * Claiming a supplement works offline: the claim is enqueued via the sync queue
 * and optimistically prepended to the claims cache so the employee sees it
 * immediately regardless of connectivity.
 */

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";

import { supabase } from "@/lib/supabase";
import { enqueue } from "@/lib/sync/queue";

/** A manual-type supplement rule available for the employee to claim */
export type ManualSupplementOption = {
  supplement_rule_id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  salary_code: string;
  amount: number;
  rate_type: "per_hour" | "per_shift";
  /** Whether the employee must provide a comment when claiming */
  comment_required: boolean;
  is_active: boolean;
};

/** A claimed manual supplement for a specific shift */
export type ManualSupplementClaim = {
  manual_supplement_id: string;
  supplement_rule_id: string;
  shift_id: string;
  profile_id: string;
  workspace_id: string;
  comment: string | null;
  /** True while the claim is queued but not yet confirmed by Supabase */
  _isPending?: boolean;
  created_at: string;
  updated_at: string;
};

const RULES_STALE_TIME_MS = Infinity; // supplement rules are admin config — rarely change
const CLAIMS_STALE_TIME_MS = 2 * 60 * 1_000;

function supplementRulesKey(workspaceId: string | null | undefined) {
  return ["supplement-rules-manual", workspaceId ?? null] as const;
}

function supplementClaimsKey(shiftId: string | null | undefined) {
  return ["supplement-claims", shiftId ?? null] as const;
}

async function fetchManualSupplementOptions(
  workspaceId: string,
): Promise<ManualSupplementOption[]> {
  // supplement_rule lives in the payroll schema — not in generated types, cast to any
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data, error } = await (supabase as any)
    .schema("payroll")
    .from("supplement_rule")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("type", "manual")
    .eq("is_active", true)
    .order("name", { ascending: true });
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (error) throw error;
  return (data ?? []) as ManualSupplementOption[];
}

async function fetchSupplementClaims(shiftId: string): Promise<ManualSupplementClaim[]> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data, error } = await (supabase as any)
    .schema("payroll")
    .from("manual_supplement")
    .select("*")
    .eq("shift_id", shiftId)
    .order("created_at", { ascending: false });
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (error) throw error;
  return (data ?? []) as ManualSupplementClaim[];
}

export type SupplementsActions = {
  /** Available manual supplements the employee can claim for this shift */
  options: ManualSupplementOption[];
  /** Supplements already claimed for this shift */
  claims: ManualSupplementClaim[];
  isLoadingOptions: boolean;
  isLoadingClaims: boolean;
  /**
   * Claims a supplement for the current shift.
   * Works offline — enqueues to sync queue with optimistic cache update.
   */
  claimSupplement: (params: {
    supplementRuleId: string;
    profileId: string;
    workspaceId: string;
    comment?: string;
  }) => Promise<void>;
};

/**
 * Hook: provides available manual supplement options and claimed supplements
 * for a given shift, plus an offline-first claimSupplement mutation.
 *
 * Pass workspaceId to load available options, shiftId to load and manage
 * claims for that specific shift.
 */
export function useSupplements(
  shiftId: string | null | undefined,
  workspaceId: string | null | undefined,
): SupplementsActions {
  const queryClient = useQueryClient();

  const { data: options, isLoading: isLoadingOptions } = useQuery<ManualSupplementOption[]>({
    queryKey: supplementRulesKey(workspaceId),
    // Casts are safe because the query is gated by `enabled: !!workspaceId`
    // (and the symmetric shiftId guard below). Avoiding `?? ""` to satisfy
    // smartout/no-empty-string-identifier-fallback — ADR-0134 / L-0083.
    queryFn: () => fetchManualSupplementOptions(workspaceId as string),
    staleTime: RULES_STALE_TIME_MS,
    enabled: !!workspaceId,
    retry: 1,
  });

  const { data: claims, isLoading: isLoadingClaims } = useQuery<ManualSupplementClaim[]>({
    queryKey: supplementClaimsKey(shiftId),
    queryFn: () => fetchSupplementClaims(shiftId as string),
    staleTime: CLAIMS_STALE_TIME_MS,
    enabled: !!shiftId,
    retry: 1,
  });

  /**
   * Claims a manual supplement for the current shift.
   *
   * 1. Generates a client-side UUID for the manual_supplement_id
   * 2. Optimistically prepends the claim to the cache with _isPending = true
   * 3. Enqueues a supplement_claim action in the SQLite sync queue
   */
  const claimSupplement = useCallback(
    async (params: {
      supplementRuleId: string;
      profileId: string;
      workspaceId: string;
      comment?: string;
    }) => {
      // Fail fast on missing shift identity. ADR-0134 R5.2-3 / L-0083:
      // never enqueue a manual_supplement row with empty-string identifiers.
      if (!shiftId) {
        throw new Error("useSupplements.claimSupplement called without an active shiftId");
      }
      const { supplementRuleId, profileId, workspaceId: claimWorkspaceId, comment } = params;
      const claimId = randomUUID();
      const now = new Date().toISOString();

      const optimistic: ManualSupplementClaim = {
        manual_supplement_id: claimId,
        supplement_rule_id: supplementRuleId,
        shift_id: shiftId,
        profile_id: profileId,
        workspace_id: claimWorkspaceId,
        comment: comment ?? null,
        _isPending: true,
        created_at: now,
        updated_at: now,
      };

      queryClient.setQueryData<ManualSupplementClaim[]>(supplementClaimsKey(shiftId), (old) => {
        return old ? [optimistic, ...old] : [optimistic];
      });

      // Column names per packages/supabase manual_supplement Insert type:
      // id, added_by, schedule_shift_id (not manual_supplement_id/profile_id/shift_id).
      // Fix surfaced 2026-04-17 by ADR-0134 schema validation at enqueue.
      await enqueue("supplement_claim", {
        id: claimId,
        added_by: profileId,
        schedule_shift_id: shiftId,
        supplement_rule_id: supplementRuleId,
        workspace_id: claimWorkspaceId,
        employee_comment: comment ?? null,
        created_at: now,
        updated_at: now,
      });
    },
    [shiftId, queryClient],
  );

  return {
    options: options ?? [],
    claims: claims ?? [],
    isLoadingOptions,
    isLoadingClaims,
    claimSupplement,
  };
}
