"use client";

/**
 * onboarding-assistant-tools-bridge.tsx — registers Botsson tools for the
 * /dashboard/onboarding-assistant surface.
 *
 * Why a bridge:
 *  - Keeps the page component clean from voice-tool registration.
 *  - Receives live data + navigation handler from the parent page via props.
 *    No duplicate fetch — the parent holds the step/progress state.
 *
 * ADR-0238: No <DomainChatOwnership> needed.
 *  AssistantUI is a holding placeholder (no active chat textbox). Botsson
 *  Orb renders normally in interactive mode.
 *
 * Lifecycle:
 *  - useRegisterTools handles register/unregister automatically on mount/unmount.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useOnboardingAssistantTools, type OnboardingStep } from "./use-onboarding-assistant-tools";

type OnboardingAssistantToolsBridgeProps = {
  steps: OnboardingStep[];
  completedCount: number;
  totalCount: number;
  navigate: (path: string) => void;
};

export function OnboardingAssistantToolsBridge({
  steps,
  completedCount,
  totalCount,
  navigate,
}: OnboardingAssistantToolsBridgeProps) {
  const tools = useOnboardingAssistantTools({
    steps,
    completedCount,
    totalCount,
    navigate,
  });

  useRegisterTools("onboarding-assistant", tools);

  return null;
}
