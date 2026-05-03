import { test, expect } from "@playwright/test";

/**
 * Journey 3 — Employee Receives and Signs Contract
 * Source: docs/architecture/contract-service/JOURNEY-contract-module.md (Journey 3)
 *
 * Status: SCAFFOLDED — live execution deferred to follow-up wave.
 * Tests defined here capture happy path + critical error paths.
 * Mark `test` (not `test.skip`) when infra (auth helpers, seed, data-testids) ready.
 */

test.describe("Journey 3: Employee Receives and Signs Contract", () => {
  test.skip("happy path: webhook simulation → status='active' → my-contract renders", async ({
    page,
  }) => {
    // TODO: setup workspace + admin + employee profile + employment_contract (status: sent_pending_signature)
    // TODO: trigger DocuSeal webhook stub (or manually call /api/contracts/webhook/docuseal)
    // TODO: payload: { status: 'completed', contract_id: '...', signed_at: '2026-04-29T...' }
    // TODO: assert contract.status transitions to 'active'
    // TODO: login as employee
    // TODO: navigate to /dashboard/my-contract
    // TODO: assert contract renders with details: employer, position, start_date, end_date
    // TODO: assert "Mine obligasjoner" section visible
  });

  test.skip("error path: ansatt without contract → empty-state", async ({ page }) => {
    // TODO: setup workspace + employee profile with NO employment_contract
    // TODO: login as employee
    // TODO: navigate to /dashboard/my-contract
    // TODO: assert empty state: "Du har ingen ansettelseskontrakt"
    // TODO: assert CTA button: "Kontakt din leder"
  });

  test.skip("error path: RevealableField click reveals → audit emit fires", async ({ page }) => {
    // TODO: setup workspace + employee + signed employment_contract
    // TODO: login as employee
    // TODO: navigate to /dashboard/my-contract
    // TODO: locate personnummer field (masked by default: "***-***-***")
    // TODO: click reveal icon
    // TODO: assert personnummer unmasked
    // TODO: assert telemetry event emitted: { event: 'contract_pii_revealed', actor_id, workspace_id }
    // TODO: verify event reaches activity_trail table
  });
});
