/**
 * Mutation event definitions for the telemetry system.
 *
 * Every mutation in the app must emit one of these events via @smartout/telemetry.
 * The requiredProperties array documents which fields MUST be present in the
 * event payload — enforced at runtime by the telemetry emit() function.
 */

export type MutationEventDef = {
  /** Human-readable description of when this event fires. */
  description: string;
  /** Properties that must be present in the event payload. */
  requiredProperties: readonly string[];
};

/**
 * Canonical list of mutation events.
 *
 * When adding a new mutation anywhere in the codebase, register it here first.
 * The telemetry registry (packages/telemetry/src/registry.ts) references these
 * names for routing to PostHog, logger, activity_trail, and engine_event.
 */
export const MUTATION_EVENTS = {
  // ── Profile ─────────────────────────────────────────────────────────
  profile_updated: {
    description: "User updated their own profile or admin updated a profile",
    requiredProperties: ["profile_id", "fields_changed"],
  },

  // ── Absences ────────────────────────────────────────────────────────
  absence_requested: {
    description: "Employee or manager created a new absence request",
    requiredProperties: ["profile_id", "absence_type", "start_date", "end_date"],
  },
  absence_cancelled: {
    description: "Absence was cancelled by employee or manager",
    requiredProperties: ["absence_id", "reason"],
  },

  // ── Shifts ──────────────────────────────────────────────────────────
  shift_created: {
    description: "New shift added to the schedule",
    requiredProperties: ["shift_id", "department_id", "date"],
  },
  shift_updated: {
    description: "Shift times, assignment, or metadata changed",
    requiredProperties: ["shift_id", "fields_changed"],
  },
  shift_deleted: {
    description: "Shift removed from schedule",
    requiredProperties: ["shift_id"],
  },
  shift_punched_in: {
    description: "Employee clocked in for a shift",
    requiredProperties: ["shift_id", "profile_id", "punched_at"],
  },
  shift_punched_out: {
    description: "Employee clocked out of a shift",
    requiredProperties: ["shift_id", "profile_id", "punched_at"],
  },
  shift_hours_confirmed: {
    description: "Employee confirmed their worked hours for a shift",
    requiredProperties: ["shift_id", "profile_id", "confirmed_hours"],
  },

  // ── Departments ─────────────────────────────────────────────────────
  department_created: {
    description: "New department added to the workspace",
    requiredProperties: ["department_id", "name"],
  },
  department_updated: {
    description: "Department name, settings, or operating hours changed",
    requiredProperties: ["department_id", "fields_changed"],
  },

  // ── Teams ───────────────────────────────────────────────────────────
  team_created: {
    description: "New team created within a department",
    requiredProperties: ["team_id", "department_id", "name"],
  },
  team_updated: {
    description: "Team composition or settings changed",
    requiredProperties: ["team_id", "fields_changed"],
  },

  // ── Website / CMS ──────────────────────────────────────────────────
  website_page_created: {
    description: "New page added to workspace website",
    requiredProperties: ["page_id", "slug"],
  },
  website_page_updated: {
    description: "Website page content or settings changed",
    requiredProperties: ["page_id", "fields_changed"],
  },
  website_published: {
    description: "Workspace website published (all pages deployed)",
    requiredProperties: ["workspace_id", "page_count"],
  },

  // ── Communication ──────────────────────────────────────────────────
  chat_message_sent: {
    description: "User sent a chat message",
    requiredProperties: ["channel_id", "sender_profile_id"],
  },

  // ── Compliance / operations ────────────────────────────────────────
  deviation_reported: {
    description: "Employee reported a deviation (incident, near-miss, etc.)",
    requiredProperties: ["deviation_id", "type", "reported_by"],
  },
  haccp_logged: {
    description: "HACCP control point logged (temperature, hygiene, etc.)",
    requiredProperties: ["log_id", "control_point", "value"],
  },
  handoff_submitted: {
    description: "Shift handoff notes submitted by outgoing employee",
    requiredProperties: ["shift_id", "profile_id"],
  },
} as const satisfies Record<string, MutationEventDef>;

/** Union type of all known mutation event names. */
export type MutationEventName = keyof typeof MUTATION_EVENTS;
