"use client";

/**
 * governance-tools-bridge.tsx — registers Botsson tools for /dashboard/governance.
 *
 * Hosted inside the GovernancePage so it captures live protocol + deviation state.
 * Returns null. Tools are unregistered automatically on unmount (route change).
 *
 * ADR-0238: /dashboard/governance has NO embedded domain chat surface.
 * BotssonShell operates in normal interactive mode on this route.
 * No <DomainChatOwnership> required.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useGovernanceTools, type GovernanceToolInput } from "./use-governance-tools";

export function GovernanceToolsBridge(props: GovernanceToolInput) {
  const tools = useGovernanceTools(props);
  useRegisterTools("governance", tools);
  return null;
}
