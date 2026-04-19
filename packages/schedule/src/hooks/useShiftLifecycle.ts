/**
 * useShiftLifecycle — single source of truth for the shift timeline UI.
 *
 * Reads from `v_shift_lifecycle` (ADR-0095 Phase 5), which aggregates
 * Execution / Reality / Interpretation / Derivation / Decision into one
 * row and computes the phenomenological `phase` key:
 *   planlegges · pagar · oppgjor · avsluttet
 *
 * Workspace scope is enforced by RLS on the view's underlying tables
 * (`security_invoker = true`). The hook does not need to pass workspace_id.
 *
 * Platform-neutral per ADR-0108: the `supabase` client is injected via
 * options. Web and mobile each provide their own wrapper that constructs
 * the platform-appropriate client and forwards to this base hook.
 *
 * This file MUST NOT contain "use client", import `@smartout/supabase/*`,
 * or reference window/document/process.env.
 */

import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase/database.types";

export type ShiftLifecyclePhase = "planlegges" | "pagar" | "oppgjor" | "avsluttet";

export type ShiftLifecycleRow = {
  shift_id: string;
  workspace_id: string;
  department_id: string;
  employee_id: string | null;
  shift_date: string;
  phase: ShiftLifecyclePhase;
  scheduled_hours: number | null;
  interpreted_hours: number | null;
  approved_hours: number | null;
  gross_cost: number | null;
  shift_status: string | null;
  session_status: string | null;
  approval_status: string | null;
  reconciliation_status: string | null;
  last_punch_in: string | null;
  last_punch_out: string | null;
  has_deviation: boolean;
  has_blocking_deviation: boolean;
};

export type UseShiftLifecycleOptions = {
  /** Supabase client — required, injected by the platform wrapper (ADR-0108). */
  supabase: SupabaseClient<Database>;
  /** Enable Suspense integration — defaults to `false` for safety on older React trees. */
  suspense?: boolean;
  /** Stable override for tests/storybook. When provided, no network call is made. */
  initialData?: ShiftLifecycleRow;
  /** Disable the query — useful while a shift id is not yet known. */
  enabled?: boolean;
};

/** Query-key factory — shared across platforms so invalidations line up. */
export function shiftLifecycleQueryKey(shiftId: string | null | undefined) {
  return ["shift-lifecycle", shiftId] as const;
}

export function useShiftLifecycle(
  shiftId: string | null | undefined,
  opts: UseShiftLifecycleOptions,
) {
  const { supabase, enabled: enabledOpt, initialData } = opts;
  const enabled = (enabledOpt ?? true) && !!shiftId;

  return useQuery<ShiftLifecycleRow | null>({
    queryKey: shiftLifecycleQueryKey(shiftId),
    queryFn: async () => {
      if (!shiftId) return null;
      // The generated database.types.ts does not yet include
      // `v_shift_lifecycle` (view was added in 20260508100000 and the
      // types regeneration is part of a separate chore). Cast to
      // `unknown` then to the explicit client shape so the view is
      // queryable without weakening consumer types.
      const client = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (
              column: string,
              value: string,
            ) => {
              single: () => Promise<{
                data: ShiftLifecycleRow | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      };
      const { data, error } = await client
        .from("v_shift_lifecycle")
        .select("*")
        .eq("shift_id", shiftId)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled,
    staleTime: 30_000,
    initialData,
  });
}
