/**
 * useOnboardingProgress — lightweight TanStack Query wrapper for the employee
 * onboarding BFF state endpoint.
 *
 * Returns { done, total, status } — enough for the home CTA card to render
 * a "X steg igjen" badge and hide itself when status === "completed".
 *
 * Delegates auth + fetch to getOnboardingState() in onboarding-bff.ts so we
 * get the same Bearer-token pattern used by the wizard itself (ADR-0132).
 *
 * 30 s staleTime — gentle background refetch; card is informational only
 * so sub-second freshness is unnecessary.
 */

import { useQuery } from "@tanstack/react-query";
import { getOnboardingState } from "@/lib/onboarding-bff";

// ─── Types ────────────────────────────────────────────────────────────────────

type OnboardingStatus = "in_progress" | "dismissed" | "completed";

export type OnboardingProgressData = {
  done: number;
  total: number;
  status: OnboardingStatus;
};

// Total number of wizard steps (must match BFF + wizard screen count).
const TOTAL_STEPS = 8;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOnboardingProgress() {
  return useQuery<OnboardingProgressData>({
    queryKey: ["onboarding-progress", "v1"],
    staleTime: 30_000,
    queryFn: async (): Promise<OnboardingProgressData> => {
      const state = await getOnboardingState();
      const done = Math.min(state.current_step_index, TOTAL_STEPS);
      return {
        done,
        total: TOTAL_STEPS,
        status: state.status as OnboardingStatus,
      };
    },
  });
}
