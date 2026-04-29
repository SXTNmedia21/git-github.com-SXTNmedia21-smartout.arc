import { test, expect } from "@playwright/test";

/**
 * Journey 2 — Send Contract via 2-Step Drawer
 * Source: docs/architecture/contract-service/JOURNEY-contract-module.md (Journey 2)
 *
 * Status: SCAFFOLDED — live execution deferred to follow-up wave.
 * Tests defined here capture happy path + critical error paths.
 * Mark `test` (not `test.skip`) when infra (auth helpers, seed, data-testids) ready.
 */

test.describe("Journey 2: Send Contract via 2-Step Drawer", () => {
  test.skip("happy path: 2-step drawer mal → preview → AcknowledgementRing 4/4 → Send", async ({
    page,
  }) => {
    // TODO: setup workspace + admin + employment_contract in draft status
    // TODO: navigate to /contracts/:id
    // TODO: click "Send kontrakt"
    // TODO: assert drawer opens with Step 1: "Velg mal og anpassninger"
    // TODO: select mal, fill recipient name/email
    // TODO: click "Neste"
    // TODO: assert Step 2: "Gjennomga og bekreft"
    // TODO: verify PDF preview renders
    // TODO: click "Vis PDF"
    // TODO: assert PDF view opens
    // TODO: close PDF view
    // TODO: verify all 4 AcknowledgementRing items checked: ✓ Mottaker, ✓ Mal, ✓ PDF sett, ✓ Dokumentasjon
    // TODO: assert "Send" button enabled
    // TODO: click "Send"
    // TODO: assert toast: "Kontrakt sendt"
    // TODO: assert status changes to "sent_pending_signature"
    // TODO: assert contract.sent_at is set
  });

  test.skip("error path: AcknowledgementRing < 4 → Send disabled", async ({ page }) => {
    // TODO: setup workspace + admin + employment_contract in draft
    // TODO: navigate to /contracts/:id
    // TODO: click "Send kontrakt"
    // TODO: proceed to Step 2
    // TODO: verify AcknowledgementRing shows 3/4 checked
    // TODO: assert "Send" button disabled
    // TODO: assert helper text: "Gjennomga alt før du sender"
  });

  test.skip("error path: PDF preview not viewed → blocks", async ({ page }) => {
    // TODO: setup workspace + admin + employment_contract
    // TODO: navigate to /contracts/:id
    // TODO: click "Send kontrakt"
    // TODO: proceed to Step 2
    // TODO: verify AcknowledgementRing shows 3/4 (✓ Mottaker, ✓ Mal, ✗ PDF sett, ✓ Dokumentasjon)
    // TODO: do NOT click "Vis PDF"
    // TODO: assert "Send" button disabled
    // TODO: assert AcknowledgementRing PDF item shows unchecked
  });

  test.skip("error path: compliance blocker (timelønn < min) → Send disabled", async ({ page }) => {
    // TODO: setup workspace + admin + employment_contract with hourlyRate < tariff.minimum_hourly_rate
    // TODO: navigate to /contracts/:id
    // TODO: click "Send kontrakt"
    // TODO: proceed to Step 2
    // TODO: assert compliance banner: "Avtalen bryter minstelønnssatsen for denne stillingen"
    // TODO: assert "Send" button disabled
    // TODO: click "Se detaljer"
    // TODO: assert modal shows tariff rule violation with citation (Riksavtalen §X)
  });
});
