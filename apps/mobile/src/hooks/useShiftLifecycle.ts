/**
 * useShiftLifecycle (mobile wrapper) — injects the RN Supabase client into
 * the platform-neutral hook from @smartout/schedule (ADR-0108).
 *
 * Callers pass only the shift id; the mobile-specific client is wired here
 * so feature code stays platform-agnostic. Returns the same shape as the
 * base hook.
 */

import {
  useShiftLifecycle as baseUseShiftLifecycle,
  type ShiftLifecycleRow,
  type UseShiftLifecycleOptions,
} from "@smartout/schedule";

import { supabase } from "@/lib/supabase";

export type UseShiftLifecycleMobileOptions = Omit<UseShiftLifecycleOptions, "supabase">;

export function useShiftLifecycle(
  shiftId: string | null | undefined,
  opts: UseShiftLifecycleMobileOptions = {},
) {
  return baseUseShiftLifecycle(shiftId, { ...opts, supabase });
}

export type { ShiftLifecycleRow };
export { shiftLifecycleQueryKey } from "@smartout/schedule";
