/**
 * useShiftLifecycle (mobile wrapper) — injects the React Native Supabase
 * client into the platform-neutral base hook from @smartout/schedule
 * (ADR-0108).
 *
 * The RN client (apps/mobile/src/lib/supabase.ts) uses
 * @supabase/supabase-js directly with expo-secure-store on native and
 * localStorage on web-via-Expo, never @supabase/ssr. This keeps the
 * mobile bundle free of browser-cookie and NEXT_PUBLIC_* dependencies.
 */

import { supabase } from "@/lib/supabase";
import {
  useShiftLifecycle as baseUseShiftLifecycle,
  shiftLifecycleQueryKey,
  type ShiftLifecycleRow,
  type ShiftLifecyclePhase,
  type UseShiftLifecycleOptions as BaseOptions,
} from "@smartout/schedule";

export type UseShiftLifecycleMobileOptions = Omit<BaseOptions, "supabase">;

export function useShiftLifecycle(
  shiftId: string | null | undefined,
  opts: UseShiftLifecycleMobileOptions = {},
) {
  return baseUseShiftLifecycle(shiftId, { ...opts, supabase });
}

export { shiftLifecycleQueryKey };
export type { ShiftLifecycleRow, ShiftLifecyclePhase };
