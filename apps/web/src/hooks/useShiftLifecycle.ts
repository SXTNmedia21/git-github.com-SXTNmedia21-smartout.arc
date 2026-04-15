"use client";

/**
 * useShiftLifecycle (web wrapper) — injects the browser Supabase client
 * into the platform-neutral hook in `@smartout/schedule`.
 *
 * Per ADR-0108 the base hook in `packages/schedule` must not import
 * browser-only APIs. Web callers use this wrapper so they keep the same
 * ergonomics (no client prop plumbing) while the shared package stays
 * importable from React Native.
 *
 * The browser client is memoized with `useMemo` so re-renders do not
 * create a new Supabase client each time (which would reset realtime
 * channels and defeat auth cookie reuse).
 */

import { useMemo } from "react";
import {
  useShiftLifecycle as useShiftLifecycleBase,
  shiftLifecycleQueryKey,
  type ShiftLifecycleRow,
  type ShiftLifecyclePhase,
  type UseShiftLifecycleOptions as BaseOptions,
} from "@smartout/schedule";
import { createClient } from "@smartout/supabase/client";

export type { ShiftLifecycleRow, ShiftLifecyclePhase };
export { shiftLifecycleQueryKey };

/**
 * Web-facing options mirror the base options but omit `supabase` — the
 * wrapper supplies it. Callers retain the same contract they had before
 * the ADR-0108 refactor.
 */
export type UseShiftLifecycleOptions = Omit<BaseOptions, "supabase">;

export function useShiftLifecycle(
  shiftId: string | null | undefined,
  opts: UseShiftLifecycleOptions = {},
) {
  // One browser client per consumer component is fine — `createClient`
  // itself is cheap; memoization keeps referential stability for any
  // downstream hook dependency arrays.
  const supabase = useMemo(() => createClient(), []);
  return useShiftLifecycleBase(shiftId, { ...opts, supabase });
}
