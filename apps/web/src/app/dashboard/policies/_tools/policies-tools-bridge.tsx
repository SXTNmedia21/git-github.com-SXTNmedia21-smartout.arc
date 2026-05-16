"use client";

/**
 * policies-tools-bridge.tsx — registers Botsson tools for the
 * /dashboard/policies surface.
 *
 * Why a bridge:
 *  - Keeps PoliciesPageClient clean from voice-tool registration.
 *  - Mounts only when data is ready (policies array is non-null).
 *    Prevents tools returning empty state before the server render completes.
 *
 * ADR-0238: policies is NOT a chat surface — owns_chat_surface = false.
 *   BotssonShell stays in its default mode; no DomainChatOwnership needed.
 *
 * Lifecycle:
 *  - useRegisterTools handles register/unregister automatically on mount/unmount.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { usePoliciesTools, type PoliciesToolInput } from "./use-policies-tools";

type PoliciesToolsBridgeProps = PoliciesToolInput;

export function PoliciesToolsBridge({
  policies,
  openCreateDialog,
  openPolicyById,
}: PoliciesToolsBridgeProps) {
  const tools = usePoliciesTools({
    policies,
    openCreateDialog,
    openPolicyById,
  });

  useRegisterTools("policies", tools);

  return null;
}
