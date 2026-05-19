"use client";

/**
 * contract-detail-tools-bridge.tsx — registers Botsson tools for
 * /dashboard/people/contracts/[id].
 *
 * ADR-0238: page does not own a domain chat surface.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useContractDetailTools, type ContractDetailRow } from "./use-contract-detail-tools";

type ContractDetailToolsBridgeProps = {
  loading: boolean;
  contractId: string;
  contract: ContractDetailRow | null;
  navigateTo: (href: string) => void;
};

export function ContractDetailToolsBridge(props: ContractDetailToolsBridgeProps) {
  const tools = useContractDetailTools(props);
  useRegisterTools("contract-detail", tools);
  return null;
}
