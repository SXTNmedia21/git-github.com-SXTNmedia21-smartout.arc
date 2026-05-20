"use client";

/**
 * operations-tools-bridge.tsx — registers Botsson tools for /dashboard/operations.
 *
 * Hosted inside OperationsPage so it captures live data from useOperationsData()
 * and the department breakdown state. Returns null. Tools auto-unregister on
 * unmount (route change).
 *
 * ADR-0238 check: /dashboard/operations has NO in-page chat surface.
 * owns_chat_surface = false. BotssonShell renders in normal interactive mode.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useOperationsTools, type OperationsToolInput } from "./use-operations-tools";

export function OperationsToolsBridge(props: OperationsToolInput) {
  const tools = useOperationsTools(props);
  useRegisterTools("operations", tools);
  return null;
}
