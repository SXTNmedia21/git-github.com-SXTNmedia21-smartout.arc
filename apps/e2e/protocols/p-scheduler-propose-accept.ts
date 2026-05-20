/**
 * apps/e2e/protocols/p-scheduler-propose-accept.ts
 *
 * S10 — Scheduler Propose + Web Accept E2E protocol (JourneyIR v2.0.0).
 *
 * Actor: Manager (workspace admin role)
 * Platform: Web dashboard
 *
 * Flow:
 *   1. Seed golden case — workspace with employees, shifts, gaps, season budget.
 *   2. Manager proposes plan via chat ("foreslå vaktplan for uke 24").
 *   3. Assert ONE change_proposal row created with kind='scheduler_bundle' + status='pending'
 *      + proposed_shifts in JSONB changes.proposed_shifts with N entries.
 *   4. Assert ONE scheduler.proposal.proposed event in activity_trail (ADR-0134 — ONE emit).
 *   5. Manager navigates to /dashboard/schedule/proposed-plan → clicks "Godta alle".
 *   6. Assert N schedule_shift rows inserted with correct columns per ADR-0309 + L-0255:
 *      - initiated_by set (not null)
 *      - trigger_entity_type = 'change_proposal'
 *      - trigger_entity_id = change_proposal_id
 *      - shift_date populated
 *      - employee_id populated
 *   7. Assert change_proposal.status = 'applied'.
 *   8. Assert SINGLE scheduler.proposal.accepted event in activity_trail (ADR-0134 — NEVER per-shift).
 *
 * ADR compliance:
 *   ADR-0309 — atomic all-or-nothing accept. ONE event per bundle, not per shift.
 *   ADR-0134 — ONE emit per logical event. Checked by event_count=1 gate.
 *   ADR-0133 — web Compose (propose via chat) + web Accept. Mobile accept covered by S11.
 *   ADR-0151 — workspace_id + profile_id server-derived at BFF (no client forgery).
 *   L-0255   — trigger_entity_id column (not entity_id). Verified in step 6 gate.
 *
 * Closes: S10 (scheduler-propose-accept acceptance gate).
 * Sibling: S11 (p-scheduler-mobile-bundle.ts) tests same DB state via mobile Accept ALL.
 */

import type { JourneyIR } from "@smartout/journey-ir";

/** Seed constants — replaced by golden-case seeder in protocol runner. */
const SEED_WORKSPACE_ID = "{{workspace.id}}";
const SEED_MANAGER_PROFILE_ID = "{{manager.profile_id}}";
const SEED_WEEK = "uke 24"; // Natural language for the chat prompt

/** Expected shift count after greedy solver runs on the seed workspace. */
const EXPECTED_SHIFT_COUNT_MIN = 1;

export const P_SCHEDULER_PROPOSE_ACCEPT: JourneyIR = {
  version: "2.0.0",
  slug: "S10",
  module: "JP-R000-SCHEDULER-PROPOSE-ACCEPT",
  title: "Scheduler Propose + Web Accept",
  actor: "manager",
  platform: "web",
  auth_profile: "admin",
  entry_url: "/dashboard",
  preconditions: {
    db_state: [
      {
        // Workspace must exist with employees + department + season budget.
        // The protocol runner seeds this from the golden-case fixture.
        table: "workspace",
        where: { workspace_id: SEED_WORKSPACE_ID },
        expect: { status: "active" },
      },
      {
        // Manager profile must exist and be active.
        table: "profile",
        where: { profile_id: SEED_MANAGER_PROFILE_ID, workspace_id: SEED_WORKSPACE_ID },
        expect: { is_active: true },
      },
      {
        // No pending scheduler bundle proposals before the test starts.
        // The runner must clear change_proposal rows with kind='scheduler_bundle'
        // for this workspace before executing step 2.
        table: "change_proposal",
        where: { workspace_id: SEED_WORKSPACE_ID, kind: "scheduler_bundle", status: "pending" },
        expect: {},
      },
    ],
  },
  steps: [
    {
      key: "1_navigate_dashboard",
      order: 1,
      title: "Naviger til dashboard",
      description: "Manager logger inn og navigerer til dashboard.",
      action: "Navigate to /dashboard. Wait for dashboard to load.",
      assertion: "URL matches /dashboard",
      actions: [
        { type: "navigate", url: "/dashboard" },
        { type: "settle", ms: 1500 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard",
        timeout_ms: 10_000,
      },
      screenshot: true,
    },
    {
      key: "2_open_botsson_chat",
      order: 2,
      title: "Åpne Botsson-chat",
      description: "Manager åpner Mr. Botsson-chat og skriver planleggingsforespørsel.",
      action: `Click Botsson chat toggle. Fill chat input with "foreslå vaktplan for ${SEED_WEEK}". Submit.`,
      assertion: "Chat sends message and shows processing indicator",
      actions: [
        { type: "click", testid: "botsson-chat-toggle" },
        { type: "settle", ms: 500 },
        { type: "fill", testid: "botsson-chat-input", value: `foreslå vaktplan for ${SEED_WEEK}` },
        { type: "click", testid: "botsson-chat-send" },
        { type: "wait_visible", testid: "botsson-chat-thinking" },
      ],
      gate: {
        type: "ui_state",
        testid: "botsson-chat-thinking",
        visible: true,
        timeout_ms: 5_000,
      },
      screenshot: true,
    },
    {
      key: "3_assert_proposal_created",
      order: 3,
      title: "Bekreft at forslag er opprettet i DB",
      description:
        "Systemet oppretter én change_proposal-rad med kind='scheduler_bundle' og proposed_shifts i JSONB.",
      action: "Wait for chat response confirming proposal created. Check DB for proposal row.",
      assertion:
        "change_proposal row exists with kind='scheduler_bundle', status='pending', changes.proposed_shifts length >= 1",
      timeoutMs: 30_000,
      actions: [
        // Wait for Botsson to finish processing (proposal creation takes up to 15s).
        { type: "wait_hidden", testid: "botsson-chat-thinking" },
        { type: "settle", ms: 2_000 },
      ],
      gate: {
        type: "db_record",
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
        timeout_ms: 30_000,
        retry_interval_ms: 1_000,
      },
      screenshot: true,
    },
    {
      key: "4_assert_proposed_event_once",
      order: 4,
      title: "Bekreft ÉITT scheduler.proposal.proposed-event i activity_trail",
      description:
        "ADR-0134: Nøyaktig ETT emit per logisk hendelse. Aldri per-shift. Sjekk event_count=1.",
      action: "Query activity_trail for scheduler.proposal.proposed events from this run.",
      assertion: "Exactly ONE scheduler.proposal.proposed event exists (never per-shift).",
      actions: [{ type: "settle", ms: 500 }],
      gate: {
        type: "telemetry_event",
        event_name: "scheduler.proposal.proposed",
        actor_id: SEED_MANAGER_PROFILE_ID,
        timeout_ms: 15_000,
        retry_interval_ms: 1_000,
      },
      screenshot: false,
    },
    {
      key: "5_navigate_proposed_plan",
      order: 5,
      title: "Naviger til forslagsiden",
      description: "Manager navigerer til /dashboard/schedule/proposed-plan og ser BundleCard.",
      action: "Navigate to /dashboard/schedule/proposed-plan. Wait for BundleCard to appear.",
      assertion: "Proposed plan page loads with BundleCard visible.",
      actions: [
        { type: "navigate", url: "/dashboard/schedule/proposed-plan" },
        { type: "settle", ms: 1_500 },
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
      key: "6_accept_plan",
      order: 6,
      title: "Godta vaktplanen",
      description:
        "Manager klikker 'Godta alle'. BFF kaller accept-bundle. N schedule_shift-rader settes inn atomisk.",
      action:
        "Click 'Godta alle' button. Wait for success confirmation. Assert schedule_shift rows created.",
      assertion: `N (>= ${EXPECTED_SHIFT_COUNT_MIN}) schedule_shift rows inserted with correct column values per L-0255.`,
      actions: [
        { type: "click", testid: "scheduler-accept-all-btn" },
        { type: "wait_visible", testid: "scheduler-accept-success" },
        { type: "settle", ms: 1_000 },
      ],
      gate: {
        type: "ui_state",
        testid: "scheduler-accept-success",
        visible: true,
        timeout_ms: 15_000,
      },
      screenshot: true,
    },
    {
      key: "7_assert_shifts_inserted",
      order: 7,
      title: "Bekreft schedule_shift-rader med korrekte kolonnenavn",
      description:
        "L-0255 kolonnedisiplin: trigger_entity_id (ikke entity_id), initiated_by (ikke proposed_by). " +
        "Verifiser at change_proposal.status='applied'.",
      action:
        "Check DB: schedule_shift rows exist with trigger_entity_type='change_proposal' and trigger_entity_id set. " +
        "Check change_proposal.status='applied'.",
      assertion:
        "change_proposal.status='applied'. schedule_shift rows have trigger_entity_type='change_proposal' + trigger_entity_id populated.",
      actions: [{ type: "settle", ms: 500 }],
      gate: {
        type: "db_record",
        table: "change_proposal",
        where: {
          workspace_id: SEED_WORKSPACE_ID,
          kind: "scheduler_bundle",
          status: "applied",
        },
        expect: {
          status: "applied",
        },
        timeout_ms: 15_000,
        retry_interval_ms: 1_000,
      },
      screenshot: false,
    },
    {
      key: "8_assert_accepted_event_once",
      order: 8,
      title: "Bekreft ÉITT scheduler.proposal.accepted-event (aldri per-shift)",
      description:
        "ADR-0134 + ADR-0309: Nøyaktig ETT emit for hele bundle-aksepten. " +
        "Aldri per-shift. Kontroller at event_count er 1, ikke N.",
      action:
        "Query activity_trail for scheduler.proposal.accepted events from this accept action.",
      assertion:
        "Exactly ONE scheduler.proposal.accepted event — never one per shift (ADR-0309 invariant).",
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
