"use client";

/**
 * useOnboardingProgress — TanStack Query wrapper for the employee onboarding
 * BFF state endpoint (web side).
 *
 * Called from server-rendered dashboard context; uses cookie-based session
 * auth (credentials: "include") so no explicit token handling is needed.
 *
 * Returns { done, total, status } — enough for a dashboard CTA card to show
 * progress and hide itself when status === "completed".
 *
 * 30 s staleTime — informational card; aggressive refetch not warranted.
 */

import { useQuery } from "@tanstack/react-query";

// ─── Types ────────────────────────────────────────────────────────────────────

type OnboardingStatus = "in_progress" | "dismissed" | "completed";

type BffStateBody = {
  ok: boolean;
  state: {
    status: OnboardingStatus;
    current_step_index: number;
    step_data: Record<string, unknown>;
    dismissed_at: string | null;
    completed_at: string | null;
  };
};

export type OnboardingProgressData = {
  done: number;
  total: number;
  status: OnboardingStatus;
};

// Total number of wizard steps (must match BFF + mobile wizard screen count).
const TOTAL_STEPS = 8;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOnboardingProgress() {
  return useQuery<OnboardingProgressData>({
    queryKey: ["onboarding-progress-web", "v1"],
    staleTime: 30_000,
    queryFn: async (): Promise<OnboardingProgressData> => {
      const res = await fetch("/api/employee-onboarding/state", {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`state fetch failed (${res.status})`);
      const body = (await res.json()) as BffStateBody;
      const done = Math.min(body.state.current_step_index, TOTAL_STEPS);
      return {
        done,
        total: TOTAL_STEPS,
        status: body.state.status,
      };
    },
  });
}
