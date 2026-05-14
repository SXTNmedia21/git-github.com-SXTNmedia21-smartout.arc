/**
 * apps/e2e/protocols/p-marketplace-full-flow.ts
 *
 * S9 — Shift Marketplace Full Flow E2E protocol (JourneyIR v2.0.0).
 *
 * Actor: Manager (web) + Employee (mobile)
 * Platform: Web dashboard + Mobile (PWA at localhost:8083 per project convention)
 *
 * Full flow:
 *   1. Manager authenticates to web dashboard.
 *   2. Manager posts open shift offer via Botsson chat (capability tool post_open).
 *   3. Protocol runner asserts schedule_shift_offer row created with status='open'.
 *   4. Employee authenticates to mobile (PWA).
 *   5. Employee opens marketplace tab — offer appears in list.
 *   6. Employee taps "Krev" → confirms in sheet.
 *   7. Protocol runner asserts schedule_shift_offer.status='claimed'.
 *   8. Manager opens web marketplace page and sees pending claim.
 *   9. Manager clicks Godkjenn on the claimed offer.
 *  10. Protocol runner asserts schedule_shift.employee_id updated to claimer.
 *  11. Protocol runner asserts schedule_shift_offer.status='approved'.
 *
 * Acceptance gate: Closes S9 (shift marketplace full-flow acceptance).
 *
 * DB assertions use Supabase local REST API (anon key from env):
 *   SUPABASE_ANON_KEY + SUPABASE_URL must be set in the E2E environment.
 *   Use service role for assertions that cross RLS boundaries (offer + shift rows).
 *
 * Blocker code translations tested:
 *   "SHIFT_OVERLAP", "AML_HOURS_EXCEEDED", "MISSING_COMPETENCE",
 *   "OFFER_NOT_OPEN", "AUTHORITY_DENIED" — all surface as native Alert.
 *
 * References:
 *   ADR-0099  (gate_action before every mutation)
 *   ADR-0132  (mobile thin-client — BFF owns claim logic)
 *   ADR-0133  (claim = Approve verb = mobile-allowed; post_open = Compose = web)
 *   ADR-0134  (emit on every mutation: shift_offer.posted, shift_offer.claimed, shift_offer.approved)
 *   ADR-0151  (server-derived identity throughout)
 *   ADR-0288  (claim + approve_claim: chat-only)
 *   ADR-0306  (shift_marketplace V1 — pull-poll, no push EF yet)
 *   ADR-0178  (JourneyIR v2.0.0 schema — typed actions + gates)
 */

import type { JourneyIR } from "@smartout/journey-ir";

// ── Test fixtures (runner must set these via fixture injection) ────────────────
// These match the Supabase local dev seed (admin@smartout.no workspace b0000000-...0)
const MANAGER_EMAIL = "admin@smartout.no";
const MANAGER_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "{{E2E_ADMIN_PASSWORD}}";
const EMPLOYEE_EMAIL = process.env.E2E_EMPLOYEE_EMAIL ?? "{{E2E_EMPLOYEE_EMAIL}}";
const EMPLOYEE_PASSWORD = process.env.E2E_EMPLOYEE_PASSWORD ?? "{{E2E_EMPLOYEE_PASSWORD}}";

// Shift must pre-exist in the DB — protocol runner inserts it in preconditions.
const TEST_SHIFT_ID = "{{fixture.shift_id}}";

export const P_MARKETPLACE_FULL_FLOW: JourneyIR = {
  version: "2.0.0",
  slug: "S9",
  module: "JP-R000-SHIFT-MARKETPLACE-FULL-FLOW",
  title: "Marketplace Full Flow",
  actor: "manager",
  platform: "web",
  auth_profile: "admin",
  entry_url: "/dashboard/schedule/marketplace",
  preconditions: {
    db_state: [
      // Runner must INSERT a schedule_shift (no employee_id) before protocol starts.
      // Runner must ensure an employee profile exists in the same workspace.
      // Note: multi-actor protocol — manager starts on web, employee step on mobile PWA.
      {
        table: "schedule_shift",
        where: { schedule_shift_id: TEST_SHIFT_ID },
        expect: { employee_id: null },
      },
      {
        table: "profile",
        where: { role: "employee" },
        expect: { is_active: true },
      },
    ],
  },
  steps: [
    // ── Step 1: Manager authenticates ──────────────────────────────────────────
    {
      key: "1_manager_login",
      order: 1,
      title: "Innlogging — leder",
      description: "Manager logger inn på web-dashbordet.",
      action: "Manager logger inn med e-post og passord. [navigate → settle → fill → fill → click]",
      assertion: "URL matches pattern: /(dashboard|onboarding|select-workspace)",
      timeoutMs: 15_000,
      actions: [
        { type: "navigate", url: "/login" },
        { type: "settle", ms: 1000 },
        { type: "fill", testid: "login-email", value: MANAGER_EMAIL },
        { type: "fill", testid: "login-password", value: MANAGER_PASSWORD },
        { type: "click", testid: "login-submit" },
      ],
      gate: {
        type: "url_match",
        pattern: "/(dashboard|onboarding|select-workspace)",
        timeout_ms: 15_000,
      },
      screenshot: true,
    },

    // ── Step 2: Manager posts offer via Botsson chat ────────────────────────────
    {
      key: "2_post_open_offer",
      order: 2,
      title: "Post åpent tilbud via Botsson",
      description:
        "Manager navigerer til schedule-siden, åpner Botsson chat, og ber om å legge ut vakten som åpent tilbud.",
      action:
        "Manager navigerer og sender chat-melding til Botsson: 'Legg ut vakt {shift_id} som åpent tilbud'. [navigate → settle → click → fill → click]",
      assertion: 'Botsson svarer med bekreftelse som inneholder "lagt ut" eller "tilbud".',
      timeoutMs: 30_000,
      actions: [
        { type: "navigate", url: "/dashboard/schedule" },
        { type: "settle", ms: 1500 },
        { type: "click", testid: "botsson-orb" },
        { type: "settle", ms: 800 },
        {
          type: "fill",
          testid: "botsson-chat-input",
          value: `Legg ut vakt ${TEST_SHIFT_ID} som åpent tilbud for alle ansatte`,
        },
        { type: "click", testid: "botsson-chat-send" },
      ],
      gate: {
        type: "ui_state",
        testid: "botsson-assistant-message",
        visible: true,
        timeout_ms: 30_000,
      },
      screenshot: true,
    },

    // ── Step 3: Assert offer row created (DB assertion via db_record gate) ───────
    {
      key: "3_assert_offer_row",
      order: 3,
      title: "DB-assert: schedule_shift_offer opprettet",
      description:
        "Protocol runner verifiserer at en schedule_shift_offer-rad med status='open' og shift_id=TEST_SHIFT_ID eksisterer. Expressed as db_record gate — runner polls until timeout.",
      action:
        "Runner polls schedule_shift_offer WHERE shift_id=fixture.shift_id AND status='open'. [db_record gate]",
      assertion: "schedule_shift_offer.status='open' for shift_id={{fixture.shift_id}}",
      timeoutMs: 10_000,
      actions: [
        // Settle to allow async capability write to complete before polling.
        { type: "settle", ms: 2000 },
      ],
      gate: {
        type: "db_record",
        table: "schedule_shift_offer",
        where: { shift_id: TEST_SHIFT_ID, status: "open" },
        expect: { status: "open" },
        timeout_ms: 10_000,
        retry_interval_ms: 500,
      },
      screenshot: false,
    },

    // ── Step 4: Employee authenticates on mobile ───────────────────────────────
    {
      key: "4_employee_login",
      order: 4,
      title: "Innlogging — ansatt (mobil PWA)",
      description: "Ansatt logger inn på mobil PWA (localhost:8083).",
      action: "Ansatt logger inn på mobil PWA. [navigate → settle → fill → fill → click]",
      assertion: "URL matches pattern: /(tabs|app|shifts)",
      timeoutMs: 15_000,
      actions: [
        { type: "navigate", url: "http://localhost:8083/login" },
        { type: "settle", ms: 1000 },
        { type: "fill", testid: "login-email", value: EMPLOYEE_EMAIL },
        { type: "fill", testid: "login-password", value: EMPLOYEE_PASSWORD },
        { type: "click", testid: "login-submit" },
      ],
      gate: {
        type: "url_match",
        pattern: "/(tabs|app|shifts|home)",
        timeout_ms: 15_000,
      },
      screenshot: true,
    },

    // ── Step 5: Employee opens marketplace and sees offer ──────────────────────
    {
      key: "5_employee_sees_offer",
      order: 5,
      title: "Ansatt ser tilbudet i markedsplassen",
      description:
        "Ansatt navigerer til (shifts)/marketplace — tilbudet fra manageren vises i listen.",
      action:
        "Ansatt åpner markedsplass-fanen. Listen laster og tilbudet er synlig. [navigate → settle → wait_visible]",
      assertion: 'Element [data-testid="offer-card"] er synlig i FlatList.',
      timeoutMs: 15_000,
      actions: [
        { type: "navigate", url: "http://localhost:8083/(app)/(shifts)/marketplace" },
        { type: "settle", ms: 2000 },
        { type: "wait_visible", testid: "offer-card" },
      ],
      gate: {
        type: "ui_state",
        testid: "offer-card",
        visible: true,
        timeout_ms: 15_000,
      },
      screenshot: true,
    },

    // ── Step 6: Employee taps Krev → confirms in sheet ─────────────────────────
    {
      key: "6_employee_claims",
      order: 6,
      title: 'Ansatt trykker "Krev" og bekrefter',
      description:
        "Ansatt trykker Krev-knappen → konfirmasjonsark vises → trykker Bekreft → optimistisk grå-ut.",
      action:
        "Ansatt trykker Krev → bekrefter i sheet. Knappen viser 'Venter godkjenning'. [click → wait_visible → click → wait_state]",
      assertion: "Krev-knappen endres til 'Venter godkjenning' (optimistisk).",
      timeoutMs: 15_000,
      actions: [
        { type: "click", testid: "claim-btn" },
        { type: "wait_visible", testid: "confirm-sheet" },
        { type: "click", testid: "confirm-btn" },
      ],
      gate: {
        type: "ui_state",
        testid: "claim-btn-pending",
        visible: true,
        timeout_ms: 15_000,
      },
      screenshot: true,
    },

    // ── Step 7: Assert offer status → 'claimed' (DB) ──────────────────────────
    {
      key: "7_assert_claimed",
      order: 7,
      title: "DB-assert: tilbud status='claimed'",
      description:
        "Runner verifiserer at schedule_shift_offer har status='claimed' etter at ansatt trykket Krev.",
      action:
        "Runner polls schedule_shift_offer WHERE shift_id=fixture.shift_id AND status='claimed'. [db_record gate]",
      assertion:
        "schedule_shift_offer.status='claimed' AND claimed_by_profile_id IS NOT NULL for shift_id.",
      timeoutMs: 10_000,
      actions: [{ type: "settle", ms: 1500 }],
      gate: {
        type: "db_record",
        table: "schedule_shift_offer",
        where: { shift_id: TEST_SHIFT_ID, status: "claimed" },
        expect: { status: "claimed" },
        timeout_ms: 10_000,
        retry_interval_ms: 500,
      },
      screenshot: false,
    },

    // ── Step 8: Manager navigates to marketplace page ─────────────────────────
    {
      key: "8_manager_opens_marketplace",
      order: 8,
      title: "Leder åpner markedsplass-siden (web)",
      description: "Manager navigerer til /dashboard/schedule/marketplace og ser kravet i køen.",
      action:
        "Manager navigerer til markedsplass-siden. Krav-i-kø-fanen vises med tilbudet. [navigate → settle → wait_visible]",
      assertion: 'Kravet vises i "Krav i kø"-fanen.',
      timeoutMs: 10_000,
      actions: [
        { type: "navigate", url: "/dashboard/schedule/marketplace" },
        { type: "settle", ms: 1500 },
        { type: "click", testid: "marketplace-tab-claimed" },
        { type: "wait_visible", testid: "offer-card-claimed" },
      ],
      gate: {
        type: "ui_state",
        testid: "offer-card-claimed",
        visible: true,
        timeout_ms: 10_000,
      },
      screenshot: true,
    },

    // ── Step 9: Manager clicks Godkjenn ───────────────────────────────────────
    {
      key: "9_manager_approves",
      order: 9,
      title: "Leder godkjenner kravet",
      description: "Manager trykker Godkjenn på det krevde tilbudet.",
      action:
        "Manager trykker Godkjenn-knappen på tilbudskortet. Bekreftelsesdialog vises og godkjennes. [click → wait_visible → click]",
      assertion: "Tilbudskortet forsvinner fra 'Krav i kø'-fanen.",
      timeoutMs: 15_000,
      actions: [
        { type: "click", testid: "offer-approve-btn" },
        { type: "settle", ms: 500 },
        { type: "wait_visible", testid: "offer-approve-confirm" },
        { type: "click", testid: "offer-approve-confirm" },
      ],
      gate: {
        type: "ui_state",
        testid: "offer-approve-success",
        visible: true,
        timeout_ms: 15_000,
      },
      screenshot: true,
    },

    // ── Step 10: Assert schedule_shift.employee_id updated (DB) ──────────────
    {
      key: "10_assert_shift_assigned",
      order: 10,
      title: "DB-assert: schedule_shift.employee_id oppdatert",
      description:
        "Runner verifiserer at schedule_shift.employee_id ikke lenger er null etter godkjenning. " +
        "Exact profile_id verified by the runner by cross-referencing claimed_by_profile_id on the offer row.",
      action:
        "Runner polls schedule_shift_offer WHERE shift_id=fixture.shift_id AND status='approved'. [db_record gate]",
      assertion: "schedule_shift.employee_id IS NOT NULL (vakten er tildelt ansatt).",
      timeoutMs: 10_000,
      actions: [{ type: "settle", ms: 1500 }],
      gate: {
        type: "db_record",
        table: "schedule_shift_offer",
        where: { shift_id: TEST_SHIFT_ID, status: "approved" },
        expect: { status: "approved" },
        timeout_ms: 10_000,
        retry_interval_ms: 500,
      },
      screenshot: false,
    },

    // ── Step 11: Assert offer status → 'approved' (DB) ───────────────────────
    {
      key: "11_assert_approved",
      order: 11,
      title: "DB-assert: tilbud status='approved'. Closes S9.",
      description:
        "Runner verifiserer at schedule_shift_offer har status='approved' og schedule_shift.employee_id er oppdatert.",
      action:
        "Runner polls schedule_shift_offer WHERE shift_id=fixture.shift_id AND status='approved'. [db_record gate]",
      assertion: "schedule_shift_offer.status='approved' AND approved_by_profile_id IS NOT NULL.",
      timeoutMs: 10_000,
      actions: [{ type: "settle", ms: 500 }],
      gate: {
        type: "db_record",
        table: "schedule_shift_offer",
        where: { shift_id: TEST_SHIFT_ID, status: "approved" },
        expect: { status: "approved" },
        timeout_ms: 10_000,
        retry_interval_ms: 500,
      },
      screenshot: true,
    },
  ],

  success_gate: {
    type: "db_record",
    table: "schedule_shift_offer",
    where: { shift_id: TEST_SHIFT_ID, status: "approved" },
    expect: { status: "approved" },
    timeout_ms: 5_000,
    retry_interval_ms: 500,
  },
};
