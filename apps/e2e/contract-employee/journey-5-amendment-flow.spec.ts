import { test, expect } from "@playwright/test";

/**
 * Journey 5 — Amendment Flow: Classify, Propose, and Re-sign
 * Source: docs/architecture/contract-service/JOURNEY-contract-module.md (Journey 5)
 *
 * Status: SCAFFOLDED — live execution deferred to follow-up wave.
 * Tests defined here capture happy path + critical error paths.
 * Mark `test` (not `test.skip`) when infra (auth helpers, seed, data-testids) ready.
 */

test.describe("Journey 5: Amendment Flow — Classify, Propose, and Re-sign", () => {
  test.skip("happy path: hourly_rate amendment → classify_change → MATERIAL → DocuSeal re-sign", async ({
    page,
  }) => {
    // TODO: setup workspace + admin + employee + active employment_contract
    // TODO: login as admin
    // TODO: navigate to /contracts/:id/amend
    // TODO: change hourly_rate from 200 to 250
    // TODO: click "Klassifiser endring"
    // TODO: assert change classified as MATERIAL (wage increase > 10%)
    // TODO: assert banner: "Denne endringen krever ny signering"
    // TODO: click "Foreslå endring"
    // TODO: fill amendment_reason: "Promosjon, ansv. leder"
    // TODO: click "Send til signering"
    // TODO: assert DocuSeal webhook triggered (or stubbed)
    // TODO: assert status transitions to 'amendment_pending_signature'
    // TODO: assert employee receives notification
  });

  test.skip("error path: job_title + agreed_weekly_hours combo → is_constructive_dismissal_risk → §15-7 banner + admin checkbox", async ({
    page,
  }) => {
    // TODO: setup workspace + admin + employee + active employment_contract
    // TODO: login as admin
    // TODO: navigate to /contracts/:id/amend
    // TODO: change job_title to lower-paying role AND reduce agreed_weekly_hours by 50%
    // TODO: click "Klassifiser endring"
    // TODO: assert combo classified as constructive_dismissal_risk
    // TODO: assert banner: "Denne endringen kan utgjøre en faktisk oppsigelse (AML §15-7)"
    // TODO: assert admin checkbox required: "Jeg forstår og godtar ansvaret"
    // TODO: attempt to send without checking
    // TODO: assert "Send" button disabled
    // TODO: check checkbox
    // TODO: assert "Send" button enabled
  });

  test.skip("error path: ADMIN-class amendment → no employee signature required → constraint allows accept", async ({
    page,
  }) => {
    // TODO: setup workspace + admin + active employment_contract
    // TODO: login as admin
    // TODO: navigate to /contracts/:id/amend
    // TODO: change internal note field (admin-only, not part of employee contract)
    // TODO: click "Klassifiser endring"
    // TODO: assert change classified as ADMIN_ONLY (employee not affected)
    // TODO: assert no "Send til signering" CTA shown
    // TODO: assert "Lagre endring" button shown instead
    // TODO: click "Lagre endring"
    // TODO: assert contract updated without DocuSeal re-sign
    // TODO: assert no employee notification sent
  });
});
