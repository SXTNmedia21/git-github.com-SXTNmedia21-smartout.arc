"use client";

/**
 * useShiftLifecycle — re-exports the platform-neutral hook from
 * `@smartout/schedule` (uses `createClient()` from `@smartout/supabase/client`
 * inside the package, which resolves to the correct surface per import).
 *
 * The previous web-only wrapper that injected a Supabase client was
 * removed when the shared hook stopped accepting an injected `supabase`
 * option; callers keep importing from this path for a stable public API.
 */

export {
  useShiftLifecycle,
  type ShiftLifecycleRow,
  type ShiftLifecyclePhase,
  type UseShiftLifecycleOptions,
} from "@smartout/schedule";
