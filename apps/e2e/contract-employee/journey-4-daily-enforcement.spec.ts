import { test, expect } from "@playwright/test";

/**
 * Journey 4 — Daily Enforcement: Obligations and Salary Query
 * Source: docs/architecture/contract-service/JOURNEY-contract-module.md (Journey 4)
 *
 * Status: SCAFFOLDED — live execution deferred to follow-up wave.
 * Tests defined here capture happy path + critical error paths.
 * Mark `test` (not `test.skip`) when infra (auth helpers, seed, data-testids) ready.
 */

test.describe("Journey 4: Daily Enforcement — Obligations and Salary Query", () => {
  test.skip("happy path: clock-in with completed obligations → allowed", async ({ page }) => {
    // TODO: setup workspace + employee + active employment_contract with no overdue obligations
    // TODO: login as employee
    // TODO: navigate to /dashboard/clock-in
    // TODO: assert no ObligationBlocker component
    // TODO: click "Sjekk inn"
    // TODO: assert clock-in succeeds
    // TODO: assert session created
  });

  test.skip("error path: clock-in with overdue blocker → ObligationBlocker rendered", async ({
    page,
  }) => {
    // TODO: setup workspace + employee + active employment_contract
    // TODO: create overdue obligation (e.g., contract-update-acknowledge, due: yesterday)
    // TODO: login as employee
    // TODO: navigate to /dashboard/clock-in
    // TODO: assert ObligationBlocker visible: "Du må gjennomføre X før du kan sjekke inn"
    // TODO: list blocker obligations with action CTAs
    // TODO: assert "Sjekk inn" button disabled
    // TODO: click obligation CTA
    // TODO: complete obligation
    // TODO: return to clock-in
    // TODO: assert ObligationBlocker gone
    // TODO: assert "Sjekk inn" button enabled
  });

  test.skip("error path: salary_query returns breakdown + Riksavtalen citation", async ({
    page,
  }) => {
    // TODO: setup workspace + employee + active employment_contract with hourlyRate, weeklyHours, tariffKey
    // TODO: login as employee
    // TODO: navigate to /dashboard/salary
    // TODO: click "Se detaljer" or "Beregning"
    // TODO: assert breakdown rendered:
    //   - Base hours × hourlyRate
    //   - Tipsregler applied
    //   - Tariff adjustments (if any)
    //   - Riksavtalen citation: "Etter Riksavtalen §X.X, minstelønn er..."
    // TODO: assert monthly estimate calculation shown
    // TODO: assert "Still spørsmål" CTA links to helpdesk
  });
});
