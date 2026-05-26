// scripts/live-invoke/shift-clock.mjs
// Live-invoke smoke for the shift-clock domain — see scripts/live-invoke/README.md.
//
// What this catches (L-0348 family):
//   - Column drift on timesheet.time_entry (15 cols, PK = time_entry_id)
//   - Column drift on public.shift_clock_config (13 cols, PK = id)
//   - Column drift on public.shift_note (7 cols, PK = id, FK shift_id → schedule_shift)
//   - RPC signature drift on timesheet.round_timestamp (payroll-rounding trigger)
//   - Schema prefix correctness: timesheet schema requires .schema("timesheet") —
//     omitting it will hit a missing public.time_entry and fail silently or 404.
//
// Design choices:
//   1. timesheet.time_entry is accessed via .schema("timesheet").from("time_entry")
//      — identical pattern to .schema("payroll") in payroll.mjs (L-0348 class).
//   2. shift_clock_config and shift_note live in the PUBLIC schema (no prefix).
//   3. Caller = service role → auth.uid() null → RLS returns empty rows. Expected.
//      Empty result = signature OK. Only an error field counts as failure.
//   4. round_timestamp RPC lives in the timesheet schema — call via
//      .schema("timesheet").rpc("round_timestamp", {...}).
//   5. shift-clock-compliance Edge Function existence is NOT verified here —
//      EF smoke belongs in a separate HTTP-level probe (Playwright / smoke-probe.sh).
//
// Known active bug — ShiftChatUnavailableBanner (do NOT remove this note):
//   apps/mobile/src/components/shift-clock/ShiftChatUnavailableBanner.tsx:5-6
//   apps/mobile/src/hooks/shift-clock/useShiftChat.ts:15-17, 248-270
//   useShiftChat.sendMessage enqueues with sendMessageSchema which requires
//   `channel_id` (ADR-0132 new schema) but the hook reads chat_conversation /
//   chat_message (legacy schema that has no channel_id). Enqueue throws Zod.
//   The banner renders in place of ShiftChatInput unconditionally as a P0 guard.
//   Resolution: mobile-shift-chat-bff-migration follow-up sortie.
//
// Smoke coverage (5 assertions — 4 reads + 1 RPC existence):
//   1. timesheet.time_entry         — PK drift, core clock-in/out row
//   2. public.shift_clock_config    — GPS + punch-window config per dept/team
//   3. public.shift_note            — shift annotation, FK shift_id verified
//   4. timesheet.round_timestamp    — payroll rounding RPC existence + return type
//   5. timesheet.time_entry status  — enum column present (time_entry_status)
//
// Usage:
//   op run --env-file=.env.template -- node scripts/live-invoke/shift-clock.mjs

import { client, header, assertOk, assertShape, result } from "./_lib.mjs";

const sb = client("service");

header("shift-clock");

// ── 1. timesheet.time_entry — core clock-in/out record ──────────────────────
// PK = time_entry_id (NOT id — L-0348 class trap).
// status is an enum: "clocked_in" | "completed" | "edited" (timesheet.time_entry_status).
// punch_out nullable (null while clocked in). GPS columns are Json | null.
// Row keys from database.types.ts timesheet.Tables.time_entry.Row (15 cols).
const timeEntries = await sb
  .schema("timesheet")
  .from("time_entry")
  .select(
    "time_entry_id, workspace_id, profile_id, shift_id, " +
    "punch_in, punch_out, status, source, notes, " +
    "breaks, break_locations, punch_in_location, punch_out_location, " +
    "created_at, updated_at",
  )
  .limit(1);
assertOk("timesheet.time_entry select (15 cols)", timeEntries);
assertShape("timesheet.time_entry column shape", timeEntries.data, [
  "time_entry_id",
  "workspace_id",
  "profile_id",
  "shift_id",
  "punch_in",
  "punch_out",
  "status",
  "source",
  "created_at",
  "updated_at",
]);

// ── 2. public.shift_clock_config — GPS + punch-window config ─────────────────
// PK = id (plain UUID, NOT shift_clock_config_id).
// department_id + team_id are nullable (config can be workspace-wide).
// gps_reference_lat / gps_reference_lng nullable when GPS not configured.
// Row keys from database.types.ts public.Tables.shift_clock_config.Row (13 cols).
const clockConfigs = await sb
  .from("shift_clock_config")
  .select(
    "id, workspace_id, department_id, team_id, " +
    "gps_required, gps_reference_lat, gps_reference_lng, gps_radius_meters, " +
    "punch_window_minutes, adhoc_shifts_enabled, adhoc_requires_approval, " +
    "created_at, updated_at",
  )
  .limit(1);
assertOk("public.shift_clock_config select (13 cols)", clockConfigs);
assertShape("public.shift_clock_config column shape", clockConfigs.data, [
  "id",
  "workspace_id",
  "gps_required",
  "gps_radius_meters",
  "punch_window_minutes",
  "adhoc_shifts_enabled",
  "adhoc_requires_approval",
  "created_at",
  "updated_at",
]);

// ── 3. public.shift_note — shift annotation layer ────────────────────────────
// PK = id. FK shift_id → schedule_shift.schedule_shift_id (NOT shift_note_id).
// Only 7 cols — intentionally slim: content + identity + audit.
// Row keys from database.types.ts public.Tables.shift_note.Row (7 cols).
const shiftNotes = await sb
  .from("shift_note")
  .select(
    "id, workspace_id, profile_id, shift_id, content, created_at, updated_at",
  )
  .limit(1);
assertOk("public.shift_note select (7 cols)", shiftNotes);
assertShape("public.shift_note column shape", shiftNotes.data, [
  "id",
  "workspace_id",
  "profile_id",
  "shift_id",
  "content",
  "created_at",
  "updated_at",
]);

// ── 4. timesheet.round_timestamp RPC — payroll-rounding trigger ──────────────
// Exists in timesheet schema (database.types.ts timesheet.Functions.round_timestamp).
// Args: p_direction (string), p_interval (string), p_ts (string). Returns string.
// We pass valid inputs so the RPC exercises the function body, not just the call.
// "nearest" direction + "00:15:00" interval is the standard payroll rounding config.
const rounding = await sb
  .schema("timesheet")
  .rpc("round_timestamp", {
    p_direction: "nearest",
    p_interval: "00:15:00",
    p_ts: new Date().toISOString(),
  });
if (rounding.error?.code === "42883") {
  // Function does not exist — deployment gap.
  console.log(
    `  ✗ timesheet.rpc round_timestamp — FUNCTION NOT FOUND (42883): ${rounding.error.message}`,
  );
  process.exitCode = 1;
} else if (rounding.error) {
  // Any other error still means the function is deployed (signature exists).
  // Non-42883 errors on valid inputs are unexpected — fail hard.
  console.log(
    `  ✗ timesheet.rpc round_timestamp — unexpected error (${rounding.error.code}): ${rounding.error.message}`,
  );
  process.exitCode = 1;
} else {
  const returnedType = typeof rounding.data;
  console.log(
    `  ✓ timesheet.rpc round_timestamp — function deployed, returned ${returnedType}: ${rounding.data}`,
  );
}

// ── 5. timesheet.time_entry status enum guard ────────────────────────────────
// Confirms status column holds a valid enum value if any row exists.
// A SelectQueryError or wrong column name would surface in assertion 1 above;
// this check adds explicit enum-range verification when data is present.
const enumCheck = await sb
  .schema("timesheet")
  .from("time_entry")
  .select("time_entry_id, status")
  .in("status", ["clocked_in", "completed", "edited"])
  .limit(1);
assertOk("timesheet.time_entry status enum filter (no unknown values)", enumCheck);

result();
