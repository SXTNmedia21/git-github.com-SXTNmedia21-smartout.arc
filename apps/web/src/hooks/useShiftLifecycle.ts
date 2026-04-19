"use client";

/**
 * useShiftLifecycle (web wrapper) — injects the browser Supabase client
 * into the platform-neutral base hook from @smartout/schedule (ADR-0108).
 *
 * Callers pass only the shift id; this wrapper constructs the browser
 * client via useMemo and forwards to the base hook. Public API matches
 * the pre-ADR-0108 signature so callers retain their ergonomics.
 */

import { useMemo } from "react";
import { createClient } from "@smartout/supabase/client";
import {
  useShiftLifecycle as baseUseShiftLifecycle,
  shiftLifecycleQueryKey,
  type ShiftLifecycleRow,
  type ShiftLifecyclePhase,
  type UseShiftLifecycleOptions as BaseOptions,
} from "@smartout/schedule";

export type UseShiftLifecycleOptions = Omit<BaseOptions, "supabase">;

export function useShiftLifecycle(
  shiftId: string | null | undefined,
  opts: UseShiftLifecycleOptions = {},
) {
  const supabase = useMemo(() => createClient(), []);
  return baseUseShiftLifecycle(shiftId, { ...opts, supabase });
}

export { shiftLifecycleQueryKey };
export type { ShiftLifecycleRow, ShiftLifecyclePhase };
