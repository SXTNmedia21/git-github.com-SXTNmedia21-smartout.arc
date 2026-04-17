// PlaceholderAdapter — audit-safe mock integration (ADR-0129).
//
// Every billing_integration row flagged is_placeholder=true MUST route
// through this adapter. The contract:
//
//  - sync() returns { status: 'mocked' } — NEVER 'succeeded'. Audit
//    readers and downstream emitters distinguish the two so the log
//    never claims a real remote call happened when it did not.
//  - testConnection() returns { status: 'ok', is_placeholder: true }
//    so the platform-admin UI can render the distinct "placeholder"
//    badge next to the success state.
//
// Fase 3 replaces the registry entries for `fiken`, `tripletex`, and
// `stripe` with real implementations. The PlaceholderAdapter itself
// stays: it is the intentional mock targeted by `placeholder` rows for
// rehearsal / QA environments.

import type { IntegrationAdapter, SyncResult, IntegrationTestConnectionResult } from "../types";

export const PlaceholderAdapter: IntegrationAdapter = {
  type: "placeholder",
  supports: ["customer", "invoice", "contract", "product", "plan"],

  async sync(): Promise<SyncResult> {
    // ADR-0129: the one branch that MUST return 'mocked' rather than
    // 'succeeded'. The sync_integration handler asserts this and emits
    // 'integration audit violation' if a mis-wired mock leaks through.
    return { status: "mocked", external_reference: null };
  },

  async testConnection(): Promise<IntegrationTestConnectionResult> {
    return { status: "ok", is_placeholder: true };
  },
};
