// Adapter registry — the one place code looks up "which adapter handles
// billing_dispatch_channel = 'email_customer'?".
//
// Keeping it flat (const Record) makes the mapping greppable and lets
// tests inject mocks via `getAdapter` proxy. peppol_ehf is deliberately
// absent: the enum exists for forward-compat (Fase 3), but instantiating
// an adapter class in Fase 2 would be dead code per ADR-0129.

import type { BillingDispatchChannel, DispatchAdapter } from "../";
import { EmailCustomerAdapter } from "./adapters/email-customer";
import { EmailInternalAdapter } from "./adapters/email-internal";
import { HttpApiAdapter } from "./adapters/http-api";

export const ADAPTER_REGISTRY: Partial<Record<BillingDispatchChannel, DispatchAdapter>> = {
  email_customer: EmailCustomerAdapter,
  email_internal: EmailInternalAdapter,
  http_api: HttpApiAdapter,
  // peppol_ehf: intentionally absent — Fase 3 (ADR-0129).
};

export function getAdapter(channel: BillingDispatchChannel): DispatchAdapter | null {
  return ADAPTER_REGISTRY[channel] ?? null;
}
