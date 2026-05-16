"use client";

/**
 * my-training-tools-bridge.tsx — registers Botsson tools for the
 * /dashboard/my-training surface.
 *
 * Why a bridge:
 *  - Keeps page.tsx clean from voice-tool registration concerns.
 *  - Receives live protocol state from the page — no duplicate fetch.
 *  - useRegisterTools handles register/unregister on mount/unmount automatically.
 *
 * ADR-0238: page does not own a domain chat surface.
 * Orb runs in interactive mode — no <DomainChatOwnership> needed.
 *
 * ADR-0151: no write tools — training step completion, test submission, and
 * confirmation signing are user-driven UI interactions only. Botsson reads
 * and navigates; it does not mutate training progress.
 *
 * access: employee, manager, admin, owner.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useMyTrainingTools, type TrainingProtocolSummary } from "./use-my-training-tools";

type MyTrainingToolsBridgeProps = {
  loading: boolean;
  protocols: TrainingProtocolSummary[];
};

export function MyTrainingToolsBridge({ loading, protocols }: MyTrainingToolsBridgeProps) {
  const tools = useMyTrainingTools({ loading, protocols });

  useRegisterTools("my-training", tools);

  return null;
}
