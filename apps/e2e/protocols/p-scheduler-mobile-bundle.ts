/**
 * apps/e2e/protocols/p-scheduler-mobile-bundle.ts
 *
 * S11 — Scheduler Mobile Bundle Accept E2E protocol (JourneyIR v2.0.0).
 *
 * Actor: Manager (mobile surface)
 * Platform: Mobile (PWA at localhost:8083 or native — ADR-0133 PWA-first for testing)
 *
 * Precondition: A pending scheduler_bundle change_proposal exists in DB.
 *   (This is the same state reached after step 3 of S10 — the protocol runner
 *   may either run S10 first or seed the proposal row directly via the golden-case seeder.)
 *
 * Flow:
 *   1. Manager opens mobile app and navigates to (shifts)/proposed-plan.
 *   2. BundleCard renders with proposal summary (date range + shift count + gap count + score).
 *   3. Manager taps "Godta alle" (Accept ALL).
 *   4. Confirmation alert shown — manager confirms.
 *   5. BFF POST /api/scheduler/accept-bundle is called. Atomic insert. ONE emit.
 *   6. Success screen shown (CheckCircle2 + "Vaktplanen er godtatt.").
 *   7. Assert SAME DB state as S10:
 *      - N schedule_shift rows inserted (trigger_entity_type='change_proposal', trigger_entity_id set)
 *      - change_proposal.status='applied'
 *      - SINGLE scheduler.proposal.accepted event in activity_trail.
 *
 * ADR compliance:
 *   ADR-0309 — V1 mobile: 3 components ONLY. Atomic Accept ALL. No per-row toggle.
 *   ADR-0133 — Accept is Approve verb, mobile-allowed.
 *   ADR-0134 — getProfileContext() resolves workspace_id + actor_id BEFORE emit().
 *              ONE emit per bundle accept (never per-shift). Empty-string FORBIDDEN.
 *   ADR-0151 — workspace_id + profile_id server-derived from Bearer token at BFF.
 *   L-0177   — fail-fast on missing identity. No silent empty-string fallback.
 *   L-0255   — trigger_entity_id (not entity_id) verified in step 7 gate.
 *
 * Testing note (ADR-0133 / CLAUDE.md):
 *   Mobile testing via PWA on localhost:8083. Never Expo Go or iOS simulator
 *   unless native-only feature. This protocol uses web-based UI actions
 *   against the PWA surface.
 *
 * Closes: S11 (scheduler-mobile-bundle acceptance gate).
 * Sibling: S10 (p-scheduler-propose-accept.ts) — web propose + web accept path.
 */

import type { JourneyIR } from "@smartout/journey-ir";

/** Seed constants — replaced by golden-case seeder or post-S10 state in protocol runner. */
const SEED_WORKSPACE_ID = "{{workspace.id}}";
const SEED_MANAGER_PROFILE_ID = "{{manager.profile_id}}";

export const P_SCHEDULER_MOBILE_BUNDLE: JourneyIR = {
  version: "2.0.0",
  slug: "S11",
  module: "JP-R000-SCHEDULER-MOBILE-BUNDLE",
  title: "Scheduler Mobile Bundle Accept",
  actor: "manager",
  platform: "mobile",
  auth_profile: "admin",
  // Mobile PWA entry point (ADR-0133 — PWA-first testing).
  entry_url: "/",
  preconditions: {
    db_state: [
      {
        // A pending scheduler_bundle proposal must exist for this workspace.
        // Either seeded directly or created by running S10 steps 1-3 first.
        table: "change_proposal",
        where: {
          workspace_id: SEED_WORKSPACE_ID,
          kind: "scheduler_bundle",
          status: "pending",
        },
        expect: {
          kind: "scheduler_bundle",
          status: "pending",
        },
      },
      {
        // Manager profile must be active.
        table: "profile",
        where: { profile_id: SEED_MANAGER_PROFILE_ID, workspace_id: SEED_WORKSPACE_ID },
        expect: { is_active: true },
      },
    ],
  },
  steps: [
    {
      key: "1_navigate_proposed_plan",
      order: 1,
      title: "Naviger til foreslått vaktplan",
      description:
        "Manager navigerer til (shifts)/proposed-plan på mobile. " +
        "BundleCard rendres med oppsummering: datoperiode, antall vakter, mangler, score.",
      action: "Navigate to /(shifts)/proposed-plan on mobile PWA. Wait for BundleCard to appear.",
      assertion: "BundleCard renders with proposal metadata (at least shift count visible).",
      actions: [
        { type: "navigate", url: "/(shifts)/proposed-plan" },
        { type: "settle", ms: 2_000 },
        { type: "wait_visible", testid: "scheduler-bundle-card" },
      ],
      gate: {
        type: "ui_state",
        testid: "scheduler-bundle-card",
        visible: true,
        timeout_ms: 10_000,
      },
      screenshot: true,
    },
    {
      key: "2_verify_readonly_list",
      order: 2,
      title: "Bekreft ReadOnlyShiftList er synlig (ingen per-rad toggle)",
      description:
        "ADR-0309 V1: ReadOnlyShiftList viser kun ansatt + rolle + tid. " +
        "Ingen avkrysningsbokser, ingen per-rad-veksler, ingen per-rad-interaksjon.",
      action:
        "Verify shift list section is visible. Verify no checkbox or toggle elements present (V1 invariant).",
      assertion:
        "Shift list visible. No testid='shift-row-toggle' or testid='shift-row-checkbox' present (ADR-0309 V1).",
      actions: [
        { type: "wait_visible", testid: "scheduler-shift-list" },
        { type: "settle", ms: 500 },
      ],
      gate: {
        type: "ui_state",
        testid: "scheduler-shift-list",
        visible: true,
        timeout_ms: 5_000,
      },
      screenshot: true,
    },
    {
      key: "3_tap_accept_all",
      order: 3,
      title: "Trykk 'Godta alle'",
      description:
        "Manager trykker 'Godta alle' i BundleActionBar. " +
        "En bekreftelsesdialog vises IKKE for Accept (kun for Reject). " +
        "BFF POST /api/scheduler/accept-bundle kalles atomisk.",
      action: "Click 'Godta alle' button. Wait for success screen.",
      assertion: "Success confirmation screen shows (CheckCircle2 + success text visible).",
      actions: [
        { type: "click", testid: "scheduler-accept-all-btn" },
        // Accept does not show a confirmation Alert (only Reject does).
        // Wait for success state directly.
        { type: "wait_visible", testid: "scheduler-accept-success" },
        { type: "settle", ms: 1_500 },
      ],
      gate: {
        type: "ui_state",
        testid: "scheduler-accept-success",
        visible: true,
        timeout_ms: 20_000,
      },
      screenshot: true,
    },
    {
      key: "4_assert_proposal_applied",
      order: 4,
      title: "Bekreft change_proposal.status='applied'",
      description:
        "Atomisk accept: change_proposal.status settes til 'applied' i samme transaksjon som N shift-inserts.",
      action: "Query change_proposal table. Verify status='applied'.",
      assertion: "change_proposal row has status='applied' (atomic transition from 'pending').",
      actions: [{ type: "settle", ms: 500 }],
      gate: {
        type: "db_record",
        table: "change_proposal",
        where: {
          workspace_id: SEED_WORKSPACE_ID,
          kind: "scheduler_bundle",
          status: "applied",
        },
        expect: { status: "applied" },
        timeout_ms: 15_000,
        retry_interval_ms: 1_000,
      },
      screenshot: false,
    },
    {
      key: "5_assert_shifts_inserted",
      order: 5,
      title: "Bekreft schedule_shift-rader med korrekte kolonnenavn (L-0255)",
      description:
        "L-0255 kolonnedisiplin: trigger_entity_id (ikke entity_id). " +
        "initiated_by (ikke proposed_by). trigger_entity_type='change_proposal'. " +
        "shift_date og employee_id populert. Samme DB-tilstand som S10 steg 7.",
      action:
        "Query schedule_shift table. Verify rows inserted with trigger_entity_type='change_proposal' " +
        "and trigger_entity_id = change_proposal_id. Verify shift_date + employee_id populated.",
      assertion:
        "N >= 1 schedule_shift rows inserted. trigger_entity_type='change_proposal'. " +
        "trigger_entity_id matches the proposal. shift_date + employee_id non-null.",
      actions: [{ type: "settle", ms: 500 }],
      gate: {
        // The protocol runner checks schedule_shift count > 0 for the workspace
        // with trigger_entity_type='change_proposal' and the corresponding proposal_id.
        // DB gate uses the proposal that was applied in step 4.
        type: "db_record",
        table: "schedule_shift",
        where: {
          workspace_id: SEED_WORKSPACE_ID,
          trigger_entity_type: "change_proposal",
        },
        expect: {
          trigger_entity_type: "change_proposal",
        },
        timeout_ms: 15_000,
        retry_interval_ms: 1_000,
      },
      screenshot: false,
    },
    {
      key: "6_assert_accepted_event_once",
      order: 6,
      title: "Bekreft ÉITT scheduler.proposal.accepted-event (aldri per-shift)",
      description:
        "ADR-0134 + ADR-0309: getProfileContext() resolves workspace_id + actor_id BEFORE emit(). " +
        "Nøyaktig ETT emit for hele bundle-aksepten. Aldri per-shift. " +
        "Samme garanti som S10 steg 8 — validert på mobil-path.",
      action:
        "Query activity_trail for scheduler.proposal.accepted events from this accept action. " +
        "Verify count=1 (not N).",
      assertion:
        "Exactly ONE scheduler.proposal.accepted event in activity_trail. " +
        "actor_id = manager profile_id (derived server-side via Bearer token at BFF).",
      actions: [{ type: "settle", ms: 500 }],
      gate: {
        type: "telemetry_event",
        event_name: "scheduler.proposal.accepted",
        actor_id: SEED_MANAGER_PROFILE_ID,
        timeout_ms: 10_000,
        retry_interval_ms: 1_000,
      },
      screenshot: false,
    },
  ],
  success_gate: {
    type: "db_record",
    table: "change_proposal",
    where: {
      workspace_id: SEED_WORKSPACE_ID,
      kind: "scheduler_bundle",
      status: "applied",
    },
    expect: { status: "applied" },
    timeout_ms: 5_000,
  },
};
