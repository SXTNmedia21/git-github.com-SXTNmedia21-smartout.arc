// =============================================================================
// helpers/personal-harness.ts
//
// Seed helpers and assertion utilities for the personal capability E2E spec.
//
// Builds on botsson-harness.ts. Adds:
//   assertPersonalToolFired(sessionId, toolName, opts)
//     — polls agent_session_recording for a tool_call row naming the tool.
//
//   assertPersonalCapabilityClassified(sessionId, sinceIso, poll)
//     — polls agent_session_recording for a classifier_output row where
//       intent === 'personal'.
//
//   assertPersonalTrailEvent(toolName, sinceIso, opts)
//     — polls activity_trail for the personal.* event emitted by the tool.
//
//   cleanupPersonalRows(profileId, workspaceId, sinceIso)
//     — removes engine_memory + personal_task + engine_delayed_trigger rows
//       created by this test run (scoped by profile + workspace).
//       Swallows errors — cleanup must not mask test failures.
//
// Authority pre-check:
//   The personal capability seeds engine_authority_config at 'suggest' level
//   via migration 20260520100000_personal_task.sql for all existing workspaces.
//   The seed workspace (b0000000-...0) MUST have that row. ensurePersonalAuthority()
//   inserts it when absent (idempotent via ON CONFLICT DO NOTHING).
//
// ADR refs: ADR-0078 (channel guard), ADR-0099 (gate_action), ADR-0134
//           (telemetry), ADR-0151 (server-side profile_id), ADR-0184 (recorder).
// =============================================================================

import { expect } from "@playwright/test";
import {
  assertRecordingPhase,
  assertActivityTrailEvent,
  type RecordingRow,
  type ActivityTrailRow,
  SEED_WORKSPACE_ID,
  SEED_PROFILE_ID,
} from "./botsson-harness";
import { supabase } from "./seed";

export { SEED_WORKSPACE_ID, SEED_PROFILE_ID };

// ---------------------------------------------------------------------------
// PollOptions re-export
// ---------------------------------------------------------------------------
export type PollOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

// ---------------------------------------------------------------------------
// ensurePersonalAuthority
// ---------------------------------------------------------------------------

/**
 * Ensure engine_authority_config has a 'suggest' row for the personal
 * capability in the seed workspace. The migration seeds it for workspaces
 * with an owner profile — but CI clean DBs may miss it if the owner FK is
 * not yet satisfied. This helper inserts a fallback row directly.
 *
 * Idempotent: ON CONFLICT DO NOTHING.
 */
export async function ensurePersonalAuthority(
  workspaceId: string = SEED_WORKSPACE_ID,
): Promise<void> {
  const { error } = await supabase.from("engine_authority_config").upsert(
    {
      workspace_id: workspaceId,
      capability: "personal",
      level: "suggest",
      min_role: "employee",
      requires_four_eyes: false,
    },
    { onConflict: "workspace_id,capability", ignoreDuplicates: true },
  );

  if (error) {
    // Log but don't throw — tools are gated but a missing authority row
    // means gate returns deny with reason, not a server panic.
    console.warn(`ensurePersonalAuthority: upsert warning: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// cleanupPersonalRows
// ---------------------------------------------------------------------------

/**
 * Delete personal_task and engine_memory rows for the profile + workspace
 * created after sinceIso. Also removes engine_delayed_trigger + engine_event
 * rows created for reminders in this run.
 *
 * Cleanup is best-effort — errors are logged, not thrown.
 */
export async function cleanupPersonalRows(
  profileId: string = SEED_PROFILE_ID,
  workspaceId: string = SEED_WORKSPACE_ID,
  sinceIso?: string,
): Promise<void> {
  try {
    // personal_task rows
    let ptQuery = supabase
      .from("personal_task")
      .delete()
      .eq("profile_id", profileId)
      .eq("workspace_id", workspaceId);
    if (sinceIso) ptQuery = ptQuery.gte("created_at", sinceIso);
    await ptQuery;
  } catch {
    // ignore
  }

  try {
    // engine_memory rows (notes + settings added by this run)
    let memQuery = supabase
      .from("engine_memory")
      .delete()
      .eq("profile_id", profileId)
      .eq("workspace_id", workspaceId);
    if (sinceIso) memQuery = memQuery.gte("created_at", sinceIso);
    await memQuery;
  } catch {
    // ignore
  }

  try {
    // engine_event rows for personal.reminder (created by set_reminder)
    let evQuery = supabase
      .from("engine_event")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("event_type", "personal.reminder");
    if (sinceIso) evQuery = evQuery.gte("created_at", sinceIso);
    await evQuery;
  } catch {
    // ignore
  }

  try {
    // engine_trigger stubs created by set_reminder
    let trigQuery = supabase
      .from("engine_trigger")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("event_type", "personal.reminder");
    if (sinceIso) trigQuery = trigQuery.gte("created_at", sinceIso);
    await trigQuery;
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// assertPersonalToolFired
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a tool_call row naming the given
 * personal capability tool.  Returns the matched row.
 */
export async function assertPersonalToolFired(
  sessionId: string,
  toolName: string,
  opts: {
    sinceIso?: string;
    poll?: PollOptions;
  } = {},
): Promise<RecordingRow> {
  return assertRecordingPhase({
    sessionId,
    phase: "tool_call",
    turnKind: "tool_invocation",
    contentPredicate: (c) => {
      const content = c as Record<string, unknown>;
      return typeof content?.tool_name === "string" && content.tool_name === toolName;
    },
    sinceIso: opts.sinceIso,
    poll: opts.poll ?? { timeoutMs: 20_000 },
  });
}

// ---------------------------------------------------------------------------
// assertPersonalCapabilityClassified
// ---------------------------------------------------------------------------

/**
 * Poll agent_session_recording for a classifier_output row where
 * intent === 'personal'.  Returns the matched row.
 */
export async function assertPersonalCapabilityClassified(
  sessionId: string,
  sinceIso: string,
  poll?: PollOptions,
): Promise<RecordingRow> {
  return assertRecordingPhase({
    sessionId,
    phase: "classifier_output",
    turnKind: "user_input",
    contentPredicate: (c) => {
      const content = c as Record<string, unknown>;
      return typeof content?.intent === "string" && content.intent === "personal";
    },
    sinceIso,
    poll: poll ?? { timeoutMs: 20_000 },
  });
}

// ---------------------------------------------------------------------------
// assertPersonalTrailEvent
// ---------------------------------------------------------------------------

/**
 * Poll activity_trail for a personal.* event emitted by the given tool.
 * The event name is tool-specific (see mapping below).
 */
const TOOL_TO_EVENT: Record<string, string> = {
  add_note: "personal.note_added",
  create_task: "personal.task_created",
  set_reminder: "personal.reminder_set",
  get_history: "personal.history_queried",
  update_setting: "personal.setting_updated",
};

export async function assertPersonalTrailEvent(
  toolName: string,
  sinceIso: string,
  opts: {
    workspaceId?: string;
    actorId?: string;
    poll?: PollOptions;
  } = {},
): Promise<ActivityTrailRow> {
  const event = TOOL_TO_EVENT[toolName];
  if (!event) {
    throw new Error(`assertPersonalTrailEvent: unknown tool name "${toolName}"`);
  }

  return assertActivityTrailEvent({
    event,
    workspaceId: opts.workspaceId ?? SEED_WORKSPACE_ID,
    actorId: opts.actorId ?? SEED_PROFILE_ID,
    sinceIso,
    poll: opts.poll ?? { timeoutMs: 20_000 },
  });
}

// ---------------------------------------------------------------------------
// assertPersonalNoteRow
// ---------------------------------------------------------------------------

/**
 * Poll engine_memory for a row written by add_note (memory_type='general')
 * containing the given text fragment.  Returns the row.
 */
export async function assertPersonalNoteRow(
  textFragment: string,
  sinceIso: string,
  profileId: string = SEED_PROFILE_ID,
  workspaceId: string = SEED_WORKSPACE_ID,
): Promise<{ id: string; content: string; memory_type: string }> {
  const deadline = Date.now() + 20_000;
  const interval = 600;

  while (Date.now() < deadline) {
    const { data } = await supabase
      .from("engine_memory")
      .select("id, content, memory_type")
      .eq("profile_id", profileId)
      .eq("workspace_id", workspaceId)
      .eq("memory_type", "general")
      .ilike("content", `%${textFragment}%`)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      return data[0] as { id: string; content: string; memory_type: string };
    }
    await new Promise((r) => setTimeout(r, interval));
  }

  // Diagnostic dump
  const { data: recent } = await supabase
    .from("engine_memory")
    .select("id, content, memory_type, created_at")
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(5);

  expect(
    null,
    `assertPersonalNoteRow: no engine_memory general row containing "${textFragment}" ` +
      `after ${sinceIso}.\nRecent rows:\n${JSON.stringify(recent ?? [], null, 2)}`,
  ).not.toBeNull();

  throw new Error("unreachable");
}

// ---------------------------------------------------------------------------
// assertPersonalTaskRow
// ---------------------------------------------------------------------------

/**
 * Poll personal_task for a row with a title containing the given fragment.
 * Returns the row.
 */
export async function assertPersonalTaskRow(
  titleFragment: string,
  sinceIso: string,
  profileId: string = SEED_PROFILE_ID,
  workspaceId: string = SEED_WORKSPACE_ID,
): Promise<{ id: string; title: string; priority: string; status: string }> {
  const deadline = Date.now() + 20_000;
  const interval = 600;

  while (Date.now() < deadline) {
    const { data } = await supabase
      .from("personal_task")
      .select("id, title, priority, status")
      .eq("profile_id", profileId)
      .eq("workspace_id", workspaceId)
      .ilike("title", `%${titleFragment}%`)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      return data[0] as { id: string; title: string; priority: string; status: string };
    }
    await new Promise((r) => setTimeout(r, interval));
  }

  const { data: recent } = await supabase
    .from("personal_task")
    .select("id, title, priority, status, created_at")
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(5);

  expect(
    null,
    `assertPersonalTaskRow: no personal_task row with title containing "${titleFragment}" ` +
      `after ${sinceIso}.\nRecent rows:\n${JSON.stringify(recent ?? [], null, 2)}`,
  ).not.toBeNull();

  throw new Error("unreachable");
}

// ---------------------------------------------------------------------------
// assertPersonalSettingRow
// ---------------------------------------------------------------------------

/**
 * Poll engine_memory for a row written by update_setting (memory_type='preference')
 * containing the key=value pattern.  Returns the row.
 */
export async function assertPersonalSettingRow(
  key: string,
  value: string,
  sinceIso: string,
  profileId: string = SEED_PROFILE_ID,
  workspaceId: string = SEED_WORKSPACE_ID,
): Promise<{ id: string; content: string }> {
  const expectedFragment = `Innstilling: ${key}=${value}`;
  const deadline = Date.now() + 20_000;
  const interval = 600;

  while (Date.now() < deadline) {
    const { data } = await supabase
      .from("engine_memory")
      .select("id, content")
      .eq("profile_id", profileId)
      .eq("workspace_id", workspaceId)
      .eq("memory_type", "preference")
      .ilike("content", `%${expectedFragment}%`)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      return data[0] as { id: string; content: string };
    }
    await new Promise((r) => setTimeout(r, interval));
  }

  const { data: recent } = await supabase
    .from("engine_memory")
    .select("id, content, memory_type, created_at")
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId)
    .eq("memory_type", "preference")
    .order("created_at", { ascending: false })
    .limit(5);

  expect(
    null,
    `assertPersonalSettingRow: no engine_memory preference row containing "${expectedFragment}" ` +
      `after ${sinceIso}.\nRecent rows:\n${JSON.stringify(recent ?? [], null, 2)}`,
  ).not.toBeNull();

  throw new Error("unreachable");
}

// ---------------------------------------------------------------------------
// assertReminderRow
// ---------------------------------------------------------------------------

/**
 * Poll engine_delayed_trigger for a row created by set_reminder containing
 * the text fragment in the linked engine_event payload.
 * Returns { trigger_id, event_id, fire_at }.
 */
export async function assertReminderRow(
  textFragment: string,
  sinceIso: string,
  workspaceId: string = SEED_WORKSPACE_ID,
): Promise<{ id: string; fire_at: string }> {
  const deadline = Date.now() + 20_000;
  const interval = 600;

  while (Date.now() < deadline) {
    // Join via engine_event — the payload.text contains the reminder text.
    // We query engine_event first, then verify the linked delayed trigger exists.
    const { data: events } = await supabase
      .from("engine_event")
      .select("id, payload")
      .eq("workspace_id", workspaceId)
      .eq("event_type", "personal.reminder")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(10);

    if (events && events.length > 0) {
      for (const ev of events) {
        const payload = ev.payload as Record<string, unknown>;
        const text = typeof payload?.text === "string" ? payload.text : "";
        if (text.toLowerCase().includes(textFragment.toLowerCase())) {
          // Find the delayed trigger that references this event
          const { data: triggers } = await supabase
            .from("engine_delayed_trigger")
            .select("id, fire_at")
            .eq("event_id", ev.id)
            .limit(1);

          if (triggers && triggers.length > 0) {
            return triggers[0] as { id: string; fire_at: string };
          }
        }
      }
    }

    await new Promise((r) => setTimeout(r, interval));
  }

  expect(
    null,
    `assertReminderRow: no engine_delayed_trigger row for reminder containing "${textFragment}" ` +
      `after ${sinceIso} in workspace ${workspaceId}.`,
  ).not.toBeNull();

  throw new Error("unreachable");
}
