import { test, expect } from "@playwright/test";

/**
 * Journey 1 — Define Employment Basis
 * Source: docs/architecture/contract-service/JOURNEY-contract-module.md (Journey 1)
 *
 * Status: SCAFFOLDED — live execution deferred to follow-up wave.
 * Tests defined here capture happy path + critical error paths.
 * Mark `test` (not `test.skip`) when infra (auth helpers, seed, data-testids) ready.
 */

test.describe("Journey 1: Define Employment Basis", () => {
  test.skip("happy path: admin saves Ansettelse + Lønnsprofil + Tipsregel", async ({ page }) => {
    // TODO: setup workspace + admin profile via seed helper
    // TODO: navigate to /contracts/new/basis-definition
    // TODO: fill form: startDate, endDate, probationPeriodMonths, jobTitle, department
    // TODO: click "Lagre Ansettelse"
    // TODO: assert status changes to saved
    // TODO: fill payroll fields: hourlyRate, weeklyHours, tariffKey
    // TODO: assert framework_rule lookup succeeds
    // TODO: fill tip rule: percentages, categories
    // TODO: click "Fullført"
    // TODO: assert journey advances to Journey 2
  });

  test.skip("error path: prøvetid > 6 mnd blocked", async ({ page }) => {
    // TODO: setup workspace + admin
    // TODO: navigate to basis-definition form
    // TODO: fill probationPeriodMonths: 7
    // TODO: assert error message: "Prøvetid kan ikke overstige 6 måneder"
    // TODO: assert "Lagre" button disabled
  });

  test.skip("error path: sluttdato < startdato blocked", async ({ page }) => {
    // TODO: setup workspace + admin
    // TODO: navigate to basis-definition form
    // TODO: set startDate: 2026-05-01, endDate: 2026-04-30
    // TODO: blur endDate field
    // TODO: assert error message: "Sluttdato må være etter startdato"
    // TODO: assert "Lagre" button disabled
  });

  test.skip("error path: PII RevealableField masked-by-default", async ({ page }) => {
    // TODO: setup workspace + admin
    // TODO: navigate to view existing employment_contract
    // TODO: locate personnummer field (should be masked: "***-***-***")
    // TODO: click mask toggle icon
    // TODO: assert personnummer revealed
    // TODO: assert audit emit fires with event: "pii_revealed"
    // TODO: click mask toggle again
    // TODO: assert personnummer masked again
  });
});
