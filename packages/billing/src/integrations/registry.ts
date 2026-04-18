// Integration adapter registry — single lookup point for
// "which adapter handles billing_integration_type = 'fiken'?".
//
// Fase 2 intentionally wires ALL enum values to PlaceholderAdapter.
// Fase 3 replaces `fiken`, `tripletex`, and `stripe` entries with real
// implementations (ADR-0129). The audit-violation guard in the
// sync_integration handler double-checks is_placeholder vs adapter
// output so this compile-time mapping cannot accidentally lie.

import type { BillingIntegrationType } from "../types";
import type { IntegrationAdapter } from "./types";
import { PlaceholderAdapter } from "./adapters/placeholder";

export const integrationAdapterRegistry: Record<BillingIntegrationType, IntegrationAdapter> = {
  placeholder: PlaceholderAdapter,
  // Fase 3 replaces the next three entries with real adapters. Keeping
  // them on PlaceholderAdapter for Fase 2 preserves end-to-end shape
  // testing without any real remote call.
  fiken: PlaceholderAdapter,
  tripletex: PlaceholderAdapter,
  stripe: PlaceholderAdapter,
};

export function getIntegrationAdapter(type: BillingIntegrationType): IntegrationAdapter {
  return integrationAdapterRegistry[type];
}
