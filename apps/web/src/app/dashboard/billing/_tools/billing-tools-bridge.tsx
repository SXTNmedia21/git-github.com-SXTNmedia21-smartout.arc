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
 */

import { useRouter } from "next/navigation";
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useBillingTools, type InvoiceRow } from "./use-billing-tools";

type BillingToolsBridgeProps = {
  invoices: InvoiceRow[];
};

export function BillingToolsBridge({ invoices }: BillingToolsBridgeProps) {
  const router = useRouter();

  const tools = useBillingTools({
    invoices,
    navigate: (path: string) => router.push(path),
  });

  useRegisterTools("billing", tools);

  return null;
}
