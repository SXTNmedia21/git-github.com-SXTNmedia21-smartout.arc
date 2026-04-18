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

export type UseShiftLifecycleMobileOptions = UseShiftLifecycleOptions;

/**
 * useShiftLifecycle — re-exports the platform-neutral @smartout/schedule hook
 * (uses `@smartout/supabase/client` which resolves to the RN client here).
 */
export function useShiftLifecycle(
  shiftId: string | null | undefined,
  opts: UseShiftLifecycleMobileOptions = {},
) {
  return baseUseShiftLifecycle(shiftId, opts);
}

export type { ShiftLifecycleRow };
