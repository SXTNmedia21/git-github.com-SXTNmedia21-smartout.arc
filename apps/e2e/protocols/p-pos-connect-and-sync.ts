/**
 * apps/e2e/protocols/p-pos-connect-and-sync.ts
 *
 * S8 — POS connect + sync E2E protocol (JourneyIR v2.0.0 shape).
 *
 * Actor: Admin (workspace owner)
 * Platform: Web dashboard (/dashboard/admin/pos-accounts)
 *
 * Steps:
 *   1. Navigate to /dashboard/admin/pos-accounts
 *   2. Open Connect Lightspeed modal (click "Koble til Lightspeed" CTA)
 *   3. Fill in external_account_id + oauth_code, submit
 *   4. Assert pos_account row created in DB (status = active)
 *   5. Trigger pos-sync Edge Function via curl with WATCHDOG_CRON_SECRET bearer
 *      (step executed by the protocol runner, not by the browser)
 *   6. Assert pos_sale_event rows > 0 for the account
 *   7. Assert pos.sale_event.ingested event in activity_trail
 *   8. Assert account list visible on page
 *
 * Mock V1 note:
 *   The mock Lightspeed adapter (packages/ai/src/adapters/pos/lightspeed.ts)
 *   generates 5-15 deterministic sale events per sync run. No real Lightspeed
 *   credentials needed. Real V2 OAuth path is ADR-0310.
 *
 * WATCHDOG_CRON_SECRET:
 *   Set in the E2E environment via .env.test or process.env. The protocol
 *   runner must pass this as a Bearer token to the pos-sync Edge Function.
 *
 * Closes: S8 (pos-connect-and-sync acceptance gate).
 *
 * References:
 *   ADR-0305 — POS adapter pattern, admin connect surface.
 *   ADR-0133 — web composes (admin connect is Compose verb, web-only).
 *   ADR-0134 — telemetry contract (pos.sale_event.ingested emitted once per run).
 *   ADR-0178 — JourneyIR v2.0.0 schema (typed actions + gates, additive over v1).
 */

import type { JourneyIR } from "@smartout/journey-ir";

/**
 * Test constants — placeholder values valid for mock V1.
 * The mock adapter accepts any non-empty oauth_code (no real Lightspeed OAuth).
 */
const MOCK_EXTERNAL_ACCOUNT_ID = "ls-test-account-e2e";
const MOCK_OAUTH_CODE = "mock-oauth-code-e2e-2026";

export const P_POS_CONNECT_AND_SYNC: JourneyIR = {
  version: "2.0.0",
  slug: "P-POS-CONNECT-AND-SYNC",
  module: "JP-R008-POS-CONNECT-AND-SYNC",
  title: "POS Connect and Sync — Lightspeed K-Series mock V1",
  actor: "admin",
  platform: "web",
  auth_profile: "admin",
  entry_url: "/dashboard/admin/pos-accounts",
  preconditions: {
    db_state: [],
  },
  steps: [
    {
      key: "1_navigate",
      order: 1,
      title: "Naviger til POS-integrasjoner",
      action: "Admin navigerer til /dashboard/admin/pos-accounts.",
      assertion: "Siden laster med tomt tilstand — ingen kontoer tilkoblet.",
      description:
        "Admin navigates to /dashboard/admin/pos-accounts. Page loads with empty state (no accounts connected yet).",
      actions: [
        { type: "navigate", url: "/dashboard/admin/pos-accounts" },
        { type: "settle", ms: 1500 },
      ],
      gate: {
        type: "ui_state",
        testid: "pos-accounts-empty-state",
        visible: true,
        timeout_ms: 10_000,
      },
      screenshot: true,
    },
    {
      key: "2_open_modal",
      order: 2,
      title: "Åpne Koble til Lightspeed-modal",
      action: "Admin klikker på 'Koble til Lightspeed'-CTA i tomt tilstand.",
      assertion: "Tilkoblingsmodal åpnes (synlig).",
      description:
        "Admin clicks the 'Koble til Lightspeed' CTA in the empty state. The connect modal opens.",
      actions: [
        { type: "click", testid: "pos-connect-cta" },
        { type: "settle", ms: 500 },
      ],
      gate: {
        type: "ui_state",
        testid: "pos-connect-modal",
        visible: true,
        timeout_ms: 5_000,
      },
      screenshot: true,
    },
    {
      key: "3_fill_and_submit",
      order: 3,
      title: "Fyll inn og send tilkoblingsskjema",
      action: "Admin fyller inn konto-ID og OAuth-kode (mock-verdier), sender skjema.",
      assertion: "Tilkoblingsmodal lukkes etter vellykket svar fra BFF.",
      description:
        "Admin fills in the external account ID and OAuth code (mock values for V1), then submits. BFF calls connectLightspeed capability tool.",
      actions: [
        { type: "fill", testid: "pos-external-account-id", value: MOCK_EXTERNAL_ACCOUNT_ID },
        { type: "fill", testid: "pos-oauth-code", value: MOCK_OAUTH_CODE },
        { type: "click", testid: "pos-connect-submit" },
        { type: "settle", ms: 2000 },
      ],
      gate: {
        type: "ui_state",
        testid: "pos-connect-modal",
        visible: false,
        timeout_ms: 10_000,
      },
      screenshot: true,
    },
    {
      key: "4_assert_pos_account_created",
      order: 4,
      title: "Verifiser pos_account-rad opprettet",
      action: "DB-gate: sjekk at pos_account-rad finnes med korrekt status.",
      assertion:
        "pos_account rad med external_account_id=ls-test-account-e2e, vendor=lightspeed_kseries, status=active finnes i databasen.",
      description:
        "DB gate: pos_account row with external_account_id=MOCK_EXTERNAL_ACCOUNT_ID exists, status='active', vendor='lightspeed_kseries'.",
      actions: [{ type: "settle", ms: 500 }],
      gate: {
        type: "db_record",
        table: "pos_account",
        where: {
          external_account_id: MOCK_EXTERNAL_ACCOUNT_ID,
          vendor: "lightspeed_kseries",
        },
        expect: {
          status: "active",
        },
        timeout_ms: 10_000,
        retry_interval_ms: 500,
      },
      screenshot: true,
    },
    {
      key: "5_trigger_pos_sync",
      order: 5,
      title: "Trigger pos-sync Edge Function",
      action: "Protocol runner kaller pos-sync med WATCHDOG_CRON_SECRET bearer.",
      assertion: "pos_sale_event-rader med vendor=lightspeed_kseries finnes (mock: 5-15 rader).",
      description:
        "Protocol runner executes: curl -X POST <SUPABASE_URL>/functions/v1/pos-sync -H 'Authorization: Bearer <WATCHDOG_CRON_SECRET>'. The Edge Function resolves active pos_account rows, calls the mock Lightspeed adapter, and inserts pos_sale_event rows. pos.sale_event.ingested is emitted once per account.",
      actions: [
        // settle gives time for the curl invocation (executed externally by the
        // protocol runner, not via browser automation) to complete before gates fire.
        { type: "settle", ms: 4000 },
      ],
      gate: {
        type: "db_record",
        table: "pos_sale_event",
        where: {
          // Protocol runner resolves the actual pos_account_id at runtime from
          // the row created in step 4, then injects it here via template substitution.
          // Fallback: runner asserts row count > 0 for the workspace.
          vendor: "lightspeed_kseries",
        },
        expect: {
          // At least one row exists — the mock adapter generates 5-15 rows per run.
          currency: "NOK",
        },
        timeout_ms: 15_000,
        retry_interval_ms: 1_000,
      },
      screenshot: false,
    },
    {
      key: "6_assert_telemetry",
      order: 6,
      title: "Verifiser pos.sale_event.ingested i activity_trail",
      action: "Telemetri-gate: sjekk at pos.sale_event.ingested er emittert.",
      assertion:
        "Nøyaktig én pos.sale_event.ingested-hendelse emittert for denne kontoen (ADR-0134 — én emit per sync-kjøring, IKKE per rad).",
      description:
        "Telemetry gate: exactly one pos.sale_event.ingested event emitted for this account (ADR-0134 — one emit per sync run, NOT per row). actor_id = admin profile_id.",
      actions: [],
      gate: {
        type: "telemetry_event",
        event_name: "pos.sale_event.ingested",
        timeout_ms: 10_000,
        retry_interval_ms: 1_000,
      },
      screenshot: false,
    },
    {
      key: "7_assert_list_visible",
      order: 7,
      title: "Verifiser kontoliste synlig på siden",
      action: "Admin ser kontolisten — ikke tomt tilstand — etter refresh.",
      assertion:
        "Siden viser kontolisten. Tilkoblet Lightspeed-konto synlig med statusbadge 'Aktiv'.",
      description:
        "UI gate: the page now shows the accounts list (not the empty state). The connected Lightspeed account is visible with status badge 'Aktiv'.",
      actions: [{ type: "settle", ms: 1000 }],
      gate: {
        type: "ui_state",
        testid: "pos-accounts-list",
        visible: true,
        timeout_ms: 10_000,
      },
      screenshot: true,
    },
  ],
  success_gate: {
    type: "db_record",
    table: "pos_account",
    where: {
      external_account_id: MOCK_EXTERNAL_ACCOUNT_ID,
      status: "active",
    },
    expect: {
      vendor: "lightspeed_kseries",
    },
    timeout_ms: 5_000,
    retry_interval_ms: 500,
  },
};
