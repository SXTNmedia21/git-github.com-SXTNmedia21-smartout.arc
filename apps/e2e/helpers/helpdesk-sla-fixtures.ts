/**
 * helpdesk-sla-fixtures.ts — E2E test fixtures for Helpdesk Phase 2 SLA.
 *
 * Provides three composable seed helpers + one Edge Function invoker for
 * the J1/J2/J3 SLA breach journeys (ADR-0231 + ADR-0232).
 *
 * All helpers use the service-role Supabase client (helpers/seed.ts). They
 * do NOT go through dispatcher / capability tools — fixtures fabricate the
 * exact DB state each test needs and rely on the application code under test
 * to react. This is intentional: testing the consumer side of SLA in
 * isolation requires deterministic state, not a full ticket-open flow.
 *
 * Cleanup: each test should pass a workspace_id (random UUID) into the
 * setup helpers in beforeEach + use cleanWorkspace(workspace_id) in
 * afterEach. The cleanup helper cascades through every table the fixtures
 * touched.
 */

import { randomUUID } from "node:crypto";
import { supabase } from "./seed";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HelpdeskSlaFixture = {
  workspace_id: string;
  desk_channel_id: string;
  rep_profile_id: string;
  observer_profile_id: string;
  authority_id: string;
};

export type SeedBreachedTicketArgs = {
  workspace_id: string;
  desk_channel_id: string;
  rep_profile_id: string;
  /** ISO timestamp for context.sla_breached_at. Defaults to NOW. */
  breached_at?: string;
};

export type SeededTicket = {
  state_id: string;
  conversation_channel_id: string;
};

// ---------------------------------------------------------------------------
// seedHelpdeskWithObserver — workspace + desk + rep + manager observer + authority
// ---------------------------------------------------------------------------

/**
 * Create a fresh workspace with a desk channel, a rep (responsible_profile_id),
 * a manager (broadcast-fallback observer), and an engine_authority_config row
 * for `helpdesk_query` with observer_escalation_hours=72.
 *
 * The rep + manager are profile-only (no user_identity / login). UI tests
 * that need to LOG IN as the rep / manager should use loginAsPlatformAdmin
 * (admin can act as observer with godmode for visibility) — see auth gap
 * note in spec headers.
 */
export async function seedHelpdeskWithObserver(workspace_id: string): Promise<HelpdeskSlaFixture> {
  // Workspace
  const { error: wsErr } = await supabase.from("workspace").insert({
    workspace_id,
    name: `e2e-sla-${workspace_id.slice(0, 8)}`,
    slug: `e2e-sla-${workspace_id.slice(0, 8)}`,
    country: "NO",
    currency: "NOK",
    language: "no",
    timezone: "Europe/Oslo",
    is_active: true,
  });
  if (wsErr) throw new Error(`workspace insert: ${wsErr.message}`);

  // Rep (responsible_profile_id — the desk owner)
  const rep_profile_id = randomUUID();
  const { error: repErr } = await supabase.from("profile").insert({
    profile_id: rep_profile_id,
    workspace_id,
    display_name: "Rep Repsen",
    profile_code: `rep-${rep_profile_id.slice(0, 6)}`,
    user_id: null,
    role: "employee",
    status: "active",
    is_active: true,
  });
  if (repErr) throw new Error(`rep insert: ${repErr.message}`);

  // Observer (manager — broadcast fallback per ADR-0229)
  const observer_profile_id = randomUUID();
  const { error: obsErr } = await supabase.from("profile").insert({
    profile_id: observer_profile_id,
    workspace_id,
    display_name: "Mona Manager",
    profile_code: `mgr-${observer_profile_id.slice(0, 6)}`,
    user_id: null,
    role: "manager",
    status: "active",
    is_active: true,
  });
  if (obsErr) throw new Error(`observer insert: ${obsErr.message}`);

  // Desk channel — channel_type='desk' + helpdesk_enabled=true + responsible_profile_id
  const desk_channel_id = randomUUID();
  const { error: chErr } = await supabase.from("channel").insert({
    id: desk_channel_id,
    workspace_id,
    name: "HR-skranken",
    channel_type: "desk",
    helpdesk_enabled: true,
    responsible_profile_id: rep_profile_id,
    privacy_mode: "private",
  });
  if (chErr) throw new Error(`channel insert: ${chErr.message}`);

  // Authority — helpdesk_query, observer_escalation_hours=72, min_role=manager
  const authority_id = randomUUID();
  const { error: authErr } = await supabase.from("engine_authority_config").insert({
    id: authority_id,
    workspace_id,
    capability: "helpdesk_query",
    level: "confirm",
    min_role: "manager",
    observer_escalation_hours: 72,
  });
  if (authErr) throw new Error(`authority insert: ${authErr.message}`);

  return {
    workspace_id,
    desk_channel_id,
    rep_profile_id,
    observer_profile_id,
    authority_id,
  };
}

// ---------------------------------------------------------------------------
// seedTicket — fabricate an open ticket on helpdesk_query_lifecycle
// ---------------------------------------------------------------------------

/**
 * Create an engine_state row with process_id='helpdesk_query_lifecycle',
 * status='waiting', current_step=2 (the resolve-wait step), and a sibling
 * conversation channel that the ticket is attached to via entity_id.
 *
 * Used by J2/J3 tests that need a ticket in the queue.
 */
export async function seedTicket(args: {
  workspace_id: string;
  desk_channel_id: string;
  rep_profile_id: string;
}): Promise<SeededTicket> {
  // Conversation sub-channel (private mode pattern from Phase 1)
  const conversation_channel_id = randomUUID();
  const { error: convErr } = await supabase.from("channel").insert({
    id: conversation_channel_id,
    workspace_id: args.workspace_id,
    name: "Henvendelse fra ansatt",
    channel_type: "query_thread",
    privacy_mode: "private",
  });
  if (convErr) throw new Error(`conversation channel insert: ${convErr.message}`);

  // engine_state — assignee=rep, current_step=2 (waiting on resolved per Phase 1
  // dispatcher fix), context carries desk_channel_id rollup
  const state_id = randomUUID();
  const nowIso = new Date().toISOString();
  const { error: stateErr } = await supabase.from("engine_state").insert({
    id: state_id,
    workspace_id: args.workspace_id,
    process_id: "helpdesk_query_lifecycle",
    status: "waiting",
    current_step: 2,
    entity_type: "channel",
    entity_id: conversation_channel_id,
    assignee_id: args.rep_profile_id,
    context: {
      desk_channel_id: args.desk_channel_id,
      summary: "E2E SLA fixture",
      requester_profile_id: null,
      originating_channel: "system",
    },
    started_at: nowIso,
    result: {},
  });
  if (stateErr) throw new Error(`engine_state insert: ${stateErr.message}`);

  return { state_id, conversation_channel_id };
}

// ---------------------------------------------------------------------------
// seedBreachedTicket — ticket + sla_breached_at populated in context
// ---------------------------------------------------------------------------

/**
 * Convenience wrapper — seedTicket + flip context.sla_breached_at.
 *
 * Used by J2/J3 to test the badge surface without driving the full
 * fire-delayed-triggers → engine-dispatch → breach_handler flow.
 */
export async function seedBreachedTicket(args: SeedBreachedTicketArgs): Promise<SeededTicket> {
  const ticket = await seedTicket({
    workspace_id: args.workspace_id,
    desk_channel_id: args.desk_channel_id,
    rep_profile_id: args.rep_profile_id,
  });

  const breached_at = args.breached_at ?? new Date().toISOString();
  const { error: patchErr } = await supabase
    .from("engine_state")
    .update({
      context: {
        desk_channel_id: args.desk_channel_id,
        summary: "E2E SLA fixture",
        requester_profile_id: null,
        originating_channel: "system",
        sla_breached_at: breached_at,
      },
    })
    .eq("id", ticket.state_id);
  if (patchErr) throw new Error(`sla_breached_at patch: ${patchErr.message}`);

  return ticket;
}

// ---------------------------------------------------------------------------
// seedDelayedTrigger — pre-canned breach event + delayed_trigger row
// ---------------------------------------------------------------------------

/**
 * Mirror what tools.ts openTicket does at ticket-open time: insert a pre-
 * canned engine_event with target_state_id + assignee_id, then an
 * engine_delayed_trigger keyed to that event with fire_at = past (so the
 * next fire-delayed-triggers invocation picks it up).
 *
 * J1 uses this to set up the SLA breach without a full ticket-open round-trip.
 */
export async function seedDelayedTrigger(args: {
  workspace_id: string;
  origin_state_id: string;
  desk_channel_id: string;
  rep_profile_id: string;
  observer_profile_id: string;
  /** ISO past timestamp. Defaults to 1 minute ago. */
  fire_at?: string;
}): Promise<{ event_id: string; trigger_id: string; delayed_trigger_id: string }> {
  // Look up the seeded engine_trigger for sla_breached
  const { data: trigger, error: trgErr } = await supabase
    .from("engine_trigger")
    .select("id")
    .eq("event_type", "helpdesk.query.sla_breached")
    .is("workspace_id", null)
    .maybeSingle();
  if (trgErr) throw new Error(`trigger lookup: ${trgErr.message}`);
  if (!trigger)
    throw new Error("seedDelayedTrigger: helpdesk.query.sla_breached trigger not seeded");

  // Pre-canned breach event with payload contract per T8b migration header
  const event_id = randomUUID();
  const { error: evErr } = await supabase.from("engine_event").insert({
    id: event_id,
    event_type: "helpdesk.query.sla_breached",
    workspace_id: args.workspace_id,
    payload: {
      target_state_id: args.origin_state_id, // ADR-0232 — handler reads this
      assignee_id: args.observer_profile_id, // dispatcher copies → spawned state.assignee_id
      desk_channel_id: args.desk_channel_id,
      responsible_profile_id: args.rep_profile_id,
      origin_ticket_id: args.origin_state_id,
    },
  });
  if (evErr) throw new Error(`engine_event insert: ${evErr.message}`);

  // engine_delayed_trigger — fire_at past so next poll picks it up
  const fire_at = args.fire_at ?? new Date(Date.now() - 60_000).toISOString();
  const delayed_trigger_id = randomUUID();
  const { error: dtErr } = await supabase.from("engine_delayed_trigger").insert({
    id: delayed_trigger_id,
    trigger_id: trigger.id,
    event_id,
    workspace_id: args.workspace_id,
    fire_at,
    fired: false,
    cancelled_at: null,
  });
  if (dtErr) throw new Error(`engine_delayed_trigger insert: ${dtErr.message}`);

  return { event_id, trigger_id: trigger.id, delayed_trigger_id };
}

// ---------------------------------------------------------------------------
// invokeFireDelayedTriggers — fetch wrapper for the Edge Function
// ---------------------------------------------------------------------------

/**
 * POST to the fire-delayed-triggers Edge Function with the WATCHDOG_CRON_SECRET
 * bearer. Returns the parsed JSON response. Throws on non-2xx.
 */
export async function invokeFireDelayedTriggers(): Promise<{
  fired: number;
  errors: number;
}> {
  const supabaseUrl = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
  const cronSecret = process.env.WATCHDOG_CRON_SECRET ?? "";
  if (!cronSecret) {
    throw new Error(
      "WATCHDOG_CRON_SECRET required to invoke fire-delayed-triggers (set in apps/e2e/.env.local)",
    );
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/fire-delayed-triggers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`fire-delayed-triggers ${res.status}: ${txt}`);
  }
  return (await res.json()) as { fired: number; errors: number };
}

// ---------------------------------------------------------------------------
// cleanWorkspace — cascade-delete everything seeded for a workspace
// ---------------------------------------------------------------------------

/**
 * Best-effort cleanup. Order matters: child tables first, then parent.
 * Errors are swallowed (cleanup is best-effort — if a table doesn't exist
 * or rows already cascaded, that's OK).
 */
export async function cleanWorkspace(workspace_id: string): Promise<void> {
  const tables = [
    "notification_outbox",
    "activity_trail",
    "engine_event",
    "engine_delayed_trigger",
    "engine_state_step",
    "engine_state",
    "engine_authority_config",
    "channel",
    "profile",
    "workspace",
  ];
  for (const t of tables) {
    try {
      await supabase.from(t).delete().eq("workspace_id", workspace_id);
    } catch {
      // ignore — best effort
    }
  }
}
