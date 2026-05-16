"use client";

/**
 * awaiting-signature-tools-bridge.tsx — registers Botsson tools for the
 * /dashboard/contracts/awaiting-my-signature server page.
 *
 * Host is a Server Component. This bridge is a thin client island that
 * receives the serialized contract list as props + uses next/navigation
 * router for nav side-effects.
 *
 * Telemetry: emits contracts.awaiting_signature.viewed once after workspace +
 * actor are known. workspace_id + actor_id resolved from DashboardContext per
 * ADR-0134 R1. pendingCount is serialized from the server page's filtered list.
 */

import { useContext, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { emit, nonEmpty } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import {
  useAwaitingSignatureTools,
  type AwaitingSignatureRow,
} from "./use-awaiting-signature-tools";

type AwaitingSignatureToolsBridgeProps = {
  contracts: AwaitingSignatureRow[];
  pendingCount: number;
};

export function AwaitingSignatureToolsBridge({
  contracts,
  pendingCount,
}: AwaitingSignatureToolsBridgeProps) {
  const router = useRouter();
  const { workspaceData, profileId } = useContext(DashboardContext);
  const workspaceId = workspaceData?.workspace_id ?? null;

  const viewedRef = useRef(false);
  useEffect(() => {
    if (!workspaceId || !profileId || viewedRef.current) return;
    viewedRef.current = true;
    void emit({
      event: "contracts.awaiting_signature.viewed",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "workspace",
          entity_id: workspaceId,
          entity_label: "Awaiting Signature",
        },
        data: {
          pending_count: pendingCount,
        },
      },
    });
  }, [workspaceId, profileId, pendingCount]);

  const tools = useAwaitingSignatureTools({
    contracts,
    navigateTo: (href) => router.push(href),
  });
  useRegisterTools("contracts-awaiting-signature", tools);
  return null;
}
