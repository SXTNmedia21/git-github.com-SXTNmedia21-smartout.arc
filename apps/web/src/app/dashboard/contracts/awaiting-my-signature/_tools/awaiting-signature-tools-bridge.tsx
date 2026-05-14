"use client";

/**
 * awaiting-signature-tools-bridge.tsx — registers Botsson tools for the
 * /dashboard/contracts/awaiting-my-signature server page.
 *
 * Host is a Server Component. This bridge is a thin client island that
 * receives the serialized contract list as props + uses next/navigation
 * router for nav side-effects.
 */

import { useRouter } from "next/navigation";
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import {
  useAwaitingSignatureTools,
  type AwaitingSignatureRow,
} from "./use-awaiting-signature-tools";

type AwaitingSignatureToolsBridgeProps = {
  contracts: AwaitingSignatureRow[];
};

export function AwaitingSignatureToolsBridge({ contracts }: AwaitingSignatureToolsBridgeProps) {
  const router = useRouter();
  const tools = useAwaitingSignatureTools({
    contracts,
    navigateTo: (href) => router.push(href),
  });
  useRegisterTools("contracts-awaiting-signature", tools);
  return null;
}
