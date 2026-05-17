"use client";

/**
 * setup-tools-bridge.tsx — registers Botsson tools for /dashboard/setup.
 *
 * Why a bridge:
 *  - Keeps page.tsx clean from voice-tool registration.
 *  - Receives live wizard state (currentStepIndex, completedSteps, isLoading)
 *    lifted from AnimatedWizardShell via onContextChange callbacks in page.tsx.
 *    No duplicate fetch — page already tracks wizard state; this bridge re-uses it.
 *
 * ADR-0238: /dashboard/setup has NO embedded domain chat surface.
 * useWizardBotssonContext is a context-injection hook (sends step context into
 * the existing Botsson session) — NOT a second chat surface.
 * owns_chat_surface = false. No <DomainChatOwnership> needed.
 *
 * Navigation:
 *   - openStep fires window.location.href navigation to /dashboard/setup?step=<id>
 *   - proposeAdvanceStep dispatches CustomEvent("botsson:setup:advance");
 *     page.tsx registers a listener that forwards to the wizard's internal next().
 *   - restartSetup fires window.location.href = /dashboard/setup.
 *
 * Lifecycle:
 *   useRegisterTools handles register/unregister automatically on mount/unmount.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useSetupTools, type SetupToolInput } from "./use-setup-tools";

export function SetupToolsBridge(props: SetupToolInput) {
  const tools = useSetupTools(props);
  useRegisterTools("setup", tools);
  return null;
}
