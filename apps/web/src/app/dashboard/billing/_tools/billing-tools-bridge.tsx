"use client";

/**
 * billing-tools-bridge.tsx — registers Botsson tools for /dashboard/billing root.
 *
 * Why a bridge:
 *  - Billing page is a Server Component; tool registration requires a client boundary.
 *  - Receives pre-fetched invoice data as props from the server page — no duplicate fetch.
 *  - useRegisterTools handles register/unregister automatically on mount/unmount.
 *
 * Scope: root /dashboard/billing ONLY.
 * Sub-routes ([invoice_id]/, settings/) register their own tools if needed.
 *
 * ADR-0238: owns_chat_surface=false — billing does not declare chat ownership.
 * ADR-0151: workspace_id resolved server-side; not forwarded to client tools.
 *
 * Telemetry: emits billing.invoices.viewed once on mount after workspace + actor
 * are known. L-0177: emit is skipped when either id is missing/empty.
 */

import { useContext, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { emit, nonEmpty } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useBillingTools, type InvoiceRow } from "./use-billing-tools";

type BillingToolsBridgeProps = {
  invoices: InvoiceRow[];
};

export function BillingToolsBridge({ invoices }: BillingToolsBridgeProps) {
  const router = useRouter();
  const { workspaceData, profileId } = useContext(DashboardContext);
  const workspaceId = workspaceData?.workspace_id ?? null;

  const tools = useBillingTools({
    invoices,
    navigate: (path: string) => router.push(path),
  });

  useRegisterTools("billing", tools);

  // ── View-emit — billing.invoices.viewed ───────────────────────────────────
  // Fires once per mount. L-0177: skipped if workspace_id or actor_id is empty.
  const viewedRef = useRef(false);
  useEffect(() => {
    if (!workspaceId || !profileId || viewedRef.current) return;
    viewedRef.current = true;
    void emit({
      event: "billing.invoices.viewed",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "workspace",
          entity_id: workspaceId,
          entity_label: "Billing",
        },
        data: {
          invoice_count: invoices.length,
        },
      },
    });
  }, [workspaceId, profileId, invoices.length]);

  return null;
}
