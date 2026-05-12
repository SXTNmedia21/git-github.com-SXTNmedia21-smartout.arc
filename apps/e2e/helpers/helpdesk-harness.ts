// =============================================================================
// helpers/helpdesk-harness.ts
//
// Seed helpers and assertion utilities for helpdesk_query capability E2E tests.
// Builds the minimum workspace fixture needed to exercise all 4 tools:
//   open_ticket, list_my_queue, get_ticket, resolve_ticket.
//
// All DB writes use the service-role client from ./seed.ts (direct inserts,
// no capability tools — fixture fabricates deterministic DB state that the
// harness spec verifies the capability code reads and mutates correctly).
//
// Privacy model: uses "private_per_requester" mode (the non-public branch)
// so open_ticket spawns a query_thread sub-channel. This exercises the full
// private-mode path in tools.ts:115-148.
//
// Cleanup: callers MUST call cleanHelpdeskWorkspace(fixture.workspace_id) in
// afterAll/afterEach to avoid cross-test contamination. The helper cascades
// through every table this module touches.
// =============================================================================

import { randomUUID } from "node:crypto";
import { supabase } from "./seed";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HelpdeskHarnessFixture = {
  workspace_id: string;
  desk_channel_id: string;
  /** The rep that owns the desk (assignee on tickets) */
  rep_profile_id: string;
  /** The employee that submits tickets (requester) */
  requester_profile_id: string;
  authority_id: string;
};

export type SeededHarnessTicket = {
  state_id: string;
  conversation_channel_id: string;
};

// ---------------------------------------------------------------------------
// seedHelpdeskHarnessWorkspace
// ---------------------------------------------------------------------------

/**
 * Create a minimal workspace with:
 *   - A desk channel (helpdesk_enabled=true, privacy_mode=private_per_requester)
 *   - A rep profile (responsible_profile_id on the desk)
 *   - A requester profile (employee role)
 *   - engine_authority_config row for helpdesk_query with level='confirm'
 *
 * The requester profile has no user_identity link — the harness spec calls the
 * BFF as the seed admin and passes the fixture workspace_id explicitly.
 * gate_action will use SEED_PROFILE_ID as actor (the logged-in user); the
 * fixture workspace_id scopes the DB reads.
 *
 * NOTE: Because the seed admin (SEED_PROFILE_ID) lives in SEED_WORKSPACE_ID, the
 * BFF call must use SEED_WORKSPACE_ID. The fixture workspace is used for
 * direct DB assertions only (list_my_queue, get_ticket). This separation is
 * intentional — we do not want to write tickets into the seed HQ workspace
 * and pollute other test runs.
 */
export async function seedHelpdeskHarnessWorkspace(
  workspace_id: string,
): Promise<HelpdeskHarnessFixture> {
  // Workspace
  const { error: wsErr } = await supabase.from("workspace").insert({
    workspace_id,
    name: `e2e-helpdesk-harness-${workspace_id.slice(0, 8)}`,
    slug: `e2e-hd-${workspace_id.slice(0, 8)}`,
    country: "NO",
    currency: "NOK",
    language: "no",
    timezone: "Europe/Oslo",
    is_active: true,
    company_id: null,
  });
  if (wsErr) throw new Error(`helpdesk workspace insert: ${wsErr.message}`);

  // Rep profile
  const rep_profile_id = randomUUID();
  const { error: repErr } = await supabase.from("profile").insert({
    profile_id: rep_profile_id,
    workspace_id,
    display_name: "Rep Helpdesk",
    profile_code: `rep-hd-${rep_profile_id.slice(0, 6)}`,
    user_id: null,
    role: "manager",
    status: "active",
    is_active: true,
  });
  if (repErr) throw new Error(`rep profile insert: ${repErr.message}`);

  // Requester profile (employee)
  const requester_profile_id = randomUUID();
  const { error: reqErr } = await supabase.from("profile").insert({
    profile_id: requester_profile_id,
    workspace_id,
    display_name: "Ask Ansatt",
    profile_code: `emp-hd-${requester_profile_id.slice(0, 6)}`,
    user_id: null,
    role: "employee",
    status: "active",
    is_active: true,
  });
  if (reqErr) throw new Error(`requester profile insert: ${reqErr.message}`);

  // Desk channel
  const desk_channel_id = randomUUID();
  const { error: deskErr } = await supabase.from("channel").insert({
    id: desk_channel_id,
    workspace_id,
    name: "HR-skranken e2e",
    channel_type: "desk",
    helpdesk_enabled: true,
    responsible_profile_id: rep_profile_id,
    privacy_mode: "private_per_requester",
  });
  if (deskErr) throw new Error(`desk channel insert: ${deskErr.message}`);

  // Authority config — level='confirm' to permit all 4 tools
  const authority_id = randomUUID();
  const { error: authErr } = await supabase.from("engine_authority_config").insert({
    id: authority_id,
    workspace_id,
    capability: "helpdesk_query",
    level: "confirm",
    min_role: "employee",
    requires_four_eyes: false,
  });
  if (authErr) throw new Error(`authority config insert: ${authErr.message}`);

  return {
    workspace_id,
    desk_channel_id,
    rep_profile_id,
    requester_profile_id,
    authority_id,
  };
}

// ---------------------------------------------------------------------------
// seedHarnessTicket — fabricate a waiting ticket directly (bypass open_ticket)
// ---------------------------------------------------------------------------

/**
 * Insert an engine_state row representing an open helpdesk ticket.
 * Used for list_my_queue and get_ticket assertions that need a pre-existing
 * ticket without going through the full open_ticket tool flow.
 */
export async function seedHarnessTicket(args: {
  workspace_id: string;
  desk_channel_id: string;
  assignee_profile_id: string;
  requester_profile_id: string;
  summary?: string;
}): Promise<SeededHarnessTicket> {
  const conversation_channel_id = randomUUID();
  const { error: convErr } = await supabase.from("channel").insert({
    id: conversation_channel_id,
    workspace_id: args.workspace_id,
    name: `Henvendelse: ${(args.summary ?? "E2E-harness").slice(0, 60)}`,
    channel_type: "query_thread",
    privacy_mode: "private_per_requester",
  });
  if (convErr) throw new Error(`conversation channel insert: ${convErr.message}`);

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
    assignee_id: args.assignee_profile_id,
    context: {
      desk_channel_id: args.desk_channel_id,
      summary: args.summary ?? "E2E harness ticket",
      requester_profile_id: args.requester_profile_id,
      originating_channel: "system",
    },
    started_at: nowIso,
    result: {},
  });
  if (stateErr) throw new Error(`engine_state insert: ${stateErr.message}`);

  return { state_id, conversation_channel_id };
}

// ---------------------------------------------------------------------------
// cleanHelpdeskWorkspace — cascade-delete all fixture data
// ---------------------------------------------------------------------------

/**
 * Best-effort cleanup. Order: FK child tables first, then workspace.
 * Swallows errors — cleanup must not mask test failures.
 */
export async function cleanHelpdeskWorkspace(workspace_id: string): Promise<void> {
  const tables = [
    "activity_trail",
    "engine_event",
    "engine_delayed_trigger",
    "engine_state_step",
    "engine_state",
    "engine_authority_config",
    "channel_member",
    "channel",
    "profile",
    "workspace",
  ] as const;

  for (const table of tables) {
    try {
      // activity_trail uses workspace_id column
      if (table === "activity_trail") {
        await supabase.from(table).delete().eq("workspace_id", workspace_id);
      } else {
        // All other tables: workspace_id column
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from(table) as any).delete().eq("workspace_id", workspace_id);
      }
    } catch {
      // ignore — best effort
    }
  }
}
