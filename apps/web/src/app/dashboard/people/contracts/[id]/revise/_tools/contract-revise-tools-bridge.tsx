"use client";

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useContractReviseTools } from "./use-contract-revise-tools";

type ContractReviseToolsBridgeProps = {
  contractId: string;
  navigateTo: (href: string) => void;
};

export function ContractReviseToolsBridge(props: ContractReviseToolsBridgeProps) {
  const tools = useContractReviseTools(props);
  useRegisterTools("contract-revise", tools);
  return null;
}
