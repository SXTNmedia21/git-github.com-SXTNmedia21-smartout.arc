"use client";

/**
 * contracts-tools-bridge.tsx — registers Botsson tools for /dashboard/people/contracts.
 *
 * Mounted inside ContractsPage so it captures live contract data + UI actions.
 * Returns null — side-effect only. Tools are unregistered automatically on
 * unmount (route change).
 *
 * Bridge props mirror ContractsToolInput so the page can pass live state
 * down without lifting hooks here.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useContractsTools, type ContractsToolInput } from "./use-contracts-tools";

export function ContractsToolsBridge(props: ContractsToolInput) {
  const tools = useContractsTools(props);
  useRegisterTools("contracts", tools);
  return null;
}
