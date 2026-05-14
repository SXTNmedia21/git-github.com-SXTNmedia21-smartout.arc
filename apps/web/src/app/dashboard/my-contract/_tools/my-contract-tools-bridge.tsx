"use client";

/**
 * my-contract-tools-bridge.tsx — registers Botsson tools for the
 * /dashboard/my-contract surface.
 *
 * Why a bridge:
 *  - Keeps page.tsx clean from voice-tool registration concerns.
 *  - Receives live state from the page via props — no duplicate fetch.
 *  - useRegisterTools handles register/unregister on mount/unmount automatically.
 *
 * ADR-0238: this page does not own a domain chat surface. No
 * <DomainChatOwnership> needed — Orb runs in interactive mode.
 * ADR-0151: amendment accept/decline are NOT exposed as tools; they require
 * explicit UI interaction (no unilateral write on the employee's behalf).
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useMyContractTools, type ContractSummary } from "./use-my-contract-tools";

type MyContractToolsBridgeProps = {
  activeContract: ContractSummary | null;
  history: ContractSummary[];
  loading: boolean;
  paydayRegular: number | null;
  hasPendingAmendment: boolean;
};

export function MyContractToolsBridge({
  activeContract,
  history,
  loading,
  paydayRegular,
  hasPendingAmendment,
}: MyContractToolsBridgeProps) {
  const tools = useMyContractTools({
    activeContract,
    history,
    loading,
    paydayRegular,
    hasPendingAmendment,
  });

  useRegisterTools("my-contract", tools);

  return null;
}
