"use client";

/**
 * close-tools-bridge.tsx — registers Botsson tools for the /dashboard/close surface.
 *
 * Why a bridge:
 *  - Keeps CloseOutFlow clean from voice-tool registration.
 *  - Mounts only when a department is selected (departmentId non-null), preventing
 *    tools from returning stale state before session data arrives.
 *
 * Data sourcing:
 *  - Receives live state and the submit callback from CloseOutFlow via props.
 *    No duplicate fetch — CloseOutFlow already owns all queries and mutations.
 *
 * Lifecycle:
 *  - useRegisterTools handles register/unregister automatically on mount/unmount.
 *
 * ADR-0238: /dashboard/close has no in-page chat surface — Orb is interactive.
 *   No <DomainChatOwnership> needed.
 * ADR-0151: write tool (proposeSubmitClose) delegates to useSubmitReconciliation
 *   which already resolves workspace_id + profile_id server-side.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useCloseTools, type CloseToolInput } from "./use-close-tools";

export function CloseToolsBridge(props: CloseToolInput) {
  const tools = useCloseTools(props);
  useRegisterTools("close", tools);
  return null;
}
