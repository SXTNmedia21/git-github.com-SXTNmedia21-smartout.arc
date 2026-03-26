"use client";

import { useCallback, useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import type { Json } from "@smartout/supabase";
import { dashboardKeys } from "./dashboard-keys";
import { useCascadeTasks } from "./use-cascade-tasks";

type OnboardingGuideProgress = {
  currentStep: number;
  completedSteps: string[];
  isComplete: boolean;
};

const DEFAULT_PROGRESS: OnboardingGuideProgress = {
  currentStep: 0,
  completedSteps: [],
  isComplete: false,
};

export function useOnboardingGuide() {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id ?? "";
  const { profileId } = useContext(DashboardContext);
  const queryClient = useQueryClient();
  const supabase = createClient();
  // Cascade tasks replaced the legacy useWorkspaceSetup hook — critical tasks
  // indicate the workspace still needs setup attention (same semantic as the
  // old needsSetup flag, but derived from the cascade dimension scan RPC).
  const { data: cascadeData, isLoading: isSetupLoading } = useCascadeTasks();
  const needsSetup = (cascadeData?.critical_count ?? 0) > 0;

  const queryKey = dashboardKeys.onboardingGuide(workspaceId);

  const { data } = useQuery({
    queryKey,
    enabled: !!workspaceId && !isSetupLoading,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<OnboardingGuideProgress> => {
      if (!needsSetup) {
        return { ...DEFAULT_PROGRESS, isComplete: true };
      }

      const { data: ws } = await supabase
        .from("workspace")
        .select("onboarding_guide_progress")
        .eq("workspace_id", workspaceId)
        .single();

      if (!ws) return DEFAULT_PROGRESS;

      if (!ws.onboarding_guide_progress) return DEFAULT_PROGRESS;

      const raw = ws.onboarding_guide_progress as Record<string, unknown>;
      return {
        currentStep: (raw.currentStep as number) ?? 0,
        completedSteps: (raw.completedSteps as string[]) ?? [],
        isComplete: (raw.isComplete as boolean) ?? false,
      };
    },
  });

  const progress = data ?? DEFAULT_PROGRESS;

  const mutation = useMutation({
    mutationFn: async (next: OnboardingGuideProgress) => {
      await supabase
        .from("workspace")
        .update({ onboarding_guide_progress: next as unknown as Json })
        .eq("workspace_id", workspaceId);
    },
    onSuccess: (_data, next) => {
      void emit({
        event: "onboarding_guide updated",
        workspace_id: workspaceId || null,
        actor_id: profileId ?? "",
        properties: {
          data: {
            step: next.currentStep?.toString() ?? "",
            is_complete: next.isComplete ?? false,
          },
        },
      });
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const setCurrentStep = useCallback(
    (step: number) => {
      const next = { ...progress, currentStep: step };
      mutation.mutate(next);
    },
    [progress, mutation.mutate],
  );

  const markStepComplete = useCallback(
    (stepId: string, nextStepIndex: number) => {
      const completedSteps = progress.completedSteps.includes(stepId)
        ? progress.completedSteps
        : [...progress.completedSteps, stepId];
      const next: OnboardingGuideProgress = {
        currentStep: nextStepIndex,
        completedSteps,
        isComplete: false,
      };
      mutation.mutate(next);
    },
    [progress, mutation.mutate],
  );

  return {
    currentStep: progress.currentStep,
    completedSteps: progress.completedSteps,
    isComplete: progress.isComplete,
    shouldShow: needsSetup && !progress.isComplete,
    totalSteps: 9,
    setCurrentStep,
    markStepComplete,
  };
}
