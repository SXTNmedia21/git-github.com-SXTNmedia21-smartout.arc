import type { NonEmptyString } from "./non-empty-string.js";

// ─── Base Event Shape ───────────────────────────
export interface BaseEvent {
  // Nullable when an event is genuinely platform-scoped (billing_activity_log).
  // When present, must be NonEmptyString — no "" fallback permitted (ADR-0193).
  workspace_id: NonEmptyString | null;
  actor_id: NonEmptyString; // profile_id representing who performed the action
  timestamp?: string; // ISO 8601; auto-populated if omitted
  correlation_id?: string; // Trace IDs
}

// ─── Routing Metadata ───────────────────────────
export type EventDestination =
  | "posthog"
  | "logger"
  | "activity_trail"
  | "engine_event"
  | "billing_activity_log"; // ADR-0125 — platform-scoped audit for billing events

export interface EventMeta {
  destinations: EventDestination[];
  category: EventCategory;
}

export type EventCategory =
  | "auth"
  | "onboarding"
  | "org_structure"
  | "scheduling"
  | "contracts"
  | "operations"
  | "haccp"
  | "training"
  | "communication"
  | "system"
  | "navigation"
  | "channels"
  | "agent"
  | "telegram"
  | "wizard"
  | "security"
  | "enrichment"
  | "ops_intelligence" // ADR-0088
  | "billing" // ADR-0118 / ADR-0125
  | "help" // ADR-0219 — /dashboard/help Multi-Tier Hub
  | "helpdesk" // ADR-0160 / ADR-0161 / ADR-0162
  | "journey" // ADR-0175 (S1.1 — Journey Engine)
  | "availability" // ADR-0200 (campaign/daily-operation sortie 2 — Employee Availability)
  | "governance" // M2.3 (campaign/core-module — Workspace Doc Chunk Auto-Update)
  | "page_takeover"; // M3.2 (campaign/core-module — Page-Takeover Harness, ADR-0228)

// ─── Entity Reference (for robust UI audit trails) ─
export interface EntityRef {
  entity_type: EntityType;
  entity_id: string;
  entity_label?: string; // Context-friendly label (e.g., "Tuesday 18:00 - Kitchen")
}

export type EntityType =
  | "company"
  | "workspace"
  | "profile"
  | "department"
  | "location"
  | "zone"
  | "asset"
  | "position"
  | "team"
  | "season"
  | "shift"
  | "shift_template"
  | "department_session"
  | "session_task"
  | "session_hook"
  | "policy"
  | "protocol"
  | "protocol_assignment"
  | "procedure"
  | "procedure_step"
  | "routine"
  | "runbook"
  | "contract"
  | "contract_template"
  | "contract_attachment"
  | "invitation"
  | "announcement"
  | "chat_message"
  | "reconciliation"
  | "handbook_chapter"
  | "absence"
  | "roster"
  | "open_shift"
  | "template"
  | "day_info"
  | "guardian_signal"
  | "leader_pulse"
  | "conversation"
  | "season_budget"
  | "season_goal"
  | "season_policy_binding"
  | "planning_cycle"
  | "department_operating_hours"
  | "kpi_target"
  | "workspace_budget"
  | "authority_config"
  | "channel"
  | "channel_member"
  | "channel_message"
  | "channel_event"
  | "help_request"
  | "news_post"
  | "website"
  | "website_page"
  | "website_section"
  | "website_asset"
  | "website_spokesperson"
  | "deviation"
  | "agent_session"
  | "task_surface"
  | "entity_drawer"
  | "financial_close_config"
  | "profession"
  | "legal_function"
  | "change_proposal"
  | "shift_approval"
  | "holiday_entry"
  | "employment_contract"
  | "engine_state"
  | "service_config"
  | "contract_template_binding"
  | "observer_request"
  | "inspection_link"
  | "notification_policy"
  | "invoice"
  | "invoice_line_item"
  | "usage_snapshot"
  | "pricing_terms"
  | "basis_drift_event"
  // ─── Billing Fase 2 ─────────────────────────────
  | "invoice_dispatch"
  | "billing_dispatch_rule"
  | "billing_dispatch_template"
  | "billing_integration"
  // ─── Billing Fase 3A ────────────────────────────
  | "payment"
  | "payment_attempt"
  | "dunning_escalation_log"
  // ─── Journey Engine (ADR-0175) ──────────────────
  | "journey_run"
  | "journey_version"
  // ─── Availability (ADR-0200) ────────────────────
  | "availability"
  // ─── Accountant cross-company grant (ADR-A, M3 2026-05-02) ───────
  | "accountant_company_grant";

export type ActionVerb =
  | "created"
  | "updated"
  | "deleted"
  | "archived"
  | "restored"
  | "published"
  | "assigned"
  | "unassigned"
  | "completed"
  | "started"
  | "signed"
  | "approved"
  | "rejected"
  | "escalated"
  | "viewed"
  | "list_viewed"
  | "detail_viewed"
  | "exported"
  | "invited"
  | "accepted"
  | "swapped"
  | "transferred"
  | "clicked"
  | "opened"
  | "closed"
  | "pending_signoff"
  | "submitted"
  | "admin_action"
  | "sent"
  | "cancelled"
  | "declined"
  | "expired"
  | "reminded"
  | "step_completed"
  | "chapter_saved"
  | "hook_fired"
  | "task_completed"
  | "acknowledged"
  | "dismissed"
  | "answered"
  | "loaded"
  | "locked"
  | "auto_filled"
  | "joined"
  | "left"
  | "pinned"
  | "unpinned"
  | "reacted"
  | "unreacted"
  | "read"
  | "shared"
  | "requested_help"
  | "unpublished"
  | "rollback"
  | "verified"
  | "failed"
  | "generated"
  | "late_detected"
  | "no_show_escalated"
  | "confirmed"
  | "granted"
  | "revoked"
  | "entered"
  | "abandoned"
  | "missed"
  | "corrected"
  | "logged"
  | "rate_limited"
  | "lockout_triggered"
  | "sandbox_blocked"
  | "resolved"
  | "issued"
  | "converted"
  | "claimed"
  // ─── Accountant / auth (ADR-A, M3) ─────────────
  | "signed_in"
  | "signed_out";

// ─── Auth Module Events ─────────────────────────
export interface AuthSignedUp extends BaseEvent {
  event: "auth signed_up";
  // silent: true when the user is already authenticated (e.g., via invite link) and no explicit sign-up action occurred
  properties: { method: "email" | "google" | "invite_link"; silent?: boolean };
}

export interface AuthSignedIn extends BaseEvent {
  event: "auth signed_in";
  properties: { method: "email" | "google" };
}

export interface AuthSignedOut extends BaseEvent {
  event: "auth signed_out";
  properties: Record<string, never>;
}

export interface AuthOtpSent extends BaseEvent {
  event: "auth otp_sent";
  properties: { data: { context: "workspace_entry" | "login" } };
}

export interface AuthOtpVerified extends BaseEvent {
  event: "auth otp_verified";
  properties: { data: { attempts: number; duration_ms: number } };
}

export interface AuthOtpFailed extends BaseEvent {
  event: "auth otp_failed";
  properties: { data: { reason: "expired" | "wrong_code" | "max_attempts" } };
}

export interface AuthLoggedIn extends BaseEvent {
  event: "auth logged_in";
  properties: { data: { method: "password" | "otp" | "google" } };
}

export interface LoginCodeSent extends BaseEvent {
  event: "login_code sent";
  properties: {
    entity: { entity_type: "profile"; entity_id: string };
    data: { channel: string };
  };
}

// Password reset lifecycle.
export interface AuthPasswordResetRequested extends BaseEvent {
  event: "auth password_reset_requested";
  properties: {
    data: {
      // SHA-256 or similar — never the raw email. Used to dedupe/rate-limit.
      email_hash: string;
      // True when a user_identity row exists; false otherwise (enumeration-safe).
      user_exists: boolean;
    };
  };
}

export interface AuthPasswordResetCompleted extends BaseEvent {
  event: "auth password_reset_completed";
  properties: {
    data: {
      user_id: string;
      // "migration" = force_password_reset flag cleared; "self_service" = normal reset flow.
      context: "migration" | "self_service";
    };
  };
}

// ─── Navigation / UI Rules ──────────────────────
export interface PageViewed extends BaseEvent {
  event: "page viewed";
  properties: { path: string; referrer?: string };
}

// The UI Engine 'Always Track Interaction' standard relies on this.
export interface ButtonClicked extends BaseEvent {
  event: "button clicked";
  properties: {
    trackingId: string; // e.g., 'primary-submit'
    context?: string; // What object was clicked? e.g., 'department_form'
  };
}

// ─── Org Structure Events ───────────────────────
export interface DepartmentCreated extends BaseEvent {
  event: "department created";
  properties: {
    entity: EntityRef;
    data: { name: string; color?: string; leader_id?: string };
  };
}

export interface DepartmentUpdated extends BaseEvent {
  event: "department updated";
  properties: {
    entity: EntityRef;
    changes: Record<string, { before: unknown; after: unknown }>;
  };
}

export interface DepartmentArchived extends BaseEvent {
  event: "department archived";
  properties: {
    entity: EntityRef;
    data: { name: string };
  };
}

// ─── Profession System Events ──────────────────────────
export interface ProfessionCreated extends BaseEvent {
  event: "profession created";
  properties: {
    entity: EntityRef;
    data: { name: string; slug: string; source: "onboarding" | "admin" };
  };
}

export interface PositionCreated extends BaseEvent {
  event: "position created";
  properties: {
    entity: EntityRef;
    data: { name: string; profession_id?: string; authority_level?: string };
  };
}

export interface PositionUpdated extends BaseEvent {
  event: "position updated";
  properties: {
    entity: EntityRef;
    changes: Record<string, { before: unknown; after: unknown }>;
  };
}

// ─── Zone / Asset / Location / Team Events ──────
// Generic create/update events for admin-authored org entities. Shape mirrors
// DepartmentCreated / DepartmentUpdated — `data` on create (initial values),
// `changes` on update (before/after per field). `entity.entity_type` carries
// the specific table so consumers can discriminate without a new event name.

export interface ZoneCreated extends BaseEvent {
  event: "zone created";
  properties: {
    entity: EntityRef;
    data: { name: string; location_id: string; capacity?: number; color?: string };
  };
}

export interface ZoneUpdated extends BaseEvent {
  event: "zone updated";
  properties: {
    entity: EntityRef;
    changes: Record<string, { before: unknown; after: unknown }>;
  };
}

export interface AssetCreated extends BaseEvent {
  event: "asset created";
  properties: {
    entity: EntityRef;
    data: {
      name: string;
      location_id: string;
      asset_type: string;
      requires_training: boolean;
      requires_routine: boolean;
    };
  };
}

export interface AssetUpdated extends BaseEvent {
  event: "asset updated";
  properties: {
    entity: EntityRef;
    changes: Record<string, { before: unknown; after: unknown }>;
  };
}

export interface LocationCreated extends BaseEvent {
  event: "location created";
  properties: {
    entity: EntityRef;
    data: { name: string; location_type: string; capacity?: number };
  };
}

export interface LocationUpdated extends BaseEvent {
  event: "location updated";
  properties: {
    entity: EntityRef;
    changes: Record<string, { before: unknown; after: unknown }>;
  };
}

export interface TeamUpdated extends BaseEvent {
  event: "team updated";
  properties: {
    entity: EntityRef;
    changes: Record<string, { before: unknown; after: unknown }>;
  };
}

export interface LegalFunctionAssigned extends BaseEvent {
  event: "legal_function assigned";
  properties: {
    entity: EntityRef;
    data: { profile_id: string; slug: string };
  };
}

export interface ProfileAccessGranted extends BaseEvent {
  event: "profile granted";
  properties: {
    entity: EntityRef;
    data: { scope: string; granted_by: "authority" | "legal_function" | "manual" };
  };
}

export interface ProfileAccessRevoked extends BaseEvent {
  event: "profile revoked";
  properties: {
    entity: EntityRef;
    data: { scope: string };
  };
}

export interface ProfileRoleUpdated extends BaseEvent {
  event: "profile role updated";
  properties: {
    entity: EntityRef;
    data: { new_role: string };
  };
}

export interface ProfileDepartmentUpdated extends BaseEvent {
  event: "profile department updated";
  properties: {
    entity: EntityRef;
    data: { department_id: string };
  };
}

export interface ProfileStatusUpdated extends BaseEvent {
  event: "profile status updated";
  properties: {
    entity: EntityRef;
    data: { from_status: string; to_status: string };
  };
}

export interface ProfileDeactivated extends BaseEvent {
  event: "profile deactivated";
  properties: {
    entity: EntityRef;
    data: Record<string, never>;
  };
}

export interface ProfileReactivated extends BaseEvent {
  event: "profile reactivated";
  properties: {
    entity: EntityRef;
    data: Record<string, never>;
  };
}

/** Emitted when an admin sends a passwordless login code to a profile (SMS or email). */
export interface ProfileLoginCodeSent extends BaseEvent {
  event: "profile login code sent";
  properties: {
    entity: EntityRef;
    data: { channel: "email" | "sms" };
  };
}

// ─── Welcome Wizard Events (first-login data capture) ────────────────────────

export interface ProfileWelcomeWizardStarted extends BaseEvent {
  event: "profile welcome_wizard_started";
  properties: {
    entity: EntityRef;
    data: Record<string, never>;
  };
}

export interface ProfileWelcomeWizardStepCompleted extends BaseEvent {
  event: "profile welcome_wizard_step_completed";
  properties: {
    entity: EntityRef;
    data: { step: number; step_name: string };
  };
}

export interface ProfileWelcomeWizardCompleted extends BaseEvent {
  event: "profile welcome_wizard_completed";
  properties: {
    entity: EntityRef;
    data: { completed_at: string };
  };
}

export interface ProfileWelcomeWizardSkippedOptional extends BaseEvent {
  event: "profile welcome_wizard_skipped_optional";
  properties: {
    entity: EntityRef;
    data: { step: number };
  };
}

export interface InvitationCancelled extends BaseEvent {
  event: "invitation cancelled";
  properties: {
    entity: EntityRef;
    data: { invitation_id: string };
  };
}

export interface InvitationResent extends BaseEvent {
  event: "invitation resent";
  properties: {
    entity: EntityRef;
    data: { invitation_id: string };
  };
}

export interface OnboardingProfessionsConfirmed extends BaseEvent {
  event: "profession confirmed";
  properties: {
    entity: EntityRef;
    data: { profession_count: number; position_count: number };
  };
}

// ─── Scheduling Events ──────────────────────────
// FLAT entity contract (see engine-event contract note below).
export interface ShiftCreated extends BaseEvent {
  event: "shift created";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: {
      assigned_to: string;
      date: string;
      start_time: string;
      end_time: string;
      position_id?: string;
    };
  };
}

export interface ShiftUpdated extends BaseEvent {
  event: "shift updated";
  properties: {
    entity_type: "shift";
    entity_id: string;
    changes: Record<string, { before: unknown; after: unknown }>;
  };
}

export interface ShiftDeleted extends BaseEvent {
  event: "shift deleted";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: {
      assigned_to: string;
      date: string;
      start_time: string;
      end_time: string;
    };
  };
}

// Campaign daily-operation, Invariant #13 — admin-created shift from the
// RosterTab "Legg til vakt" CTA. Distinct from "shift created" (bulk roster
// fill / normal authoring) because it carries a `manual=true` flag and a
// `reason` string for audit reconstruction in `activity_trail.data`.
// Gated via `roster.add_shift_manual` (engine_authority_config).
export interface ShiftAddedManual extends BaseEvent {
  event: "shift added_manual";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: {
      assigned_to: string;
      date: string;
      start_time: string;
      end_time: string;
      role: string;
      source: "manual_admin";
      manual: true;
      reason: string;
    };
  };
}

// ─── Journey 03 (Sjekke vakter) — PoC events ────
// These events use the canonical FLAT properties shape (entity_type/entity_id
// at the top level), matching the Shift* lifecycle events above.
// This is REQUIRED by the Event Engine contract: engine-dispatch reads
// `payload.entity_id` directly from the top of the payload to populate
// `engine_state.entity_id` and enforce unique-active dedupe.
// engine-event.ts builds payload as `{ ...event.properties }`, so the entity
// keys MUST be flat in `properties`. See spec C2 + Task 0 finding 0.9
// + Council R2 BREAK 1 (2026-04-15).
export interface ShiftListViewed extends BaseEvent {
  event: "shift list_viewed";
  properties: {
    entity_type: "profile";
    entity_id: string;
    week_start?: string;
  };
}

export interface ShiftDetailViewed extends BaseEvent {
  event: "shift detail_viewed";
  properties: {
    entity_type: "profile";
    entity_id: string;
    shift_id: string;
  };
}

// ─── Scheduling: Shift lifecycle events (FLAT entity contract) ──
// These events use the FLAT properties shape per the engine-event
// contract documented above: `entity_type` + `entity_id` at the top
// of `properties`, not a nested `entity: EntityRef`. The engine-event
// provider spreads `event.properties` into the dispatch payload, and
// engine-dispatch reads `payload.entity_id` to populate
// `engine_state.entity_id`. See Council R2 / BREAK 1, Supervisor
// code-trace and `Journey 03` events above for the rationale.
export interface ShiftPublished extends BaseEvent {
  event: "shift published";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: {
      dates: string[];
      department_ids: string[];
      shift_ids: string[];
      shift_count: number;
    };
  };
}

// ─── Scheduling: Shift Completed ────────────────
export interface ShiftCompleted extends BaseEvent {
  event: "shift completed";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: {
      shift_ids: string[];
      department_id: string;
    };
  };
}

// ─── Scheduling: Shift Clock Events ─────────────
export interface ShiftPunchedIn extends BaseEvent {
  event: "shift punched_in";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: {
      shift_id: string;
      time_entry_id: string;
      punch_time: string;
      is_adhoc: boolean;
      gps_verified: boolean;
      gps_distance_meters: number | null;
      // Optional — populated by session-lifecycle sub-sortie (2026-04-20)
      // when an admin retroactively writes time_entry on behalf of an employee.
      manual?: boolean;
      reason?: string;
    };
  };
}

export interface ShiftPunchedOut extends BaseEvent {
  event: "shift punched_out";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: {
      shift_id: string;
      time_entry_id: string;
      punch_time: string;
      work_minutes: number;
      break_minutes: number;
      gps_verified: boolean;
    };
  };
}

export interface ShiftBreakStarted extends BaseEvent {
  event: "shift break_started";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: { shift_id: string; time_entry_id: string };
  };
}

export interface ShiftBreakEnded extends BaseEvent {
  event: "shift break_ended";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: {
      shift_id: string;
      time_entry_id: string;
      break_minutes: number;
      is_paid: boolean;
    };
  };
}

export interface ShiftSupplementClaimed extends BaseEvent {
  event: "shift supplement_claimed";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: { shift_id: string; supplement_rule_id: string; amount: number };
  };
}

export interface ShiftSupplementReviewed extends BaseEvent {
  event: "shift supplement_reviewed";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: {
      supplement_id: string;
      status: "approved" | "rejected";
      reviewed_by: string;
    };
  };
}

export interface ShiftNoteAdded extends BaseEvent {
  event: "shift note_added";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: { shift_id: string; note_id: string };
  };
}

export interface ShiftAdhocCreated extends BaseEvent {
  event: "shift adhoc_created";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: { shift_id: string; department_id: string; requires_approval: boolean };
  };
}

export interface ShiftAdhocApproved extends BaseEvent {
  event: "shift adhoc_approved";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: { shift_id: string; approved_by: string };
  };
}

export interface ShiftCallInitiated extends BaseEvent {
  event: "shift call_initiated";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: { shift_id: string; department_id: string; leaders_on_duty: number };
  };
}

// ─── Scheduling: Lateness Detection ─────────────
export interface ShiftLateDetected extends BaseEvent {
  event: "shift late_detected";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: { minutes_late: number; threshold: number };
  };
}

export interface ShiftNoShowEscalated extends BaseEvent {
  event: "shift no_show_escalated";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: { minutes_late: number };
  };
}

// ─── Operations: Session Lifecycle ──────────────
export interface SessionOpened extends BaseEvent {
  event: "session opened";
  properties: {
    entity?: EntityRef;
    data: {
      department_id: string;
      date: string;
      // Optional — populated by session-lifecycle sub-sortie (2026-04-20)
      department_session_id?: string;
      from_status?: string;
      to_status?: string;
      manual?: boolean;
    };
  };
}

export interface SessionPendingSignoff extends BaseEvent {
  event: "session pending_signoff";
  properties: {
    entity: EntityRef;
    data: {
      department_id: string;
      date: string;
      // Optional — populated by session-lifecycle sub-sortie (2026-04-20)
      department_session_id?: string;
      from_status?: string;
      to_status?: string;
      manual?: boolean;
    };
  };
}

export interface SessionClosed extends BaseEvent {
  event: "session closed";
  properties: {
    entity: EntityRef;
    data: {
      department_id: string;
      date: string;
      // Optional — populated by session-lifecycle sub-sortie (2026-04-20)
      department_session_id?: string;
      from_status?: string;
      to_status?: string;
      manual?: boolean;
    };
  };
}

// Added 2026-04-20 (session-lifecycle) — admin may mark a session as `missed`
// retroactively when the day passed without any activity.
export interface SessionMissed extends BaseEvent {
  event: "session missed";
  properties: {
    entity: EntityRef;
    data: {
      department_id: string;
      date: string;
      department_session_id?: string;
      from_status?: string;
      to_status?: string;
      manual?: boolean;
    };
  };
}

// Added 2026-04-23 (phase 0c watchdog-demotion — campaign/daily-operation
// closure) — session-watchdog-demoter cron demotes rows stuck in
// `pending_signoff` for more than SESSION_PENDING_SIGNOFF_STALE_HOURS
// (default 24 h) to `missed`. Per ADR-0187 the engine_event fan-out is
// emitted by the DB trigger `trg_session_demoted_to_missed`; the Edge
// Function emits the activity_trail + logger destinations directly
// (same interim shape as journey-stuck-detector under ADR-0175).
export interface SessionDemotedToMissed extends BaseEvent {
  event: "session demoted_to_missed";
  properties: {
    entity: EntityRef;
    data: {
      session_id: string;
      department_id: string;
      workspace_id: string;
      previous_status: "pending_signoff";
      stale_hours: number;
      automated: true;
      manual?: false;
      system?: true;
      session_date?: string;
      previous_updated_at?: string;
      demoted_at?: string;
    };
  };
}

// ─── Operations: Session Hooks & Tasks ──────────
export interface SessionHookFired extends BaseEvent {
  event: "session hook_fired";
  properties: {
    data: {
      hook_type: string;
      session_id: string;
    };
  };
}

export interface SessionHookCreated extends BaseEvent {
  event: "session_hook created";
  properties: {
    data: {
      hook_id: string;
      department_id: string;
      hook_type: string;
      linked_procedure_id: string;
    };
  };
}

export interface SessionHookDeleted extends BaseEvent {
  event: "session_hook deleted";
  properties: {
    data: {
      hook_id: string;
    };
  };
}

export interface SessionTaskCompleted extends BaseEvent {
  event: "session_task completed";
  properties: {
    entity: EntityRef;
    data: {
      task_id: string;
      profile_id: string;
    };
  };
}

export interface SessionTaskCreated extends BaseEvent {
  event: "session_task.created";
  properties: {
    entity: EntityRef;
    metadata: { source: string };
  };
}

export interface SessionTaskAssigned extends BaseEvent {
  event: "session_task.assigned";
  properties: {
    entity: EntityRef;
    metadata: { source: string; assigned_to: string };
  };
}

/**
 * task.added_manual — Admin manually added an ad-hoc session_task via the
 * WebDayControl Oppgaver tab (NOT via hook-lifecycle cron or agent). Emitted
 * by `apps/web/src/app/dashboard/_actions/add-task-action.ts` after a
 * `gate_action('task.add_task_manual')` allow + insert. `session_task` has no
 * `source_type` column, so the manual origin is carried here and in
 * `activity_trail` (via the `activity_trail` destination + `manual=true`
 * metadata), mirroring the pattern from shift.manual_time_entry + ADR-0189.
 */
export interface TaskAddedManual extends BaseEvent {
  event: "task.added_manual";
  properties: {
    entity: EntityRef;
    metadata: {
      source: "web_day_control_tasks_tab";
      department_session_id: string;
      session_hook_id: string | null;
      assigned_to: string | null;
      is_compliance_required: boolean;
      reason: string;
      manual: true;
    };
  };
}

export interface CommunicationBroadcastSent extends BaseEvent {
  event: "communication.broadcast_sent";
  properties: {
    metadata: { source: string; recipient_count: number; channel_id: string };
  };
}

// ─── HMS: Cleaning Checklists ──────────────────
export interface ChecklistStarted extends BaseEvent {
  event: "checklist started";
  properties: {
    data: {
      procedure_id: string;
      session_id: string;
    };
  };
}

export interface ChecklistStepCompleted extends BaseEvent {
  event: "checklist step_completed";
  properties: {
    data: {
      task_id: string;
    };
  };
}

export interface ChecklistCompleted extends BaseEvent {
  event: "checklist completed";
  properties: {
    data: {
      procedure_id: string;
      session_id: string;
      total_steps: number;
    };
  };
}

export interface ChecklistOverdue extends BaseEvent {
  event: "checklist overdue";
  properties: {
    data: {
      procedure_id: string;
      session_id: string;
    };
  };
}

export interface ChecklistDeviationFlagged extends BaseEvent {
  event: "checklist deviation_flagged";
  properties: {
    entity: EntityRef;
    data: {
      task_id: string;
      reason: string;
    };
  };
}

// ─── HMS: Deviations ────────────────────────────
export interface DeviationReported extends BaseEvent {
  event: "deviation reported";
  properties: {
    entity: EntityRef;
    data: {
      domain: string;
      severity: string;
    };
  };
}

export interface DeviationUpdated extends BaseEvent {
  event: "deviation updated";
  properties: {
    entity: EntityRef;
    data: {
      status: string;
    };
  };
}

export interface DeviationResolved extends BaseEvent {
  event: "deviation resolved";
  properties: {
    entity: EntityRef;
    data: {
      resolution_notes: string;
    };
  };
}

// ─── Onboarding: Invitation ─────────────────────
export interface InvitationAccepted extends BaseEvent {
  event: "invitation accepted";
  properties: {
    data: {
      profile_id: string;
      workspace_id: string;
    };
  };
}

// Invitation lifecycle events (ADR-0167 — tokens are credentials,
// never log full values; use token.substring(0, 8) + "..." for
// token_preview fields).
export interface InvitationCreated extends BaseEvent {
  event: "invitation created";
  properties: {
    entity: EntityRef;
    data: {
      invitation_id: string;
      workspace_id: string;
      role: string;
      // First 8 chars only — never full token.
      token_preview: string;
      employment_type?: string;
      bulk_count?: number;
    };
  };
}

export interface InvitationDispatched extends BaseEvent {
  event: "invitation dispatched";
  properties: {
    entity: EntityRef;
    data: {
      invitation_id: string;
      channel: "email" | "sms" | "link_only" | "whatsapp";
      outcome: "sent" | "failed";
      reason?: string;
      // First 8 chars only — never full token.
      token_preview: string;
    };
  };
}

export interface InvitationOpened extends BaseEvent {
  event: "invitation opened";
  properties: {
    entity: EntityRef;
    data: {
      invitation_id: string;
      workspace_id: string;
      // First 8 chars only — never full token.
      token_preview: string;
    };
  };
}

export interface InvitationExpired extends BaseEvent {
  event: "invitation expired";
  properties: {
    entity: EntityRef;
    data: {
      invitation_id: string;
      workspace_id: string;
      // First 8 chars only — never full token.
      token_preview: string;
    };
  };
}

// ─── Training: Protocol Lifecycle ───────────────
export interface ProtocolAssigned extends BaseEvent {
  event: "protocol assigned";
  properties: {
    data: {
      protocol_id: string;
      profile_id: string;
    };
  };
}

export interface ProtocolStepCompleted extends BaseEvent {
  event: "protocol step_completed";
  properties: {
    data: {
      procedure_step_id: string;
      profile_id: string;
    };
  };
}

export interface ProtocolTestSubmitted extends BaseEvent {
  event: "protocol test_submitted";
  properties: {
    data: {
      knowledge_test_id: string;
      profile_id: string;
      passed: boolean;
    };
  };
}

export interface ProtocolConfirmationSigned extends BaseEvent {
  event: "protocol confirmation_signed";
  properties: {
    data: {
      confirmation_id: string;
      profile_id: string;
    };
  };
}

export interface ProtocolCompleted extends BaseEvent {
  event: "protocol completed";
  properties: {
    data: {
      protocol_assignment_id: string;
      profile_id: string;
    };
  };
}

// ─── Reconciliation ─────────────────────────────
export interface ReconciliationSubmitted extends BaseEvent {
  event: "reconciliation submitted";
  properties: {
    data: {
      reconciliation_id: string;
    };
  };
}

export interface ReconciliationStepCompleted extends BaseEvent {
  event: "reconciliation step_completed";
  properties: {
    data: {
      reconciliation_id?: string;
      session_id: string;
      step: string;
    };
  };
}

export interface ReconciliationPendingSignoff extends BaseEvent {
  event: "reconciliation pending_signoff";
  properties: {
    data: {
      reconciliation_id?: string;
      session_id: string;
      duty_leader_id: string | null;
    };
  };
}

export interface ReconciliationAdminAction extends BaseEvent {
  event: "reconciliation admin_action";
  properties: {
    data: {
      reconciliation_id: string;
      action: "approved" | "rejected";
    };
  };
}

/**
 * Admin-override of a wizard preflight blocker (Invariant #9 /
 * daily-operation closure Item 4). Separate from `admin_action` because
 * the semantics differ — this fires when the admin force-bypasses a
 * preflight blocker via the mobile BFF `/api/reconciliation/wizard-override`
 * endpoint, not when they approve/reject a submitted recon.
 *
 * activity_trail destination carries `override=true` in `data` so the
 * audit table is queryable by override-class without parsing
 * `approval_notes` strings. Gate: `signoff.admin_override`
 * (seeded authority `suggest` per M4 closure migration).
 */
export interface ReconciliationAdminOverride extends BaseEvent {
  event: "reconciliation admin_override";
  properties: {
    entity: EntityRef;
    data: {
      reconciliation_id: string;
      session_id: string;
      override: true;
      gate_blocked: string[];
      reason: string;
      surface: "runtime_mobile" | "runtime_web";
    };
  };
}

export interface ReconciliationLocked extends BaseEvent {
  event: "reconciliation locked";
  properties: {
    entity: EntityRef;
    data: {
      reconciliation_id: string;
      reconciliation_date: string;
    };
  };
}

// ─── Handbook ───────────────────────────────────
export interface HandbookChapterSaved extends BaseEvent {
  event: "handbook chapter_saved";
  properties: {
    data: {
      chapter_key: string;
    };
  };
}

// ─── Communication ──────────────────────────────
export interface CommunicationSent extends BaseEvent {
  event: "communication sent";
  properties: {
    data: {
      communication_id: string;
      template: string;
      classification: string;
      recipient_count: number;
      sent_count: number;
      failed_count: number;
    };
  };
}

export interface CommunicationCancelled extends BaseEvent {
  event: "communication cancelled";
  properties: {
    data: {
      communication_id: string;
    };
  };
}

export interface CommunicationFailed extends BaseEvent {
  event: "communication failed";
  properties: {
    data: {
      communication_id: string;
      template: string;
      error: string;
    };
  };
}

// ─── Contract Events ──────────────────────────
export interface ContractCreated extends BaseEvent {
  event: "contract created";
  properties: {
    entity: EntityRef;
    data: {
      template_id: string;
      recipient_email: string;
      contract_type: string;
      /** True when admin edited the contract body in the preview editor before sending */
      was_edited?: boolean;
    };
  };
}

export interface ContractSent extends BaseEvent {
  event: "contract sent";
  properties: {
    entity: EntityRef;
    data: {
      recipient_email: string;
      expires_at: string;
    };
  };
}

export interface ContractViewed extends BaseEvent {
  event: "contract viewed";
  properties: {
    entity: EntityRef;
    data: {
      recipient_email?: string;
      /** Set when viewed in the send-drawer preview editor */
      template_id?: string;
      profile_id?: string;
    };
  };
}

export interface ContractSigned extends BaseEvent {
  event: "contract signed";
  properties: {
    entity: EntityRef;
    data: {
      recipient_email: string;
      signed_pdf_url?: string;
    };
  };
}

export interface ContractCancelled extends BaseEvent {
  event: "contract cancelled";
  properties: {
    entity: EntityRef;
    data: { reason?: string };
  };
}

export interface ContractDeclined extends BaseEvent {
  event: "contract declined";
  properties: {
    entity: EntityRef;
    data: { reason?: string };
  };
}

export interface ContractExpired extends BaseEvent {
  event: "contract expired";
  properties: {
    entity: EntityRef;
    data: { expired_at: string };
  };
}

// ─── Season & Budget Events ─────────────────────
export interface SeasonCreated extends BaseEvent {
  event: "season created";
  properties: {
    entity: EntityRef;
    data: {
      name: string;
      status: string;
      color?: string | null;
      planning_cycle_id?: string | null;
    };
  };
}

export interface SeasonBudgetUpdated extends BaseEvent {
  event: "season_budget updated";
  properties: {
    entity: EntityRef;
    data: { season_id: string; total_target_revenue?: number };
  };
}

export interface DayFactorsUpdated extends BaseEvent {
  event: "day_factors updated";
  properties: {
    data: { season_budget_id: string; count: number };
  };
}

export interface SeasonActivated extends BaseEvent {
  event: "season activated";
  properties: {
    entity: EntityRef;
    // NOTE (ADR-0200 §Telemetry): `departments_affected`, `rows_generated`,
    // `had_existing_hours` are optional in this pipelined registry-first
    // commit to preserve typecheck against the legacy client-side emit at
    // `packages/year-wheel/src/hooks/use-seasons.ts:211`. The M1 Server
    // Action commit removes that legacy emit (ADR-0200 line 104 cutover)
    // and tightens these fields to required. Registry-only stub per L-0083
    // pipelining exception (same PR campaign branch).
    data: {
      status: "active";
      departments_affected?: number;
      rows_generated?: number;
      had_existing_hours?: boolean;
    };
  };
}

export interface SeasonOperatingHoursGenerated extends BaseEvent {
  event: "season operating_hours_generated";
  properties: {
    entity: EntityRef;
    data: {
      departments_affected: number;
      // `rows_generated` — total department_operating_hours rows for
      // this season_id AFTER the trigger ran. Kept for backwards
      // compatibility with existing dashboards; NOT load-bearing for
      // the phantom-emit guard (see M5.2 / ADR-0196 Invariant 11).
      rows_generated: number;
      // `rows_newly_inserted` — authoritative delta (post-trigger
      // count minus pre-trigger count) from activate_season() per
      // the 20260518040001 migration. This is the signal the Server
      // Action uses to decide whether to emit at all: the event is
      // suppressed when rows_newly_inserted === 0 (re-activation of
      // a previously-archived season where the trigger's NOT EXISTS
      // guard short-circuited). Always > 0 on the wire.
      rows_newly_inserted: number;
      source: "auto_copy_on_activate_trigger";
    };
  };
}

export interface SeasonActivationFailed extends BaseEvent {
  event: "season activation_failed";
  properties: {
    entity: EntityRef;
    data: {
      reason: "missing_budget" | "missing_day_factors" | "missing_hour_factors" | "rpc_error";
    };
  };
}

export interface SeasonActivationPreviewed extends BaseEvent {
  event: "season activation_preview";
  properties: {
    entity: EntityRef;
    data: {
      departments_count: number;
      existing_hours_rows: number;
      would_generate: number;
    };
  };
}

export interface SeasonArchived extends BaseEvent {
  event: "season archived";
  properties: {
    entity: EntityRef;
    data: { status: "archived" };
  };
}

export interface SeasonUpdated extends BaseEvent {
  event: "season updated";
  properties: {
    entity: EntityRef;
    data: {
      start_date: string | null;
      end_date: string | null;
      source?: string;
    };
  };
}

export interface SeasonOperatingHoursCopied extends BaseEvent {
  event: "season operating_hours_copied";
  properties: {
    entity: EntityRef;
    data: { rows_copied: number };
  };
}

export interface SeasonOperatingHoursUpdated extends BaseEvent {
  event: "season operating_hours_updated";
  properties: {
    entity: EntityRef;
    data: Record<string, never>;
  };
}

export interface SeasonOperatingHoursRemoved extends BaseEvent {
  event: "season operating_hours_removed";
  properties: {
    entity: EntityRef;
    data: Record<string, never>;
  };
}

export interface SeasonGoalCreated extends BaseEvent {
  event: "season_goal created";
  properties: {
    entity: EntityRef;
    data: { title: string; season_id: string };
  };
}

export interface SeasonGoalUpdated extends BaseEvent {
  event: "season_goal updated";
  properties: {
    entity: EntityRef;
    data: { status?: string };
  };
}

export interface SeasonGoalDeleted extends BaseEvent {
  event: "season_goal deleted";
  properties: {
    entity: EntityRef;
  };
}

export interface SeasonPolicyBindingUpdated extends BaseEvent {
  event: "season_policy_binding updated";
  properties: {
    entity: EntityRef;
    data: { policy_id: string; is_active: boolean };
  };
}

export interface PlanningCycleActivated extends BaseEvent {
  event: "planning_cycle activated";
  properties: {
    entity: EntityRef;
    data: { status: "active" };
  };
}

export interface PlanningCycleArchived extends BaseEvent {
  event: "planning_cycle archived";
  properties: {
    entity: EntityRef;
    data: { status: "archived" };
  };
}

export interface YearWheelBlockClicked extends BaseEvent {
  event: "season block_clicked";
  properties: {
    entity: EntityRef;
    data: { season_name: string; year: number };
  };
}

export interface YearWheelPinClicked extends BaseEvent {
  event: "season pin_clicked";
  properties: {
    entity: EntityRef;
    data: { event_name: string; year: number };
  };
}

export interface YearWheelYearNavigated extends BaseEvent {
  event: "season year_navigated";
  properties: {
    data: { from_year: number; to_year: number; direction: "forward" | "backward" };
  };
}

// ─── Year-Wheel Canvas Events (redesign, ADR-0164) ──────────
// Dual-registered per L-0072: interface + runtime EVENT_ROUTING entry.
// All six use the "season " prefix (domain not widget) so any future
// non-wheel surface that wants to observe draw/filter/view activity
// subscribes to the same stream.

export interface SeasonDrawStarted extends BaseEvent {
  event: "season draw_started";
  properties: {
    data: { year: number; lane: number };
  };
}

export interface SeasonDrawCompleted extends BaseEvent {
  event: "season draw_completed";
  properties: {
    data: { start: string; end: string; lane: number };
  };
}

export interface SeasonDrawCancelled extends BaseEvent {
  event: "season draw_cancelled";
  properties: {
    data: { reason: "short_drag" | "esc" | "mouse_exit" | "sheet_abandoned" };
  };
}

export interface SeasonSidebarFilterChanged extends BaseEvent {
  event: "season sidebar_filter_changed";
  properties: {
    data: { filter: "all" | "active" | "draft" | "archived" };
  };
}

export interface SeasonYearWheelViewed extends BaseEvent {
  event: "season year_wheel_viewed";
  properties: {
    data: { year: number; seasons_count: number };
  };
}

export interface SeasonTabChanged extends BaseEvent {
  event: "season tab_changed";
  properties: {
    entity: EntityRef;
    data: { from: string; to: string };
  };
}

export interface HourFactorsUpdated extends BaseEvent {
  event: "hour_factors updated";
  properties: {
    data: { season_budget_id: string; count: number };
  };
}

export interface OperatingHoursUpdated extends BaseEvent {
  event: "operating_hours updated";
  properties: {
    data: { location_id?: string };
  };
}

export interface WorkspaceOperatingHoursUpdated extends BaseEvent {
  event: "workspace_operating_hours updated";
  properties: {
    data: Record<string, never>;
  };
}

export interface ChangeProposalApproved extends BaseEvent {
  event: "change_proposal approved";
  properties: {
    data: {
      proposal_id: string;
    };
  };
}

export interface ChangeProposalRejected extends BaseEvent {
  event: "change_proposal rejected";
  properties: {
    data: {
      proposal_id: string;
    };
  };
}

export interface WorkspaceSettingsUpdated extends BaseEvent {
  event: "workspace_settings updated";
  properties: {
    data: { section: string };
  };
}

export interface KpiTargetUpdated extends BaseEvent {
  event: "kpi_target updated";
  properties: {
    data: { metric: string; value: number };
  };
}

export interface WorkspaceBudgetUpdated extends BaseEvent {
  event: "workspace_budget updated";
  properties: {
    data: { period_type: string; period_date: string };
  };
}

// ─── Schedule: Absences, Roster, Open Shifts, Templates, Day Content ──
export interface AbsenceCreated extends BaseEvent {
  event: "absence created";
  properties: {
    entity: EntityRef;
    data: { profile_id: string; start_date: string; end_date: string };
  };
}

export interface AbsenceDeleted extends BaseEvent {
  event: "absence deleted";
  properties: {
    entity: EntityRef;
    data: { profile_id: string };
  };
}

export interface AbsenceApproved extends BaseEvent {
  event: "absence approved";
  properties: {
    entity: EntityRef;
    data: { profile_id: string; approved_by: string; start_date: string; end_date: string };
  };
}

export interface AbsenceRejected extends BaseEvent {
  event: "absence rejected";
  properties: {
    entity: EntityRef;
    data: { profile_id: string; rejected_by: string; reason?: string };
  };
}

export interface AbsenceRequested extends BaseEvent {
  event: "absence requested";
  properties: {
    entity: EntityRef;
    data: { absence_type: string; start_date: string; end_date: string };
  };
}

export interface AbsenceCancelled extends BaseEvent {
  event: "absence cancelled";
  properties: {
    entity: EntityRef;
    data: { absence_id: string };
  };
}

// ─── Scheduling: Hours Confirmation ─────────────────
export interface ShiftHoursConfirmed extends BaseEvent {
  event: "shift hours_confirmed";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: { shift_id: string; status: "approved" | "disputed" };
  };
}

// ─── Scheduling: Lifecycle Capability (ADR-0095) ────
// Emitted by packages/ai/src/capabilities/shift-lifecycle/ tools.
// These events observe agent-initiated lifecycle operations so that
// the unified gate (ADR-0099) and downstream processes can audit them.
// FLAT entity contract per engine-event dispatch (BREAK 1 fix).
export interface ShiftLifecyclePublished extends BaseEvent {
  event: "shift_lifecycle published";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: { shift_id: string; gate_allowed: boolean; reason?: string };
  };
}
export interface ShiftLifecycleApproved extends BaseEvent {
  event: "shift_lifecycle approved";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: {
      shift_id: string;
      approval_id?: string;
      approved_hours?: number;
      four_eyes_pending?: boolean;
      gate_allowed: boolean;
      reason?: string;
    };
  };
}
export interface ShiftLifecycleInterpreted extends BaseEvent {
  event: "shift_lifecycle interpreted";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: { shift_id: string; interpretation_id?: string };
  };
}
export interface ShiftLifecycleSettled extends BaseEvent {
  event: "shift_lifecycle settled";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: { shift_id: string; snapshot_id?: string; idempotent_hit: boolean };
  };
}

// Deviation-Botsson bridge (Phase 6.4, Council 6.4 2026-04-15).
// `opened` fires when the mobile shift timeline successfully stages an
// intent into BotssonProvider.openWithIntent. `refused` fires when the
// bridge is blocked — either by the ADR-0078 voice interlock or the
// offline UX — so we can monitor how often the guard triggers.
export interface ShiftLifecycleDeviationBridgeOpened extends BaseEvent {
  event: "shift_lifecycle deviation_bridge_opened";
  properties: {
    data: {
      shift_id: string;
      phase: string;
      has_deviation_id: boolean;
    };
  };
}
export interface ShiftLifecycleDeviationBridgeRefused extends BaseEvent {
  event: "shift_lifecycle deviation_bridge_refused";
  properties: {
    data: {
      shift_id: string;
      reason: "voice_active" | "offline";
      phase?: string;
    };
  };
}

// ─── HACCP: Temperature Logging ─────────────────────
export interface HaccpLogged extends BaseEvent {
  event: "haccp logged";
  properties: {
    entity: EntityRef;
    data: { task_type: string; logged_at: string };
  };
}

// ─── Operations: Handoff ────────────────────────────
export interface HandoffSubmitted extends BaseEvent {
  event: "handoff submitted";
  properties: {
    entity: EntityRef;
    data: { session_id: string };
  };
}

// ─── Chat: Direct Messages ──────────────────────────
export interface ChatMessageSent extends BaseEvent {
  event: "chat message_sent";
  properties: {
    data: { channel_id: string; has_attachments: boolean };
  };
}

// ─── Chat: Channel Messages ─────────────────────────
export interface ChatChannelMessageSent extends BaseEvent {
  event: "chat channel_message_sent";
  properties: {
    data: { channel_id: string };
  };
}

export interface RosterCreated extends BaseEvent {
  event: "roster created";
  properties: {
    data: { department_id: string };
  };
}

export interface RosterUpdated extends BaseEvent {
  event: "roster updated";
  properties: {
    data: { department_id: string };
  };
}

export interface RosterDeleted extends BaseEvent {
  event: "roster deleted";
  properties: {
    data: { roster_id: string };
  };
}

export interface OpenShiftCreated extends BaseEvent {
  event: "open_shift created";
  properties: {
    entity: EntityRef;
    data: { date: string; department_id: string };
  };
}

export interface OpenShiftAssigned extends BaseEvent {
  event: "open_shift assigned";
  properties: {
    entity: EntityRef;
    data: { assigned_to: string };
  };
}

export interface OpenShiftDeleted extends BaseEvent {
  event: "open_shift deleted";
  properties: {
    entity: EntityRef;
    data: Record<string, never>;
  };
}

export interface TemplateCreated extends BaseEvent {
  event: "template created";
  properties: {
    entity: EntityRef;
    data: { name: string; shift_count: number };
  };
}

export interface TemplateUpdated extends BaseEvent {
  event: "template updated";
  properties: {
    entity: EntityRef;
    data: { name: string };
  };
}

export interface TemplateDeleted extends BaseEvent {
  event: "template deleted";
  properties: {
    entity: EntityRef;
    data: Record<string, never>;
  };
}

export interface TemplateBindingCreated extends BaseEvent {
  event: "template_binding created";
  properties: {
    entity: EntityRef;
    data: { template_id: string; employment_category: string; employee_group_id: string | null };
  };
}

export interface TemplateBindingUpdated extends BaseEvent {
  event: "template_binding updated";
  properties: {
    entity: EntityRef;
    data: {
      template_id?: string;
      employment_category: string;
      employee_group_id: string | null;
      is_active?: boolean;
      priority?: number;
    };
  };
}

export interface TemplateBindingDeleted extends BaseEvent {
  event: "template_binding deleted";
  properties: {
    entity: EntityRef;
    data: { template_id: string; employment_category: string; employee_group_id: string | null };
  };
}

export interface ContractTemplateCopied extends BaseEvent {
  event: "contract_template copied";
  properties: {
    entity: EntityRef;
    data: { source_template_id: string; name: string };
  };
}

// ─── Contract Hub Redesign (Council 2026-04-22 Gate G2) ──────────
// 10 events: 5 template lifecycle + 3 hub UI + 2 drift.
//
// Naming convention split is intentional and matches council spec:
//   • Template lifecycle uses space-separated names to match the existing
//     `contract_template copied` / `template_binding *` events. These are
//     DB-mutation lifecycle events in the same family.
//   • Hub UI + drift events use the dot convention (`contract.*` /
//     `contract_template.*`) to match the newer `helpdesk.*` / `channel.*`
//     pattern for domain.surface.verb — these are view/UX events, not
//     lifecycle mutations.
//
// All 10 route to all 4 destinations (posthog, logger, activity_trail,
// engine_event) so Event Engine consumers can react to drift chips,
// deprecations, and template forks without a parallel event stream.

// ─── Template lifecycle (5) ──────────────────────────────────────
export interface ContractTemplateForked extends BaseEvent {
  event: "contract_template forked";
  properties: {
    entity: EntityRef;
    data: {
      source_template_id: string;
      source_scope: "system" | "workspace";
      name: string;
    };
  };
}

export interface ContractTemplateCreated extends BaseEvent {
  event: "contract_template created";
  properties: {
    entity: EntityRef;
    data: {
      source_scope: "blank";
      name: string;
    };
  };
}

export interface ContractTemplateClauseUpdated extends BaseEvent {
  event: "contract_template clause_updated";
  properties: {
    entity: EntityRef;
    data: {
      clause_id: string;
      clause_key: string | null;
      previous_version_hash: string | null;
      new_version_hash: string;
    };
  };
}

export interface ContractTemplatePublished extends BaseEvent {
  event: "contract_template published";
  properties: {
    entity: EntityRef;
    data: {
      name: string;
      published_at: string;
      is_reactivation: boolean;
    };
  };
}

export interface ContractTemplateUnpublished extends BaseEvent {
  event: "contract_template unpublished";
  properties: {
    entity: EntityRef;
    data: {
      published_at: null;
    };
  };
}

export interface ContractTemplateRenamed extends BaseEvent {
  event: "contract_template renamed";
  properties: {
    entity: EntityRef;
    data: {
      from: string;
      to: string;
    };
  };
}

export interface ContractTemplateDeprecated extends BaseEvent {
  event: "contract_template deprecated";
  properties: {
    entity: EntityRef;
    data: {
      name: string;
      deprecated_at: string;
      replacement_template_id: string | null;
    };
  };
}

export interface ContractTemplateDeleted extends BaseEvent {
  event: "contract_template deleted";
  properties: {
    entity: EntityRef;
    data: {
      name: string;
      // Hard-delete is only permitted when zero contracts reference the
      // template — captured here as an invariant confirmation.
      referenced_contract_count: 0;
    };
  };
}

// ─── Hub UI (3) ──────────────────────────────────────────────────
// UX events — entity is the workspace itself since these fire against
// the contracts hub surface, not a specific row. writeActivityTrail
// requires entity to persist; skipping it silently drops the event.
export interface ContractHubViewed extends BaseEvent {
  event: "contract.hub_viewed";
  properties: {
    entity: EntityRef;
    data: {
      initial_tab: string;
    };
  };
}

export interface ContractTabSwitched extends BaseEvent {
  event: "contract.tab_switched";
  properties: {
    entity: EntityRef;
    data: {
      from: string;
      to: string;
    };
  };
}

export interface ContractBotssonChipInvoked extends BaseEvent {
  event: "contract.botsson_chip_invoked";
  properties: {
    entity: EntityRef;
    data: {
      // Hub surface the chip was invoked from (e.g. "overview", "templates",
      // "bindings") so we can see which sub-surface drives Botsson engagement.
      surface: string;
    };
  };
}

// ─── Bulk Send (1) ───────────────────────────────────────────────
// Batch-level event emitted once at the start of a bulk-send run, BEFORE the
// per-profile fan-out fires `contract created` / `contract sent`. Lets
// downstream consumers correlate the per-contract events back to a single
// admin action via batch_id. Entity is the workspace itself (the hub surface),
// matching the ContractHubViewed pattern — there is no single contract entity
// for the batch as a whole. Required for C4 audit completeness alongside the
// gate_action call at the same code site (Council Gate 4 R2 — Fix #4).
export interface ContractBulkSendInitiated extends BaseEvent {
  event: "contract.bulk_send_initiated";
  properties: {
    entity: EntityRef;
    data: {
      batch_id: string;
      template_id: string;
      profile_count: number;
    };
  };
}

// ─── Compose Opened (1) ──────────────────────────────────────────
// Emitted when the admin opens the CompositionDrawer from any entry point.
// `source` identifies the trigger so we can distinguish hub CTA from
// reverse-flow deep-links (?open=compose&profileId=…).
export interface ContractComposeOpened extends BaseEvent {
  event: "contracts.compose.opened";
  properties: {
    entity: EntityRef;
    data: {
      source: string;
    };
  };
}

// ─── Compose Submitted (2) ───────────────────────────────────────
// Emitted when the admin successfully submits the CompositionDrawer
// (persist=true). Dot-notation replacement for legacy "contract composed".
export interface ContractComposeSubmitted extends BaseEvent {
  event: "contracts.compose.submitted";
  properties: {
    entity: EntityRef;
    data: {
      profile_id: string;
      template_id?: string;
      employment_category?: string;
      employment_percentage?: number;
      framework_id?: string;
      override_count?: number;
      blocker_count?: number;
    };
  };
}

// ─── Drift (2) ───────────────────────────────────────────────────
export interface ContractTemplateDriftViewed extends BaseEvent {
  event: "contract_template.drift_viewed";
  properties: {
    entity: EntityRef;
    data: {
      drift_event_id: string;
      drift_type: string;
    };
  };
}

export interface ContractTemplateDriftDismissed extends BaseEvent {
  event: "contract_template.drift_dismissed";
  properties: {
    entity: EntityRef;
    data: {
      drift_event_id: string;
      drift_type: string;
      // Seconds the drift drawer was open before dismissal — signal for
      // whether admins are reading drift context or reflex-closing.
      view_duration_ms: number;
    };
  };
}

// ─── Maler Tab UI events (MalerTab.tsx) ──────────────────────────
// Emitted from the workspace template management surface.
export interface ContractTemplateViewed extends BaseEvent {
  event: "contracts.template.viewed";
  properties: {
    entity: EntityRef;
    data: {
      template_id: string;
      framework_id: string | null;
      version: number | null;
      has_drift: boolean;
    };
  };
}

export interface ContractTemplateHtmlCopied extends BaseEvent {
  event: "contracts.template.html_copied";
  properties: {
    entity: EntityRef;
    data: {
      template_id: string;
      source: "maler_tab";
    };
  };
}

export interface ContractTemplateOpenedInAdmin extends BaseEvent {
  event: "contracts.template.opened_in_admin";
  properties: {
    entity: EntityRef;
    data: {
      template_id: string;
    };
  };
}

export interface ContractTemplateCloned extends BaseEvent {
  event: "contracts.template.cloned";
  properties: {
    entity: EntityRef;
    data: {
      source_template_id: string;
      new_template_id: string;
    };
  };
}

// ─── Contract Data-Table events (contracts-data-table.tsx) ──────────────────
// Emitted from the admin contracts overview table for row-level interactions:
// resend, cancel flow (dialog_opened → confirmed | aborted | failed), and
// detail sheet open. Separate from the legacy "contract cancelled" engine event
// which fires on the API side — these are UI-layer audit signals.

export interface ContractResendSubmitted extends BaseEvent {
  event: "contracts.resend.submitted";
  properties: {
    entity: EntityRef;
    data: {
      contract_id: string;
      employee_id: string;
    };
  };
}

export interface ContractCancelDialogOpened extends BaseEvent {
  event: "contracts.cancel.dialog_opened";
  properties: {
    entity: EntityRef;
    data: {
      contract_id: string;
      source: "table_dropdown" | "detail_sheet";
      contract_status: string;
    };
  };
}

export interface ContractCancelConfirmed extends BaseEvent {
  event: "contracts.cancel.confirmed";
  properties: {
    entity: EntityRef;
    data: {
      contract_id: string;
      employee_id: string;
      was_sent: boolean;
    };
  };
}

export interface ContractCancelAborted extends BaseEvent {
  event: "contracts.cancel.aborted";
  properties: {
    entity: EntityRef;
    data: {
      contract_id: string;
      reason: "user_cancelled";
    };
  };
}

export interface ContractCancelFailed extends BaseEvent {
  event: "contracts.cancel.failed";
  properties: {
    entity: EntityRef;
    data: {
      contract_id: string;
      error_code: string;
    };
  };
}

export interface ContractDetailViewed extends BaseEvent {
  event: "contracts.detail.viewed";
  properties: {
    entity: EntityRef;
    data: {
      contract_id: string;
      status: string;
    };
  };
}

export interface ContractDeleteDialogOpened extends BaseEvent {
  event: "contracts.delete.dialog_opened";
  properties: {
    entity: EntityRef;
    data: {
      contract_id: string;
      contract_status: string;
    };
  };
}

export interface ContractDeleteConfirmed extends BaseEvent {
  event: "contracts.delete.confirmed";
  properties: {
    entity: EntityRef;
    data: {
      contract_id: string;
      employee_id: string;
      prior_status: string;
    };
  };
}

// ─── Contract Send / Bulk Submit (Fix 9 telemetry holes) ────────────────────
// contracts.send.submitted — fired after the two-step raw fetch in
// contract-send-drawer (create + send) both succeed.
export interface ContractSendSubmitted extends BaseEvent {
  event: "contracts.send.submitted";
  properties: {
    entity: EntityRef;
    data: {
      contract_id: string;
      template_id: string;
    };
  };
}

// contracts.bulk.submitted — fired after BulkSendDrawer /api/employment-contracts/bulk
// returns successfully. Complements the existing contract.bulk_send_initiated
// (which fires at the START of the batch); this fires at completion.
export interface ContractBulkSubmitted extends BaseEvent {
  event: "contracts.bulk.submitted";
  properties: {
    entity: EntityRef;
    data: {
      template_id: string;
      recipient_count: number;
      success_count: number;
      fail_count: number;
    };
  };
}

// ─── Unsaved-Changes Guard (Fix 9) ─────────────────────────────────────────
// Three lifecycle events: shown (guard dialog opens), discarded (user confirms
// discard), kept (user clicks "Fortsett å redigere" — guard closes, drawer stays).
export interface FormsUnsavedGuardShown extends BaseEvent {
  event: "forms.unsaved_guard.shown";
  properties: {
    entity: EntityRef;
    data: {
      form: "contract_send_drawer" | "composition_drawer" | "bulk_send_drawer";
    };
  };
}

export interface FormsUnsavedGuardDiscarded extends BaseEvent {
  event: "forms.unsaved_guard.discarded";
  properties: {
    entity: EntityRef;
    data: {
      form: "contract_send_drawer" | "composition_drawer" | "bulk_send_drawer";
    };
  };
}

export interface FormsUnsavedGuardKept extends BaseEvent {
  event: "forms.unsaved_guard.kept";
  properties: {
    entity: EntityRef;
    data: {
      form: "contract_send_drawer" | "composition_drawer" | "bulk_send_drawer";
    };
  };
}

export interface TemplateLoaded extends BaseEvent {
  event: "template loaded";
  properties: {
    entity: EntityRef;
    data: { shift_count: number };
  };
}

export interface TemplateApplied extends BaseEvent {
  event: "template applied";
  properties: {
    entity: EntityRef;
    data: { shift_count: number; week_start: string };
  };
}

export interface WeekReset extends BaseEvent {
  event: "week reset";
  properties: {
    entity: EntityRef;
    data: { shift_count: number; week_start: string };
  };
}

export interface TemplateShiftCreated extends BaseEvent {
  event: "template_shift created";
  properties: {
    entity_type: "template_shift";
    entity_id: string;
    data: { role: string; start_time: string; end_time: string };
  };
}

export interface ShiftAssigned extends BaseEvent {
  event: "shift assigned";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: { employee_id: string };
  };
}

export interface ShiftUnassigned extends BaseEvent {
  event: "shift unassigned";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: { employee_id: string };
  };
}

export interface ShiftTypeConfigCreated extends BaseEvent {
  event: "shift_type_config created";
  properties: {
    entity: EntityRef;
    data: {
      department_id: string;
      shift_type_id: string;
      label: string;
      start_time: string;
      end_time: string;
      slot_count: number;
    };
  };
}

export interface ShiftTypeConfigUpdated extends BaseEvent {
  event: "shift_type_config updated";
  properties: {
    entity: EntityRef;
    data: {
      department_id: string;
      shift_type_id: string;
      changes: Record<string, unknown>;
    };
  };
}

export interface ShiftTypeConfigRemoved extends BaseEvent {
  event: "shift_type_config removed";
  properties: {
    entity: EntityRef;
    data: {
      department_id: string;
      shift_type_id: string;
      label: string;
    };
  };
}

export interface DayInfoCreated extends BaseEvent {
  event: "day_info created";
  properties: {
    data: { date: string; category: string };
  };
}

export interface DayInfoUpdated extends BaseEvent {
  event: "day_info updated";
  properties: {
    data: { date: string; category: string };
  };
}

export interface DayInfoDeleted extends BaseEvent {
  event: "day_info deleted";
  properties: {
    data: { day_info_id: string };
  };
}

// ─── Guardian Events ────────────────────────────
export interface GuardianSignalAcknowledged extends BaseEvent {
  event: "guardian_signal acknowledged";
  properties: {
    data: { signal_id: string; note?: string };
  };
}

export interface GuardianSignalDismissed extends BaseEvent {
  event: "guardian_signal dismissed";
  properties: {
    data: { signal_id: string };
  };
}

// ─── Leader Pulse Events ────────────────────────
export interface LeaderPulseAnswered extends BaseEvent {
  event: "leader_pulse answered";
  properties: {
    data: { pulse_id: string };
  };
}

export interface LeaderPulseDismissed extends BaseEvent {
  event: "leader_pulse dismissed";
  properties: {
    data: { pulse_id: string };
  };
}

// ─── Chat Events ────────────────────────────────
export interface ConversationCreated extends BaseEvent {
  event: "conversation created";
  properties: {
    data: { conversation_id: string; type: string };
  };
}

export interface MessageSent extends BaseEvent {
  event: "message sent";
  properties: {
    data: { conversation_id: string };
  };
}

// ─── Financial Close Config Events ───────────────
export interface FinancialCloseConfigUpdated extends BaseEvent {
  event: "financial_close_config updated";
  properties: {
    data: Record<string, unknown>;
  };
}

// ─── Payroll Settings Events ─────────────────────
export interface PayrollSettingsUpdated extends BaseEvent {
  event: "payroll_settings updated";
  properties: {
    data: {
      period_type: string;
      shift_grouping: string;
    };
  };
}

// ─── Security Settings Events ────────────────────
export interface ShiftLockPolicyUpdated extends BaseEvent {
  event: "shift_lock_policy updated";
  properties: {
    data: {
      lock_mode: "enforce" | "shadow" | "off";
    };
  };
}

// ─── Team Events ────────────────────────────────
export interface TeamCreated extends BaseEvent {
  event: "team created";
  properties: {
    entity: EntityRef;
    data: {
      team_id: string;
      name: string;
      team_type?: string;
      department_id?: string | null;
    };
  };
}

export interface TeamDeleted extends BaseEvent {
  event: "team deleted";
  properties: {
    entity: EntityRef;
    data: {
      team_id: string;
      name: string;
    };
  };
}

// ─── Salary Code Events ──────────────────────────
export interface SalaryCodeCreated extends BaseEvent {
  event: "salary_code created";
  properties: {
    data: {
      code: string;
      category: string;
    };
  };
}

export interface SalaryCodeUpdated extends BaseEvent {
  event: "salary_code updated";
  properties: {
    data: {
      salary_code_id: string;
      code: string;
    };
  };
}

export interface SalaryCodeDeleted extends BaseEvent {
  event: "salary_code deleted";
  properties: {
    data: {
      salary_code_id: string;
      code: string;
    };
  };
}

// ─── Employee Group Events ────────────────────────
export interface EmployeeGroupCreated extends BaseEvent {
  event: "employee_group created";
  properties: {
    data: {
      employee_group_id: string;
      name: string;
    };
  };
}

export interface EmployeeGroupUpdated extends BaseEvent {
  event: "employee_group updated";
  properties: {
    data: {
      employee_group_id: string;
      name: string;
    };
  };
}

export interface EmployeeGroupDeleted extends BaseEvent {
  event: "employee_group deleted";
  properties: {
    data: {
      employee_group_id: string;
      name: string;
    };
  };
}

export interface GroupMemberAdded extends BaseEvent {
  event: "group_member added";
  properties: {
    data: {
      employee_group_id: string;
      profile_id: string;
    };
  };
}

export interface GroupMemberUpdated extends BaseEvent {
  event: "group_member updated";
  properties: {
    data: {
      employee_group_id: string;
      profile_id: string;
    };
  };
}

export interface GroupMemberRemoved extends BaseEvent {
  event: "group_member removed";
  properties: {
    data: {
      employee_group_id: string;
      profile_id: string;
    };
  };
}

// ─── Shift Type Events ───────────────────────────
export interface ShiftTypeCreated extends BaseEvent {
  event: "shift_type created";
  properties: {
    data: {
      name: string;
      rate_adjustment_type: string;
    };
  };
}

export interface ShiftTypeUpdated extends BaseEvent {
  event: "shift_type updated";
  properties: {
    data: {
      shift_type_id: string;
      name: string;
    };
  };
}

export interface ShiftTypeDeleted extends BaseEvent {
  event: "shift_type deleted";
  properties: {
    data: {
      shift_type_id: string;
      name: string;
    };
  };
}

// ─── Supplement Rule Events ──────────────────────
export interface SupplementRuleCreated extends BaseEvent {
  event: "supplement_rule created";
  properties: {
    data: {
      name: string;
      supplement_type: string;
    };
  };
}

export interface SupplementRuleUpdated extends BaseEvent {
  event: "supplement_rule updated";
  properties: {
    data: {
      supplement_rule_id: string;
      name: string;
      supplement_type: string;
    };
  };
}

export interface SupplementRuleDeleted extends BaseEvent {
  event: "supplement_rule deleted";
  properties: {
    data: {
      supplement_rule_id: string;
      name: string;
    };
  };
}

// ─── Break Rule Events ──────────────────────────
export interface BreakRuleCreated extends BaseEvent {
  event: "break_rule created";
  properties: {
    data: {
      name: string;
      trigger_type: string;
    };
  };
}

export interface BreakRuleUpdated extends BaseEvent {
  event: "break_rule updated";
  properties: {
    data: {
      break_rule_id: string;
      name: string;
    };
  };
}

export interface BreakRuleDeleted extends BaseEvent {
  event: "break_rule deleted";
  properties: {
    data: {
      break_rule_id: string;
      name: string;
    };
  };
}

// ─── Working Time Rules Events ──────────────────
export interface WorkingTimeRulesUpdated extends BaseEvent {
  event: "working_time_rules updated";
  properties: {
    data: {
      rule_codes: string[];
      active_count: number;
    };
  };
}

// ─── Holiday Calendar Events ─────────────────────
export interface HolidayCalendarCreated extends BaseEvent {
  event: "holiday_calendar created";
  properties: {
    data: {
      calendar_id: string;
      name: string;
    };
  };
}

export interface HolidayCalendarUpdated extends BaseEvent {
  event: "holiday_calendar updated";
  properties: {
    data: {
      calendar_id: string;
      name: string;
    };
  };
}

export interface HolidayCalendarDeleted extends BaseEvent {
  event: "holiday_calendar deleted";
  properties: {
    data: {
      calendar_id: string;
      name: string;
    };
  };
}

export interface HolidayEntryCreated extends BaseEvent {
  event: "holiday_entry created";
  properties: {
    data: {
      calendar_id: string;
    };
  };
}

export interface HolidayEntryUpdated extends BaseEvent {
  event: "holiday_entry updated";
  properties: {
    data: {
      calendar_id: string;
    };
  };
}

export interface HolidayEntryDeleted extends BaseEvent {
  event: "holiday_entry deleted";
  properties: {
    data: {
      calendar_id: string;
    };
  };
}

export interface HolidaysImported extends BaseEvent {
  event: "holidays imported";
  properties: {
    data: {
      calendar_id: string;
      count: number;
      inserted: number;
    };
  };
}

// ─── Meal Rule Events ────────────────────────────
export interface MealRuleCreated extends BaseEvent {
  event: "meal_rule created";
  properties: {
    data: {
      meal_rule_id: string;
      name: string;
      meal_type: string;
    };
  };
}

export interface MealRuleUpdated extends BaseEvent {
  event: "meal_rule updated";
  properties: {
    data: {
      meal_rule_id: string;
      name: string;
    };
  };
}

export interface MealRuleDeleted extends BaseEvent {
  event: "meal_rule deleted";
  properties: {
    data: {
      meal_rule_id: string;
      name: string;
    };
  };
}

// ─── AI / Authority Config Events ───────────────
export interface AuthorityConfigUpdated extends BaseEvent {
  event: "authority_config updated";
  properties: {
    data: { capability: string; level: string };
  };
}

// ─── Onboarding Guide Events ────────────────────
export interface OnboardingGuideUpdated extends BaseEvent {
  event: "onboarding_guide updated";
  properties: {
    data: { step: string; is_complete: boolean };
  };
}

export interface SetupGuideCompleted extends BaseEvent {
  event: "setup_guide completed";
  properties: Record<string, never>;
}

// ─── Industry Package Events ────────────────────
export interface IndustryPackageLoaded extends BaseEvent {
  event: "industry_package loaded";
  properties: {
    data: { industry: string };
  };
}

// ─── Contract Attachment Events ─────────────────
export interface ContractAttachmentUploaded extends BaseEvent {
  event: "contract attachment uploaded";
  properties: {
    entity: EntityRef;
    data: { contract_id: string; mime_type: string; file_size: number };
  };
}

export interface ContractAttachmentDeleted extends BaseEvent {
  event: "contract attachment deleted";
  properties: {
    entity: EntityRef;
    data: { contract_id: string };
  };
}

// ─── Contract Composition Events ─────────────────
export interface ContractComposed extends BaseEvent {
  event: "contract composed";
  properties: {
    entity: EntityRef;
    data: {
      template_id: string;
      profile_id: string;
      framework_id: string;
      override_count: number;
      blocker_count: number;
    };
  };
}

export interface ContractComplianceBlocked extends BaseEvent {
  event: "contract compliance blocked";
  properties: {
    entity: EntityRef;
    data: { rule_id: string; rule_type: string; violation: string };
  };
}

export interface ContractComplianceOverridden extends BaseEvent {
  event: "contract compliance overridden";
  properties: {
    entity: EntityRef;
    data: {
      rule_id: string;
      field: string;
      expected_value: string;
      actual_value: string;
    };
  };
}

export interface ContractIntakeStarted extends BaseEvent {
  event: "contract intake started";
  properties: {
    entity: EntityRef;
    data: { contract_id: string; missing_groups: string[] };
  };
}

export interface ContractIntakeFieldSubmitted extends BaseEvent {
  event: "contract intake field submitted";
  properties: {
    entity: EntityRef;
    data: { group: string };
  };
}

export interface ContractIntakeCompleted extends BaseEvent {
  event: "contract intake completed";
  properties: {
    entity: EntityRef;
    data: { contract_id: string; duration_hours: number };
  };
}

export interface ContractIntakeEscalated extends BaseEvent {
  event: "contract intake escalated";
  properties: {
    entity: EntityRef;
    data: { contract_id: string; escalation_day: number };
  };
}

export interface ContractIntakeAdminBypass extends BaseEvent {
  event: "contract intake admin bypass";
  properties: {
    entity: EntityRef;
    data: { field_group: string; reason: string };
  };
}

export interface ContractIntakeDeclined extends BaseEvent {
  event: "contract intake declined";
  properties: {
    entity: EntityRef;
    data: { group: string; reason_code: string };
  };
}

export interface ContractFrameworkDriftDetected extends BaseEvent {
  event: "contract framework drift detected";
  properties: {
    entity: EntityRef;
    data: { drift_count: number; framework_id: string };
  };
}

export interface ContractRegenerated extends BaseEvent {
  event: "contract regenerated";
  properties: {
    entity: EntityRef;
    data: { framework_id: string; previous_snapshot_date: string };
  };
}

export interface ContractRevisionCreated extends BaseEvent {
  event: "contract revision created";
  properties: {
    entity: EntityRef;
    data: { parent_contract_id: string; revision_number: number };
  };
}

export interface ContractRetentionArchived extends BaseEvent {
  event: "contract retention archived";
  properties: {
    entity: EntityRef;
    data: { anonymized_fields: string[] };
  };
}

// ─── Pricing Terms Events ──────────────────────────
// NOTE: legacy event for contract-level pricing edits. The billing engine
// (ADR-0118 / ADR-0125) emits a SIBLING event `pricing_terms updated` with
// an underscore — see `BillingPricingTermsUpdated` near the Billing Events
// block. Two distinct events, two distinct routing destinations. Do not
// consolidate without a migration plan for both call-sites.
export interface PricingTermsUpdated extends BaseEvent {
  event: "pricing terms updated";
  properties: {
    entity: EntityRef;
    data: {
      action: "created" | "updated";
      fields?: string[];
    };
  };
}

// ─── Journey: Signup + Onboarding ──────────────────
export interface SignupCompleted extends BaseEvent {
  event: "signup completed";
  properties: {
    data: {
      user_identity_id: string;
    };
  };
}

export interface OnboardingStepCompleted extends BaseEvent {
  event: "onboarding step_completed";
  properties: {
    data: {
      step_id: string;
      step_index: number;
      user_identity_id: string;
    };
  };
}

export interface WorkspaceCreated extends BaseEvent {
  event: "workspace created";
  properties: {
    data: {
      workspace_id: string;
      user_identity_id: string;
    };
  };
}

// ─── Wizard Events ─────────────────────────────
export interface WizardStepCompleted extends BaseEvent {
  event: "wizard step_completed";
  properties: {
    data: {
      wizard_id: string;
      step_id: string;
      step_index: number;
      /** Time spent on the step before completing it */
      duration_ms?: number;
    };
  };
}

export interface WizardCompleted extends BaseEvent {
  event: "wizard completed";
  properties: {
    data: {
      wizard_id: string;
      workspace_id: string | null;
    };
  };
}

export interface WizardStarted extends BaseEvent {
  event: "wizard started";
  properties: {
    data: {
      wizard_id: string;
      theme: string;
      total_steps: number;
    };
  };
}

export interface WizardStepEntered extends BaseEvent {
  event: "wizard step_entered";
  properties: {
    data: {
      wizard_id: string;
      step_id: string;
      step_index: number;
      from_step?: string;
    };
  };
}

export interface WizardStepSkipped extends BaseEvent {
  event: "wizard step_skipped";
  properties: {
    data: {
      wizard_id: string;
      step_id: string;
      step_index: number;
    };
  };
}

export interface WizardStepBack extends BaseEvent {
  event: "wizard step_back";
  properties: {
    data: {
      wizard_id: string;
      step_id: string;
      to_step: string;
    };
  };
}

export interface WizardAbandoned extends BaseEvent {
  event: "wizard abandoned";
  properties: {
    data: {
      wizard_id: string;
      last_step: string;
      duration_ms: number;
    };
  };
}

export interface WizardValidationFailed extends BaseEvent {
  event: "wizard validation_failed";
  properties: {
    data: {
      wizard_id: string;
      step_id: string;
      errors: string[];
    };
  };
}

export interface WizardFactEdited extends BaseEvent {
  event: "wizard fact_edited";
  properties: {
    data: {
      wizard_id: string;
      /** The label of the fact that was edited (e.g. "Bedrift", "Nettside") */
      label: string;
      value: string;
    };
  };
}

// ─── Error Events ───────────────────────────────
export interface ScrapeFailed extends BaseEvent {
  event: "scrape failed";
  properties: {
    data: {
      error_code: string;
      error_message: string;
      step_id?: string;
      wizard_id?: string;
      recoverable: boolean;
      context?: Record<string, unknown>;
    };
  };
}

export interface ScrapePartial extends BaseEvent {
  event: "scrape partial";
  properties: {
    data: {
      error_code: string;
      error_message: string;
      step_id?: string;
      wizard_id?: string;
      recoverable: boolean;
      missing_fields?: string[];
      context?: Record<string, unknown>;
    };
  };
}

export interface BrregLookupFailed extends BaseEvent {
  event: "brreg lookup_failed";
  properties: {
    data: {
      error_code: string;
      error_message: string;
      step_id?: string;
      wizard_id?: string;
      recoverable: boolean;
      context?: Record<string, unknown>;
    };
  };
}

export interface AiGenerationFailed extends BaseEvent {
  event: "ai generation_failed";
  properties: {
    data: {
      error_code: string;
      error_message: string;
      step_id?: string;
      wizard_id?: string;
      recoverable: boolean;
      context?: Record<string, unknown>;
    };
  };
}

export interface AuthSignupFailed extends BaseEvent {
  event: "auth signup_failed";
  properties: {
    data: {
      error_code: string;
      error_message: string;
      step_id?: string;
      wizard_id?: string;
      recoverable: boolean;
      context?: Record<string, unknown>;
    };
  };
}

export interface WorkspaceProvisionFailed extends BaseEvent {
  event: "workspace provision_failed";
  properties: {
    entity: { type: "workspace"; id: string; label: string };
    data: {
      error_code: string;
      error_message: string;
      step_id?: string;
      wizard_id?: string;
      recoverable: boolean;
      context?: Record<string, unknown>;
    };
  };
}

export interface WorkspaceFinalizeFailed extends BaseEvent {
  event: "workspace finalize_failed";
  properties: {
    entity: { type: "workspace"; id: string; label: string };
    data: {
      error_code: string;
      error_message: string;
      step_id?: string;
      wizard_id?: string;
      recoverable: boolean;
      context?: Record<string, unknown>;
    };
  };
}

export interface IndustryPackageLoadFailed extends BaseEvent {
  event: "industry_package load_failed";
  properties: {
    entity: { type: "workspace"; id: string; label: string };
    data: {
      error_code: string;
      error_message: string;
      step_id?: string;
      wizard_id?: string;
      recoverable: boolean;
      context?: Record<string, unknown>;
    };
  };
}

// ─── Botsson Response Events ────────────────────
export interface BotssonNudgeShown extends BaseEvent {
  event: "botsson nudge_shown";
  properties: {
    data: {
      trigger_type: "error" | "stall" | "user_request";
      trigger_event?: string;
      wizard_id: string;
      step_id: string;
      nudge_count: number;
      action_type?: string;
    };
  };
}

export interface BotssonNudgeAccepted extends BaseEvent {
  event: "botsson nudge_accepted";
  properties: {
    data: {
      trigger_type: "error" | "stall" | "user_request";
      trigger_event?: string;
      wizard_id: string;
      step_id: string;
      nudge_count: number;
      action_type?: string;
    };
  };
}

export interface BotssonNudgeDismissed extends BaseEvent {
  event: "botsson nudge_dismissed";
  properties: {
    data: {
      trigger_type: "error" | "stall" | "user_request";
      trigger_event?: string;
      wizard_id: string;
      step_id: string;
      nudge_count: number;
    };
  };
}

export interface BotssonAutofillApplied extends BaseEvent {
  event: "botsson autofill_applied";
  properties: {
    data: {
      trigger_type: "error" | "stall" | "user_request";
      trigger_event?: string;
      wizard_id: string;
      step_id: string;
      nudge_count: number;
      field_count: number;
      source: string;
    };
  };
}

export interface EscalationTriggered extends BaseEvent {
  event: "escalation triggered";
  properties: {
    data: {
      gate: string;
      error_count: number;
      error_codes: string[];
      wizard_id: string;
      last_step: string;
      session_duration_ms: number;
      user_email?: string;
    };
  };
}

// ─── Flow Events ───────────────────────────────
export interface FlowStarted extends BaseEvent {
  event: "flow started";
  properties: {
    data: {
      flow_id: string;
      total_slides: number;
    };
  };
}

export interface FlowSlideViewed extends BaseEvent {
  event: "flow slide_viewed";
  properties: {
    data: {
      flow_id: string;
      slide_index: number;
      slide_type: string;
      duration_ms?: number;
    };
  };
}

export interface FlowAnswerSubmitted extends BaseEvent {
  event: "flow answer_submitted";
  properties: {
    data: {
      flow_id: string;
      slide_index: number;
      answer_key: string;
      answer_value: string | string[];
    };
  };
}

export interface FlowCompleted extends BaseEvent {
  event: "flow completed";
  properties: {
    data: {
      flow_id: string;
      total_slides: number;
      duration_ms: number;
      action?: string;
      answers: Record<string, string | string[]>;
    };
  };
}

export interface FlowSkipped extends BaseEvent {
  event: "flow skipped";
  properties: {
    data: {
      flow_id: string;
      slide_index: number;
      slide_type: string;
      duration_ms: number;
    };
  };
}

// ─── Channel Events ─────────────────────────────
export interface ChannelCreated extends BaseEvent {
  event: "channel.created";
  properties: { channel_type: string; name: string | null };
  entity: EntityRef;
}

export interface ChannelArchived extends BaseEvent {
  event: "channel.archived";
  properties: { channel_type: string };
  entity: EntityRef;
}

// ─── Channel Settings (komm/channel-settings tabs) ──────────
// Fired from the 4 new settings tab server actions (general, members,
// ai-policy, retention). No engine_event routing — these are admin-only
// operational writes, not workflow triggers.

export interface ChannelRenamed extends BaseEvent {
  event: "channel.renamed";
  properties: { channel_id: string; old_name: string; new_name: string };
  entity: EntityRef;
}

export interface ChannelDeleted extends BaseEvent {
  event: "channel.deleted";
  properties: { channel_id: string; channel_type: string };
  entity: EntityRef;
}

export interface ChannelMemberRemoved extends BaseEvent {
  event: "channel.member_removed";
  properties: { channel_id: string; removed_profile_id: string };
  entity: EntityRef;
}

export interface ChannelMemberAdded extends BaseEvent {
  event: "channel.member_added";
  properties: { channel_id: string; added_profile_id: string; role: string };
  entity: EntityRef;
}

export interface ChannelMemberRoleChanged extends BaseEvent {
  event: "channel.member_role_changed";
  properties: { channel_id: string; target_profile_id: string; old_role: string; new_role: string };
  entity: EntityRef;
}

export interface ChannelAiPolicyUpdated extends BaseEvent {
  event: "channel.ai_policy_updated";
  properties: {
    channel_id: string;
    text_participation: string;
    voice_participation: string;
    auto_reminders: boolean;
    auto_summarize: boolean;
    auto_shift_prep: boolean;
  };
  entity: EntityRef;
}

export interface ChannelRetentionChanged extends BaseEvent {
  event: "channel.retention_changed";
  properties: {
    channel_id: string;
    retention_days: number | null;
    auto_archive_days: number | null;
    legal_hold_set: boolean;
  };
  entity: EntityRef;
}

export interface ChannelAccessScopeSet extends BaseEvent {
  event: "channel.access_scope_set";
  properties: {
    channel_id: string;
    /** "workspace" | "departments" | "teams" | "people" */
    scope_kind: string;
    member_count: number;
  };
  entity: EntityRef;
}

// ────────────── Helpdesk (ADR-0160/0161/0162) ──────────────
// channel_event projection trigger (20260515120000) whitelists event_type
// LIKE 'helpdesk.%' — these events appear in Komm UI automatically.

export interface HelpdeskQueryOpened extends BaseEvent {
  event: "helpdesk.query.opened";
  properties: {
    channel_id: string;
    desk_channel_id: string;
    assignee_profile_id: string;
    origin_type: "chat" | "voice";
    // ADR-0161 single-spawn: these fields are propagated into engine_state.context
    // by the dispatcher so the call site no longer needs a direct-insert.
    requester_profile_id: string;
    summary: string;
    pii_redacted?: boolean; // present only on the PII-hit path (ADR-0166)
  };
  entity: EntityRef;
}

export interface HelpdeskQueryResolved extends BaseEvent {
  event: "helpdesk.query.resolved";
  properties: {
    channel_id: string;
    has_resolution_note: boolean;
  };
  entity: EntityRef;
}

export interface HelpdeskQueryReassigned extends BaseEvent {
  event: "helpdesk.query.reassigned";
  properties: {
    channel_id: string;
    from_profile_id: string;
    to_profile_id: string;
  };
  entity: EntityRef;
}

export interface HelpdeskDeskCreated extends BaseEvent {
  event: "helpdesk.desk.created";
  properties: {
    desk_channel_id: string;
    responsible_profile_id: string;
    has_description: boolean;
  };
  entity: EntityRef;
}

export interface HelpdeskDeskResponsibleAssigned extends BaseEvent {
  event: "helpdesk.desk.responsible_assigned";
  properties: {
    desk_channel_id: string;
    new_responsible_profile_id: string;
    previous_responsible_profile_id: string | null;
    was_orphan: boolean;
  };
  entity: EntityRef;
}

export interface HelpdeskDeskArchived extends BaseEvent {
  event: "helpdesk.desk.archived";
  properties: {
    desk_channel_id: string;
  };
  entity: EntityRef;
}

// ADR-0165 — Progressive Channel helpdesk lifecycle
// Fired when a regular channel is upgraded to helpdesk posture (flag flip,
// preset selection, rep assignment). Replaces the Phase 1 `helpdesk.desk.*`
// events for the flag-based model; the old events remain valid for the
// deprecated desks/_actions/desk-actions.ts until that file is deleted
// in the web sub-sortie.
export interface ChannelHelpdeskEnabled extends BaseEvent {
  event: "channel.helpdesk.enabled";
  properties: {
    channel_id: string;
    preset: "ingen" | "fag" | "hr_privat" | "tilpasset";
    privacy_mode: "public" | "private_per_requester";
    responsible_profile_id: string;
    text_participation: "disabled" | "mention_only" | "proactive";
    voice_participation: "disabled" | "listen_only" | "interactive";
  };
  entity: EntityRef;
}

// Fired when helpdesk posture is removed from a channel. Pre-condition:
// no open engine_state tickets (guarded by the Server Action). Rep
// demotion (role='representative' → 'member') is part of this transition.
export interface ChannelHelpdeskDisabled extends BaseEvent {
  event: "channel.helpdesk.disabled";
  properties: {
    channel_id: string;
    previous_responsible_profile_id: string | null;
  };
  entity: EntityRef;
}

// ADR-0165 — Reassignment of a helpdesk channel's responsible rep.
// L-0080 regression guard: prior rep MUST be demoted to role='member'
// so channels don't accrete ghost representatives across reassigns.
export interface ChannelResponsibleReassigned extends BaseEvent {
  event: "channel.responsible.reassigned";
  properties: {
    channel_id: string;
    new_responsible_profile_id: string;
    previous_responsible_profile_id: string | null;
  };
  entity: EntityRef;
}

// ADR-0166 — PII classifier hit on a public-mode helpdesk message.
// pii_categories mirrors packages/ai/src/classifiers/pii-classifier.ts
// detected categories. redaction_outcome captures what the hook did:
//   - 'redacted' → original replaced with placeholder, private sub-channel spawned
//   - 'allowed'  → classifier signaled detection but policy allowed publish
//   - 'timeout'  → classifier exceeded the 800ms soft-hold budget
export interface HelpdeskPiiDetected extends BaseEvent {
  event: "helpdesk.pii.detected";
  properties: {
    channel_id: string;
    message_id: string | null;
    pii_categories: string[];
    classifier_version: string;
    duration_ms: number;
    redaction_outcome: "redacted" | "allowed" | "timeout";
  };
  entity: EntityRef;
}

// ADR-0166 — Classifier exceeded the 800ms soft-hold budget. Emits
// alongside the publish (fail-open posture); admin is notified via
// background task. Never blocks the user's send.
export interface HelpdeskPiiClassifierTimeout extends BaseEvent {
  event: "helpdesk.pii.classifier_timeout";
  properties: {
    channel_id: string;
    message_id: string | null;
    classifier_version: string;
    duration_ms: number;
  };
  entity: EntityRef;
}

// ADR-0227 — Helpdesk SLA Phase 2 events.
// Fired by fire-delayed-triggers when the pre-canned breach engine_event is
// re-dispatched to engine-dispatch after the SLA timer (observer_escalation_hours)
// expires. The breach timer is inserted by openTicket at spawn time using
// snapshot semantics — admin changes to observer_escalation_hours do NOT affect
// in-flight tickets. Routes to engine_event so the engine_trigger (T3 migration)
// picks it up and initiates the breach-handling path.
export interface HelpdeskQuerySlaBreached extends BaseEvent {
  event: "helpdesk.query.sla_breached";
  properties: {
    engine_state_id: string; // ID of the original ticket engine_state
    desk_channel_id: string; // channel where the ticket lives (ADR-0161)
    workspace_id: string; // non-empty, required for routing
    breached_at: string; // ISO 8601 timestamp of breach fire
  };
  entity: EntityRef;
}

// ADR-0236 — Cross-state context patch (success path). Emitted by the
// engine-dispatch `update_context_targeted` action_type after a workspace-
// integrity-checked, shallow-merge patch lands on a DIFFERENT engine_state
// from the executing one. Routes to engine_event so downstream consumers
// (UI subscribers reading the patched ticket) can react, and to
// activity_trail for cross-state-write audit. PII-safe — patch_keys only,
// never values (ADR-0163).
export interface EngineContextPatchedTargeted extends BaseEvent {
  event: "engine.context_patched_targeted";
  properties: {
    source_state_id: string; // executing state (the breach-handler)
    target_state_id: string; // patched state (the original ticket)
    patch_keys: string[]; // key names only — never values per ADR-0163
    workspace_id: string; // both source and target share this (guarded)
  };
  entity: EntityRef;
}

// ADR-0236 — Cross-state context patch BLOCKED by workspace integrity guard.
// CVE-class signal: a misconfigured blueprint attempted to patch an
// engine_state in a different workspace. Routes to logger (warn severity)
// + activity_trail (security audit). NOT engine_event — this is a security-
// boundary breach, not a workflow signal that downstream processes should
// consume. Investigation pivot: search activity_trail for this event_type.
export interface EngineCrossStateWriteBlocked extends BaseEvent {
  event: "engine.cross_state_write_blocked";
  properties: {
    source_state_id: string; // the blocked source (now status=blocked)
    attempted_target_state_id: string; // the target that was NOT patched
    source_workspace_id: string; // source's tenant
    target_workspace_id: string; // target's tenant (different — that's the breach)
    reason: string; // e.g. "workspace_mismatch"
  };
  entity: EntityRef;
}

// ADR-0226 — High-signal operational warn when the proxy resolution chain
// (team leader → broadcast) fails to find any observer for SLA notification.
// Routes to logger + activity_trail only — NOT PostHog (not an analytics event)
// and NOT engine_event (no downstream consumer expected). Surfaces silent SLA
// failure so operations can detect misconfigured workspaces from audit data.
export interface HelpdeskSlaNobodyResolved extends BaseEvent {
  event: "helpdesk.sla.no_observer_resolved";
  properties: {
    engine_state_id: string; // original ticket engine_state
    workspace_id: string; // workspace where resolution failed
    rep_profile_id: string; // rep whose team leader chain was checked
    min_role: string; // role floor used for broadcast fallback
    attempted_paths: string[]; // e.g. ['team_leader', 'broadcast']
  };
  entity: EntityRef;
}

export interface ChannelMessageSent extends BaseEvent {
  event: "channel.message.sent";
  properties: { channel_id: string; origin_type: string; message_type: string };
  entity: EntityRef;
}

export interface ChannelMessageEdited extends BaseEvent {
  event: "channel.message.edited";
  properties: { channel_id: string };
  entity: EntityRef;
}

export interface ChannelMessageDeleted extends BaseEvent {
  event: "channel.message.deleted";
  properties: { channel_id: string };
  entity: EntityRef;
}

export interface ChannelMemberJoined extends BaseEvent {
  event: "channel.member.joined";
  properties: { channel_id: string; role: string };
  entity: EntityRef;
}

export interface ChannelMemberLeft extends BaseEvent {
  event: "channel.member.left";
  properties: { channel_id: string };
  entity: EntityRef;
}

export interface ChannelReactionAdded extends BaseEvent {
  event: "channel.reaction.added";
  properties: { channel_id: string; message_id: string; emoji: string };
  entity: EntityRef;
}

export interface ChannelReactionRemoved extends BaseEvent {
  event: "channel.reaction.removed";
  properties: { channel_id: string; message_id: string; emoji: string };
  entity: EntityRef;
}

export interface ChannelRead extends BaseEvent {
  event: "channel.read";
  properties: { channel_id: string; message_id: string };
  entity: EntityRef;
}

export interface ChannelMessagePinned extends BaseEvent {
  event: "channel.message.pinned";
  properties: { channel_id: string };
  entity: EntityRef;
}

export interface ChannelMessageUnpinned extends BaseEvent {
  event: "channel.message.unpinned";
  properties: { channel_id: string };
  entity: EntityRef;
}

// ─── Help Request Events ───────────────────────
export interface HelpRequestCreated extends BaseEvent {
  event: "help_request.created";
  properties: { title: string };
  entity: EntityRef;
}

export interface HelpRequestResolved extends BaseEvent {
  event: "help_request.resolved";
  properties: { resolved_by: string };
  entity: EntityRef;
}

// ─── Knowledge Sharing Events ──────────────────
export interface KnowledgeShared extends BaseEvent {
  event: "knowledge.shared";
  properties: { channel_id: string; shared_type: string; shared_id: string; title: string };
  entity: EntityRef;
}

// ─── News Events ───────────────────────────────
export interface NewsPostCreated extends BaseEvent {
  event: "news.post.created";
  properties: { channel_id: string };
  entity: EntityRef;
}

export interface NewsPostReacted extends BaseEvent {
  event: "news.post.reacted";
  properties: { channel_id: string; emoji: string };
  entity: EntityRef;
}

// ─── Website Factory Events ────────────────────
export interface WebsiteCreated extends BaseEvent {
  event: "website created";
  properties: { entity: EntityRef; data: { template_key: string } };
}

export interface WebsitePublished extends BaseEvent {
  event: "website published";
  properties: { entity: EntityRef; data: { version: number; snapshot_hash: string } };
}

export interface WebsiteUnpublished extends BaseEvent {
  event: "website unpublished";
  properties: { entity: EntityRef };
}

export interface WebsiteRollback extends BaseEvent {
  event: "website rollback";
  properties: { entity: EntityRef; data: { from_version: number; to_version: number } };
}

export interface WebsiteDomainVerified extends BaseEvent {
  event: "website domain_verified";
  properties: { entity: EntityRef; data: { domain: string } };
}

export interface WebsiteDomainFailed extends BaseEvent {
  event: "website domain_failed";
  properties: { entity: EntityRef; data: { domain: string; reason: string } };
}

export interface WebsitePreviewCreated extends BaseEvent {
  event: "website preview_created";
  properties: { entity: EntityRef; data: { revision_number: number } };
}

export interface WebsiteContentGenerated extends BaseEvent {
  event: "website content_generated";
  properties: { entity: EntityRef; data: { section_count: number } };
}

export interface WebsiteUpdated extends BaseEvent {
  event: "website updated";
  properties: { entity: EntityRef; data: Record<string, unknown> };
}

export interface WebsiteSetupCompleted extends BaseEvent {
  event: "website setup completed";
  properties: { entity: EntityRef; data: { template_key: string; page_count: number } };
}

export interface WebsitePageCreated extends BaseEvent {
  event: "website page created";
  properties: { entity: EntityRef; data: { title: string; page_type: string } };
}

export interface WebsitePageDeleted extends BaseEvent {
  event: "website page deleted";
  properties: { entity: EntityRef };
}

export interface WebsitePagesReordered extends BaseEvent {
  event: "website pages reordered";
  properties: { entity: EntityRef; data: { page_count: number } };
}

export interface WebsiteSectionCreated extends BaseEvent {
  event: "website section created";
  properties: { entity: EntityRef; data: { section_type: string; page_id?: string } };
}

export interface WebsiteSectionDeleted extends BaseEvent {
  event: "website section deleted";
  properties: { entity: EntityRef };
}

export interface WebsiteSectionUpdated extends BaseEvent {
  event: "website section updated";
  properties: { entity: EntityRef; data: { section_type: string; source: string } };
}

export interface WebsiteSectionsReordered extends BaseEvent {
  event: "website sections reordered";
  properties: { entity: EntityRef; data: { section_count: number } };
}

export interface WebsiteAssetUploaded extends BaseEvent {
  event: "website asset uploaded";
  properties: {
    entity: EntityRef;
    data: { asset_id: string; mime_type: string; size_bytes: number };
  };
}

export interface WebsitePreviewTokenCreated extends BaseEvent {
  event: "website preview token created";
  properties: { entity: EntityRef; data: { expires_at: string } };
}

export interface WebsiteHoursUpdated extends BaseEvent {
  event: "website hours_updated";
  properties: { entity: EntityRef; data: { days_updated: number } };
}

export interface WebsiteMenuSynced extends BaseEvent {
  event: "website menu_synced";
  properties: { entity: EntityRef; data: { menu_count: number } };
}

export interface WebsiteSystemSectionAdded extends BaseEvent {
  event: "website system_section_added";
  properties: { entity: EntityRef; data: { section_type: string } };
}

// ─── Website Spokesperson Events ───────────────
export interface WebsiteSpokespersonAssigned extends BaseEvent {
  event: "website spokesperson_assigned";
  properties: { entity: EntityRef; data: { profile_id: string; role_title: string } };
}

export interface WebsiteSpokespersonApproved extends BaseEvent {
  event: "website spokesperson_approved";
  properties: { entity: EntityRef; data: { profile_id: string } };
}

export interface WebsiteSpokespersonDeclined extends BaseEvent {
  event: "website spokesperson_declined";
  properties: { entity: EntityRef; data: { profile_id: string; reason?: string } };
}

export interface WebsiteSpokespersonContentSubmitted extends BaseEvent {
  event: "website spokesperson_content_submitted";
  properties: { entity: EntityRef; data: { task_type: string } };
}

export interface WebsiteSpokespersonTaskOverdue extends BaseEvent {
  event: "website spokesperson_task_overdue";
  properties: { entity: EntityRef; data: { task_type: string; profile_id: string } };
}

export interface WebsiteSpokespersonRevoked extends BaseEvent {
  event: "website spokesperson_revoked";
  properties: { entity: EntityRef; data: { spokesperson_id: string } };
}

// ─── Channel Call Events ────────────────────────
export interface ChannelCallStarted extends BaseEvent {
  event: "channel.call.started";
  properties: {
    channel_id: string;
    call_type: "direct" | "group" | "ptt";
    call_session_id: string;
  };
  entity: EntityRef;
}

export interface ChannelCallEnded extends BaseEvent {
  event: "channel.call.ended";
  properties: {
    channel_id: string;
    call_type: "direct" | "group" | "ptt";
    call_session_id: string;
    duration_seconds: number;
    max_participants: number;
  };
  entity: EntityRef;
}

export interface ChannelCallParticipantJoined extends BaseEvent {
  event: "channel.call.participant_joined";
  properties: { channel_id: string; call_session_id: string; device_type: string };
  entity: EntityRef;
}

export interface ChannelCallParticipantLeft extends BaseEvent {
  event: "channel.call.participant_left";
  properties: { channel_id: string; call_session_id: string };
  entity: EntityRef;
}

export interface ChannelCallInviteSent extends BaseEvent {
  event: "channel.call.invite_sent";
  properties: { channel_id: string; call_session_id: string; callee_profile_id: string };
  entity: EntityRef;
}

export interface ChannelCallInviteAccepted extends BaseEvent {
  event: "channel.call.invite_accepted";
  properties: { channel_id: string; call_session_id: string };
  entity: EntityRef;
}

export interface ChannelCallInviteRejected extends BaseEvent {
  event: "channel.call.invite_rejected";
  properties: { channel_id: string; call_session_id: string };
  entity: EntityRef;
}

export interface ChannelCallInviteMissed extends BaseEvent {
  event: "channel.call.invite_missed";
  properties: { channel_id: string; call_session_id: string };
  entity: EntityRef;
}

export interface ChannelCallGroupAnnounced extends BaseEvent {
  event: "channel.call.group_announced";
  properties: { channel_id: string; call_session_id: string };
  entity: EntityRef;
}

export interface ChannelCallPttActivated extends BaseEvent {
  event: "channel.call.ptt_activated";
  properties: { channel_id: string };
  entity: EntityRef;
}

export interface ChannelCallPttDeactivated extends BaseEvent {
  event: "channel.call.ptt_deactivated";
  properties: { channel_id: string };
  entity: EntityRef;
}

export interface ChannelCallParticipantMuted extends BaseEvent {
  event: "channel.call.participant_muted";
  properties: {
    channel_id: string;
    target_identity: string;
    muted: boolean;
  };
  entity: EntityRef;
}

// ─── Agent Events ───────────────────────────────
export interface AgentSessionStarted extends BaseEvent {
  event: "agent session_started";
  properties: {
    entity: EntityRef;
    data: { channel: "mobile" | "web"; mode: "voice" | "text" };
  };
}

export interface AgentSessionClosed extends BaseEvent {
  event: "agent session_closed";
  properties: {
    entity: EntityRef;
    data: { duration_seconds: number; tool_calls: number };
  };
}

export interface AgentToolCalled extends BaseEvent {
  event: "agent tool_called";
  properties: {
    entity: EntityRef;
    data: { tool_name: string; capability: string; success: boolean };
  };
}

// Agent Harness events (Phase 1). Subagent events (spawned/completed/failed) deferred to Phase 2.
export interface AgentHookBlocked extends BaseEvent {
  event: "agent hook_blocked";
  properties: {
    data: { hook_name: string; hook_type: string; reason: string; session_id: string };
  };
}

export interface AgentContextWindowTruncated extends BaseEvent {
  event: "agent context_window_truncated";
  properties: {
    data: { session_id: string; dropped_turns: number; window_size: number };
  };
}

export interface AgentBudgetExhausted extends BaseEvent {
  event: "agent budget_exhausted";
  properties: {
    data: {
      session_id: string;
      total_tokens: number;
      max_tokens: number | null;
      total_turns: number;
      max_turns: number | null;
    };
  };
}

export interface AgentTokensUsed extends BaseEvent {
  event: "agent tokens_used";
  properties: {
    data: {
      session_id: string;
      model: string;
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
      source: string;
    };
  };
}

// ─── Botsson Runtime Events (Phase 3, ADR-0116) ────
// Emitted by stage-engine per-turn to observe the full agent loop:
// envelope (turn_started/completed), intent classifier, tool adapter
// (invoked/failed), and stepCountIs(5) truncation signal.
export interface BotssonTurnStarted extends BaseEvent {
  event: "botsson.turn_started";
  properties: {
    entity: EntityRef;
    data: {
      session_id: string;
      message_preview: string;
      channel: "chat" | "voice";
    };
  };
}

export interface BotssonTurnCompleted extends BaseEvent {
  event: "botsson.turn_completed";
  properties: {
    entity: EntityRef;
    data: {
      session_id: string;
      intent_capability: string;
      intent_confidence: number;
      response_preview: string;
    };
  };
}

export interface BotssonIntentClassified extends BaseEvent {
  event: "botsson.intent_classified";
  properties: {
    entity: EntityRef;
    data: {
      session_id: string;
      capability: string;
      confidence: number;
      latency_ms: number;
    };
  };
}

export interface BotssonToolInvoked extends BaseEvent {
  event: "botsson.tool_invoked";
  properties: {
    entity: EntityRef;
    data: {
      session_id: string;
      capability: string;
      tool: string;
      latency_ms: number;
      success: boolean;
    };
  };
}

export interface BotssonToolFailed extends BaseEvent {
  event: "botsson.tool_failed";
  properties: {
    entity: EntityRef;
    data: {
      session_id: string;
      capability: string;
      tool: string;
      latency_ms: number;
      error_message: string;
    };
  };
}

export interface BotssonStepCapHit extends BaseEvent {
  event: "botsson.step_cap_hit";
  properties: {
    entity: EntityRef;
    data: {
      session_id: string;
      step_count: number;
      finish_reason: string;
    };
  };
}

// ─── Mobile Voice (LiveKit) Events (ADR-0132, ADR-0135, Phase C1) ─
// Emitted by:
//   - mobile  : voice.session_started / voice.session_ended
//                 (useVoiceTranscripts, BotssonProvider)
//   - BFF     : voice.transcript_in, voice.response_out
//                 (POST /api/botsson/voice/transcript)
// The voice control plane (transcript → reasoning → response) flows through
// the web BFF per ADR-0132; the LiveKit media plane carries audio only.
export interface VoiceSessionStarted extends BaseEvent {
  event: "voice.session_started";
  properties: {
    entity: EntityRef;
    data: {
      session_id: string;
      livekit_room_id: string;
      channel_id: string | null;
      voice_participation: "listen_only" | "interactive";
    };
  };
}

export interface VoiceSessionEnded extends BaseEvent {
  event: "voice.session_ended";
  properties: {
    entity: EntityRef;
    data: {
      session_id: string;
      livekit_room_id: string;
      duration_ms: number;
      end_reason: "user_ended" | "room_disconnected" | "policy_revoked" | "error";
    };
  };
}

export interface VoiceTranscriptIn extends BaseEvent {
  event: "voice.transcript_in";
  properties: {
    entity: EntityRef;
    data: {
      session_id: string;
      livekit_room_id: string;
      /** Transcript length in characters; the text itself is redacted from telemetry. */
      transcript_length: number;
      /** Whisper or other ASR provider tag — e.g. "livekit_whisper", "openai_realtime". */
      asr_provider: string;
      /** ASR latency: time from audio segment end to transcript availability. */
      asr_latency_ms: number;
    };
  };
}

export interface VoiceResponseOut extends BaseEvent {
  event: "voice.response_out";
  properties: {
    entity: EntityRef;
    data: {
      session_id: string;
      livekit_room_id: string;
      /** Response length in characters. */
      response_length: number;
      /** Stage-engine pipeline latency (ms) from transcript_in → response_out. */
      pipeline_latency_ms: number;
      /** Whether the response includes a tool invocation. */
      has_tool_call: boolean;
    };
  };
}

// ─── Session Recorder Events (ADR-0184, ADR-0185) ─
// Emitted by BFF endpoints under /api/botsson/recorder/*.
// These land in activity_trail (audit) + posthog (analytics).
export interface RecorderTurnFlagged extends BaseEvent {
  event: "recorder.turn_flagged";
  properties: {
    entity: EntityRef;
    data: {
      session_id: string;
      turn_id: string;
      reason: string;
    };
  };
}

export interface RecorderWhisperCreated extends BaseEvent {
  event: "recorder.whisper_created";
  properties: {
    entity: EntityRef;
    data: {
      session_id: string;
      whisper_id: string;
      content_length: number;
    };
  };
}

// Whole-session flag (Phase 2a). Fans out to every recorded turn on the
// session. Emitted once per admin action; `flagged_turn_count` lets the
// audit trail reconstruct blast radius without re-querying the table.
// Optional entry_type/entry_content/timestamp carry the Arena LogView row
// context through — they are empty strings when the drawer calls this
// endpoint (drawer has no per-row context, only session-level reason).
export interface RecorderSessionFlagged extends BaseEvent {
  event: "recorder.session_flagged";
  properties: {
    entity: EntityRef;
    data: {
      session_id: string;
      reason: string;
      flagged_turn_count: number;
      entry_type: string;
      entry_content: string;
      timestamp: number;
    };
  };
}

// Force-stop (Phase 2a). Inserts an auto-generated whisper "previous turn
// interrupted by admin, begin fresh" so the next prompt-builder rebuild
// picks it up naturally — no new table + no Stage Engine side-channel.
// ADR-0185 referenced `session_lane.status='interrupted'` which is
// aspirational: SessionLane is an in-memory promise queue, not persistence.
// Using the whisper pipe keeps force-stop on a proven, audited path.
export interface RecorderSessionForceStopped extends BaseEvent {
  event: "recorder.session_force_stopped";
  properties: {
    entity: EntityRef;
    data: {
      session_id: string;
      reason: string;
      whisper_id: string;
    };
  };
}

// User-initiated escalation from the Arena LogView hover-flag affordance
// (Phase 2b). Different semantics from recorder.session_flagged:
//   - Caller is the user themselves, not an admin — any authenticated role.
//   - session_id is resolved SERVER-SIDE from the user's most recent
//     recorded turn (agent-sdk does not expose the live session_id to the
//     client; see notes in flag-log-entry/route.ts).
//   - No DB mutation on agent_session_recording — pure escalation signal
//     for platform-admin review. Admins follow up via /flag-session if they
//     want to bump retention on the underlying turns.
// session_id may be "" when the user had no recent session (no turns in
// the last lookback window) — activity_trail still records the escalation
// intent for product analytics.
export interface RecorderUserFlagSubmitted extends BaseEvent {
  event: "recorder.user_flag_submitted";
  properties: {
    entity: EntityRef;
    data: {
      session_id: string;
      entry_type: string;
      entry_content: string;
      timestamp: number;
      reason: string;
    };
  };
}

// admin.pii_reveal — break-glass PII reveal (godmode-only, audit-mandatory).
// Per ADR-0185: every reveal records duration_ms (5000) for retention-policy audit.
export interface AdminPiiReveal extends BaseEvent {
  event: "admin.pii_reveal";
  properties: {
    entity: EntityRef;
    data: {
      envelope_id: string;
      pii_class: string;
      duration_ms: number;
    };
  };
}

// ─── Emma Task Events ──────────────────────────
export interface EmmaTaskScheduled extends BaseEvent {
  event: "emma_task scheduled";
  properties: {
    data: { title: string; priority: string; has_deadline: boolean };
  };
}

export interface EmmaTaskCompleted extends BaseEvent {
  event: "emma_task completed";
  properties: {
    data: { task_id: string; title: string };
  };
}

export interface NotificationDeepLinkFollowed extends BaseEvent {
  event: "notification deep_link_followed";
  properties: {
    data: { notification_type: string; target_route: string };
  };
}

export interface HubActionTapped extends BaseEvent {
  event: "hub action_tapped";
  properties: {
    data: { action_type: string; action_id: string; priority: number };
  };
}

// ─── Cascade Task Surface Events ────────────────
export interface TaskSurfaceViewed extends BaseEvent {
  event: "task_surface viewed";
  properties: {
    entity: EntityRef;
    data: { total_tasks: number; critical_count: number };
  };
}

export interface TaskSurfaceClicked extends BaseEvent {
  event: "task_surface clicked";
  properties: {
    entity: EntityRef;
    data: { group: string; dimension: string; urgency: string };
  };
}

export interface TaskSurfaceSnapshot extends BaseEvent {
  event: "task_surface snapshot";
  properties: {
    entity: EntityRef;
    data: {
      total_tasks: number;
      critical_count: number;
      should_count: number;
    };
  };
}

// ─── Entity Drawer Events ───────────────────────
export interface EntityDrawerOpened extends BaseEvent {
  event: "entity_drawer opened";
  properties: {
    data: { entity_type: string; entity_id: string; source: string };
  };
}

export interface EntityDrawerClosed extends BaseEvent {
  event: "entity_drawer closed";
  properties: {
    data: { entity_type: string; entity_id: string; duration_ms: number };
  };
}

export interface EntityDrawerPinned extends BaseEvent {
  event: "entity_drawer pinned";
  properties: {
    data: { entity_type: string; entity_id: string };
  };
}

export interface EntityDrawerTabSwitched extends BaseEvent {
  event: "entity_drawer tab_switched";
  properties: {
    data: { entity_type: string; entity_id: string; from_tab: string; to_tab: string };
  };
}

// ─── Telegram Events ────────────────────────────
export interface TelegramSessionCreated extends BaseEvent {
  event: "telegram session_created";
  properties: { data: { session_id: string } };
}

export interface TelegramMessageReceived extends BaseEvent {
  event: "telegram message_received";
  properties: { data: { text: string } };
}

export interface TelegramMessageSent extends BaseEvent {
  event: "telegram message_sent";
  properties: { data: { text: string } };
}

export interface TelegramEscalationSent extends BaseEvent {
  event: "telegram escalation_sent";
  properties: { data: { title: string; severity: string } };
}

export interface TelegramEscalationResolved extends BaseEvent {
  event: "telegram escalation_resolved";
  properties: { data: { action_type: string } };
}

export interface TelegramPollSent extends BaseEvent {
  event: "telegram poll_sent";
  properties: { data: { question: string; option_count: number } };
}

export interface TelegramPollResolved extends BaseEvent {
  event: "telegram poll_resolved";
  properties: { data: { poll_id: string; selected_options: string[] } };
}

export interface TelegramBridgeOpened extends BaseEvent {
  event: "telegram bridge_opened";
  properties: { data: { channel_id: string } };
}

export interface TelegramBridgeClosed extends BaseEvent {
  event: "telegram bridge_closed";
  properties: { data: { channel_id: string; duration_ms: number } };
}

export interface TelegramBridgeMessageRelayed extends BaseEvent {
  event: "telegram bridge_message_relayed";
  properties: { data: { direction: "smartout_to_telegram" | "telegram_to_smartout" } };
}

// ─── Security Events ────────────────────────────
export interface SecurityRateLimited extends BaseEvent {
  event: "security rate_limited";
  properties: { data: { endpoint: string; ip_hash: string; identifier: string; count: number } };
}

export interface SecurityLockoutTriggered extends BaseEvent {
  event: "security lockout_triggered";
  properties: { data: { method: string; attempts: number } };
}

export interface SecuritySandboxBlocked extends BaseEvent {
  event: "security sandbox_blocked";
  properties: { data: { action: string; workspace_id: string } };
}

// ADR-0099: unified authority gate telemetry.
export interface GateEvaluated extends BaseEvent {
  event: "gate evaluated";
  properties: {
    data: {
      capability: string;
      action_type: string;
      channel: string;
      allow: boolean;
      downgrade_to: string | null;
      gate_evaluation_id: string;
      engine_state_id?: string | null;
    };
  };
}

export interface GateDenied extends BaseEvent {
  event: "gate denied";
  properties: {
    data: {
      capability: string;
      action_type: string;
      channel: string;
      reason: string;
      gate_evaluation_id: string;
      engine_state_id?: string | null;
    };
  };
}

export interface WorkspaceAbandoned extends BaseEvent {
  event: "workspace abandoned";
  properties: { data: { workspace_id: string; created_at: string; last_step: string } };
}

// ─── Enrichment Events ──────────────────────────
export interface EnrichmentRequested extends BaseEvent {
  event: "enrichment requested";
  properties: { data: { source: "brreg" | "scraping"; org_number: string } };
}

export interface EnrichmentHit extends BaseEvent {
  event: "enrichment hit";
  properties: {
    data: { source: "brreg" | "scraping"; fields_populated: number; fields_total: number };
  };
}

export interface EnrichmentMissed extends BaseEvent {
  event: "enrichment missed";
  properties: { data: { source: "brreg" | "scraping"; reason: string } };
}

export interface EnrichmentCorrected extends BaseEvent {
  event: "enrichment corrected";
  properties: { data: { field_name: string; was_auto: boolean } };
}

// ─── Operations Intelligence Events (ADR-0088) ──────────────────────

export interface OpsCompileDayBrief extends BaseEvent {
  event: "ops.compile day_brief";
  properties: {
    entity: { entity_type: "department_session"; entity_id: string };
    data: { department_id: string; shift_count: number; critical_tasks: number };
  };
}

export interface OpsCompilePreclose extends BaseEvent {
  event: "ops.compile preclose_summary";
  properties: {
    entity: { entity_type: "department_session"; entity_id: string };
    data: { tasks_remaining: number; deviations_open: number; ready_for_signoff: boolean };
  };
}

export interface OpsCompileShiftBrief extends BaseEvent {
  event: "ops.compile shift_brief";
  properties: {
    entity: { entity_type: "shift"; entity_id: string };
    data: { profile_id: string };
  };
}

export interface OpsTriageClassified extends BaseEvent {
  event: "ops.triage classified";
  properties: {
    data: {
      original_event: string;
      classification_type: string;
      urgency: string;
      tier: "ambient" | "active" | "critical";
    };
  };
}

// ─── Operations Intelligence Phase 2 Events (ADR-0088) ─────────────

export interface OpsMonitorLatePunchin extends BaseEvent {
  event: "ops.monitor late_punchin";
  properties: {
    entity: { entity_type: "shift"; entity_id: string };
    data: { employee_id: string; elapsed_minutes: number; department_id: string };
  };
}

export interface OpsMonitorNoShow extends BaseEvent {
  event: "ops.monitor no_show";
  properties: {
    entity: { entity_type: "shift"; entity_id: string };
    data: { employee_id: string; elapsed_minutes: number; department_id: string };
  };
}

export interface OpsMonitorTaskOverdue extends BaseEvent {
  event: "ops.monitor task_overdue";
  properties: {
    entity: { entity_type: "session_task"; entity_id: string };
    data: { title: string; elapsed_minutes: number; priority: string };
  };
}

export interface OpsMonitorCriticalTaskMissed extends BaseEvent {
  event: "ops.monitor critical_task_missed";
  properties: {
    entity: { entity_type: "session_task"; entity_id: string };
    data: { title: string; department_id: string };
  };
}

export interface OpsMonitorUnderstaffing extends BaseEvent {
  event: "ops.monitor understaffing";
  properties: {
    entity: { entity_type: "department_session"; entity_id: string };
    data: { current_count: number; min_required: number; deficit: number };
  };
}

export interface OpsMonitorApproachingClose extends BaseEvent {
  event: "ops.monitor session_approaching_close";
  properties: {
    entity: { entity_type: "department_session"; entity_id: string };
    data: { minutes_until_close: number; incomplete_tasks: number };
  };
}

export interface OpsMonitorUnsignedSession extends BaseEvent {
  event: "ops.monitor unsigned_session";
  properties: {
    entity: { entity_type: "department_session"; entity_id: string };
    data: { minutes_past_close: number };
  };
}

export interface OpsMonitorAlertsQueried extends BaseEvent {
  event: "ops.monitor alerts_queried";
  properties: {
    data: { department_id: string | null; hours: number; total_alerts: number };
  };
}

export interface OpsMonitorSessionIntelligenceQueried extends BaseEvent {
  event: "ops.monitor session_intelligence_queried";
  properties: {
    entity: { entity_type: "department_session"; entity_id: string };
    data: { department_id: string; health_score: number };
  };
}

export interface OpsActEscalated extends BaseEvent {
  event: "ops.act escalated";
  properties: {
    entity: { entity_type: "department_session"; entity_id: string };
    data: { alert_rule: string; severity: string; department_id: string };
  };
}

export interface OpsActTasksRedistributed extends BaseEvent {
  event: "ops.act tasks_redistributed";
  properties: {
    entity: { entity_type: "department_session"; entity_id: string };
    data: { absent_employee_id: string; tasks_redistributed: number };
  };
}

export interface OpsActSessionFrozen extends BaseEvent {
  event: "ops.act session_frozen";
  properties: {
    entity: { entity_type: "department_session"; entity_id: string };
    data: { tasks_total: number; tasks_completed: number; tasks_frozen: number };
  };
}

// ─── Operations Intelligence PREDICT Events (ADR-0088 Phase 3) ────────

export interface OpsPredictGenerated extends BaseEvent {
  event: "ops.predict generated";
  properties: {
    entity: { entity_type: "department"; entity_id: string };
    data: {
      prediction_type: "coverage_gap" | "task_bottleneck" | "compliance_risk" | "employee_overload";
      confidence: number;
      department_id: string;
    };
  };
}

export interface OpsPredictCoverageQueried extends BaseEvent {
  event: "ops.predict coverage_queried";
  properties: {
    entity: { entity_type: "department"; entity_id: string };
    data: { department_id: string; date_range_days: number; gaps_found: number };
  };
}

export interface OpsPredictComplianceQueried extends BaseEvent {
  event: "ops.predict compliance_queried";
  properties: {
    entity: { entity_type: "workspace"; entity_id: string };
    data: { department_id: string | null; completion_rate: number; threshold: number };
  };
}

// ─── Operations Intelligence LEARN Events (ADR-0088 Phase 3) ──────────

export interface OpsLearnPatternExtracted extends BaseEvent {
  event: "ops.learn pattern_extracted";
  properties: {
    entity: { entity_type: "workspace"; entity_id: string };
    data: {
      pattern_type: "task_duration" | "staffing" | "deviation_correlation";
      data_range_days: number;
      confidence: number;
    };
  };
}

export interface OpsLearnRetentionCleaned extends BaseEvent {
  event: "ops.learn retention_cleaned";
  properties: {
    entity: { entity_type: "workspace"; entity_id: string };
    data: { expired_count: number; retained_count: number };
  };
}

export interface OpsLearnPatternsQueried extends BaseEvent {
  event: "ops.learn patterns_queried";
  properties: {
    entity: { entity_type: "workspace"; entity_id: string };
    data: { pattern_type: string | null; results_count: number };
  };
}

// ─── Shift Swap Events ──────────────────────────
// Shift swap workflow: request → accept/reject → approve/reject → execute
// All swap state lives in engine_state.context JSONB (ADR-0067)

export interface ShiftSwapRequested extends BaseEvent {
  event: "shift_swap.requested";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: {
      swap_id: string;
      requester_shift_id: string;
      target_shift_id: string;
      target_profile_id: string;
    };
  };
}

export interface ShiftSwapAccepted extends BaseEvent {
  event: "shift_swap.accepted";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: { swap_id: string };
  };
}

export interface ShiftSwapRejected extends BaseEvent {
  event: "shift_swap.rejected";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: { swap_id: string; rejected_by: string };
  };
}

export interface ShiftSwapApproved extends BaseEvent {
  event: "shift_swap.approved";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: { swap_id: string };
  };
}

export interface ShiftSwapExecuted extends BaseEvent {
  event: "shift_swap.executed";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: {
      swap_id: string;
      /** Available when initiated, may not be available on approval path */
      requester_shift_id?: string;
      /** Available when initiated, may not be available on approval path */
      target_shift_id?: string;
    };
  };
}

export interface ShiftSwapCancelled extends BaseEvent {
  event: "shift_swap.cancelled";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: { swap_id: string };
  };
}

// ─── Platform Admin: Service Config Events ──────
export interface ServiceConfigCreated extends BaseEvent {
  event: "service_config created";
  properties: { entity: EntityRef; data: { slug: string; type: string } };
}

export interface ServiceConfigUpdated extends BaseEvent {
  event: "service_config updated";
  properties: { entity: EntityRef; data: { slug: string; fields: string[] } };
}

export interface ServiceConfigRestarted extends BaseEvent {
  event: "service_config restarted";
  properties: { entity: EntityRef; data: { slug: string } };
}

export interface ServiceConfigDeleted extends BaseEvent {
  event: "service_config deleted";
  properties: { entity: EntityRef; data: { slug: string } };
}

// ─── Schedule Audit: Rollback ───────────────────
export interface ScheduleRollback extends BaseEvent {
  event: "schedule rollback";
  properties: { entity: EntityRef; data: { audit_log_id: string } };
}

// ─── Governance / Training MVP — Phase 0 (ADR-0101..0106) ──────
export interface PolicyPublished extends BaseEvent {
  event: "policy published";
  properties: { entity: EntityRef; data: { policy_id: string } };
}

export interface ObserverRequestCreated extends BaseEvent {
  event: "observer_request created";
  properties: {
    entity: EntityRef;
    data: {
      subject_profile_id: string;
      protocol_assignment_id: string;
    };
  };
}

export interface ObserverRequestClaimed extends BaseEvent {
  event: "observer_request claimed";
  properties: {
    entity: EntityRef;
    data: { observer_profile_id: string };
  };
}

export interface ObserverRequestResolved extends BaseEvent {
  event: "observer_request resolved";
  properties: {
    entity: EntityRef;
    data: { resolution: "approved" | "rejected" | "expired" };
  };
}

export interface ApprovalRequested extends BaseEvent {
  event: "approval requested";
  properties: {
    entity: EntityRef;
    data: { approvers_needed: number };
  };
}

export interface ApprovalResolved extends BaseEvent {
  event: "approval resolved";
  properties: {
    entity: EntityRef;
    data: { resolution: "approved" | "rejected" };
  };
}

export interface ReminderSent extends BaseEvent {
  event: "reminder sent";
  properties: {
    entity: EntityRef;
    data: {
      subject_profile_id: string;
      tier: string;
      channel: string;
    };
  };
}

export interface ReminderOpened extends BaseEvent {
  event: "reminder opened";
  properties: {
    entity: EntityRef;
    data: { subject_profile_id: string };
  };
}

export interface ReminderConverted extends BaseEvent {
  event: "reminder converted";
  properties: {
    entity: EntityRef;
    data: { subject_profile_id: string };
  };
}

// ─── Billing Events ──────────────────────────────
// ADR-0118: C3 Commercial consumer. ADR-0125: route via billing_activity_log.
// BaseEvent.actor_id is profile_id for most events; for billing it is a
// user_identity.user_id (the billing_activity_log provider interprets it as
// such). activity_trail is never a destination for billing events.

export interface InvoiceGenerated extends BaseEvent {
  event: "invoice generated";
  properties: {
    entity_type: "invoice";
    entity_id: string;
    data: {
      company_id: string;
      amount_incl_vat: number;
      period_from: string;
      period_to: string;
    };
  };
}

export interface InvoiceIssued extends BaseEvent {
  event: "invoice issued";
  properties: {
    entity_type: "invoice";
    entity_id: string;
    data: {
      company_id: string;
      invoice_number: number;
      amount_incl_vat: number;
    };
  };
}

export interface InvoiceSent extends BaseEvent {
  event: "invoice sent";
  properties: {
    entity_type: "invoice";
    entity_id: string;
    // Per ADR-0128 + ADR-0144: delivery_channel + external_reference fields
    // removed in Fase 3A B6. Delivery-state lives on invoice_dispatch now.
    data: Record<string, never>;
  };
}

export interface InvoiceMarkedPaid extends BaseEvent {
  event: "invoice marked_paid";
  properties: {
    entity_type: "invoice";
    entity_id: string;
    data: {
      company_id: string;
      amount_incl_vat: number;
      payment_channel: string;
      payment_date: string;
      payment_reference: string;
    };
  };
}

export interface InvoiceVoided extends BaseEvent {
  event: "invoice voided";
  properties: {
    entity_type: "invoice";
    entity_id: string;
    data: {
      company_id: string;
      reason: string;
      reason_detail: string;
    };
  };
}

export interface InvoiceMarkedUncollectible extends BaseEvent {
  event: "invoice marked_uncollectible";
  properties: {
    entity_type: "invoice";
    entity_id: string;
    data: {
      company_id: string;
      reason: string;
      reason_detail: string;
    };
  };
}

export interface InvoiceOverdueDetected extends BaseEvent {
  event: "invoice overdue_detected";
  properties: {
    entity_type: "invoice";
    entity_id: string;
    data: {
      days_overdue: number;
      /** Denormalised for audit joins; cron writer sets this. */
      company_id?: string;
      /** Emit origin tag (cron|web|api). Provider reads this into
       *  billing_activity_log.source. */
      source?: string;
    };
  };
}

export interface InvoiceCreditNoteIssued extends BaseEvent {
  event: "invoice credit_note_issued";
  properties: {
    entity_type: "invoice";
    entity_id: string;
    data: {
      original_invoice_id: string;
      amount_incl_vat: number;
      reason: string;
    };
  };
}

export interface InvoiceBasisDriftDetected extends BaseEvent {
  event: "invoice basis_drift_detected";
  properties: {
    entity_type: "basis_drift_event";
    entity_id: string;
    data: {
      invoice_id: string | null;
      shift_id: string | null;
      drift_type: string;
    };
  };
}

export interface UsageSnapshotCreated extends BaseEvent {
  event: "usage_snapshot created";
  properties: {
    entity_type: "usage_snapshot";
    entity_id: string;
    data: {
      workspace_id: string;
      company_id: string;
      billable_users: number;
    };
  };
}

// Separate interface from the legacy `PricingTermsUpdated` (event name
// "pricing terms updated", contracts category) — both events coexist. The
// billing event uses the underscore form `pricing_terms updated` and routes
// to `billing_activity_log` per ADR-0125.
export interface BillingPricingTermsUpdated extends BaseEvent {
  event: "pricing_terms updated";
  properties: {
    entity_type: "pricing_terms";
    entity_id: string;
    changes: Record<string, { before: unknown; after: unknown }>;
  };
}

export interface DunningNoteAdded extends BaseEvent {
  event: "dunning_note added";
  properties: {
    entity_type: "invoice";
    entity_id: string;
    data: {
      note: string;
    };
  };
}

// ─── Billing Fase 2 — Dispatch ─────────────────────
// Dispatch-related events. "channel" uses billing_dispatch_channel enum
// values. `integration_sync mocked` is the audit-honest mock-adapter emit
// per ADR-0129; readers must NOT treat it as `succeeded`.

export interface InvoiceDispatched extends BaseEvent {
  event: "invoice dispatched";
  properties: {
    entity_type: "invoice_dispatch";
    entity_id: string;
    data: {
      invoice_id: string;
      channel: string;
      external_reference: string | null;
    };
  };
}

export interface InvoiceDispatchFailed extends BaseEvent {
  event: "invoice dispatch failed";
  properties: {
    entity_type: "invoice_dispatch";
    entity_id: string;
    data: {
      invoice_id: string;
      channel: string;
      error_code: string;
      error_message: string;
      attempts: number;
    };
  };
}

export interface InvoiceDispatchRetried extends BaseEvent {
  event: "invoice dispatch retried";
  properties: {
    entity_type: "invoice_dispatch";
    entity_id: string;
    data: {
      invoice_id: string;
      channel: string;
      attempt: number;
    };
  };
}

export interface InvoiceDispatchRetryRequested extends BaseEvent {
  event: "invoice dispatch retry_requested";
  properties: {
    entity_type: "invoice_dispatch";
    entity_id: string;
    data: {
      invoice_id: string;
      requested_by: string;
    };
  };
}

// ─── Billing Fase 2 — Integration ───────────────────

export interface IntegrationSyncSucceeded extends BaseEvent {
  event: "integration sync succeeded";
  properties: {
    entity_type: "billing_integration";
    entity_id: string;
    data: {
      integration_type: string;
      entity_type_synced: string;
      entity_id_synced: string;
      operation: "create" | "update" | "delete";
      external_reference: string | null;
    };
  };
}

export interface IntegrationSyncFailed extends BaseEvent {
  event: "integration sync failed";
  properties: {
    entity_type: "billing_integration";
    entity_id: string;
    data: {
      integration_type: string;
      entity_type_synced: string;
      entity_id_synced: string;
      operation: "create" | "update" | "delete";
      error_code: string;
      error_message: string;
    };
  };
}

// ADR-0129: PlaceholderAdapter emits `mocked`, NOT `succeeded`. Audit
// readers must keep both paths distinct to preserve truth in the log.
export interface IntegrationSyncMocked extends BaseEvent {
  event: "integration sync mocked";
  properties: {
    entity_type: "billing_integration";
    entity_id: string;
    data: {
      integration_type: "placeholder";
      entity_type_synced: string;
      entity_id_synced: string;
      operation: "create" | "update" | "delete";
    };
  };
}

export interface IntegrationTestConnectionSucceeded extends BaseEvent {
  event: "integration test_connection succeeded";
  properties: {
    entity_type: "billing_integration";
    entity_id: string;
    data: {
      integration_type: string;
      is_placeholder: boolean;
    };
  };
}

export interface IntegrationTestConnectionFailed extends BaseEvent {
  event: "integration test_connection failed";
  properties: {
    entity_type: "billing_integration";
    entity_id: string;
    data: {
      integration_type: string;
      error_code: string;
      error_message: string;
    };
  };
}

// ADR-0129 fail-safe: fired when a real adapter returns `succeeded` on an
// integration row flagged `is_placeholder=true`, OR when the
// PlaceholderAdapter reports `succeeded` instead of `mocked`. Either case
// corrupts the audit trail, so we emit LOUD and abort the engine step.
export interface IntegrationAuditViolation extends BaseEvent {
  event: "integration audit violation";
  properties: {
    entity_type: "billing_integration";
    entity_id: string;
    data: {
      integration_type: string;
      is_placeholder: boolean;
      reported_status: string;
      violation_kind: "placeholder_reported_succeeded" | "real_adapter_on_placeholder_row";
      entity_type_synced: string;
      entity_id_synced: string;
    };
  };
}

// ─── Billing Fase 3B — EHF CSV/PDF export (platform-admin) ──
// Fase 3B leverer månedlig eksport-pakke som regnskapsfører bruker til
// å sende EHF-fakturaer eksternt (utenfor Smartout). Regnskapsfører
// markerer deretter fakturaer betalt manuelt via eksisterende Fase 2
// mark-paid-flyt.
//
// Eksporten bundler det platform-admin velger: CSV og/eller PDF,
// samlet og/eller per-workspace. Event firer én gang per eksport-
// generering med data.format[] + data.grouping[] + fakturaliste for
// audit. Logger + billing_activity_log er nok — ingen PostHog-metric
// fordi volumet er lavt (månedlig manuell click).

export interface BillingEhfExportGenerated extends BaseEvent {
  event: "billing ehf_export_generated";
  properties: {
    entity_type: "company"; // Smartouts egen company_id (platform-scope)
    entity_id: string;
    data: {
      period_start: string; // ISO date, month-start
      period_end: string; // ISO date, month-end (inclusive)
      format: ReadonlyArray<"csv" | "pdf">;
      grouping: ReadonlyArray<"bundled" | "per_workspace">;
      invoice_count: number;
      workspace_count: number;
      total_amount_incl_vat: number;
      currency: string;
    };
  };
}

// Firer når platform-admin markerer en faktura betalt manuelt på
// regnskapsførerens melding. Fase 2's mark-paid allerede eksisterer —
// dette eventet er det eksplisitte "accountant reported paid" sporet
// slik at vi kan skille accountant-manual fra workspace-admin-manual i
// billing_activity_log.
export interface BillingAccountantMarkedPaid extends BaseEvent {
  event: "billing accountant_marked_paid";
  properties: {
    entity_type: "invoice";
    entity_id: string;
    data: {
      workspace_id: string;
      payment_reference: string | null; // fritext: "Melding fra regnskapsfører 2026-04"
      amount: number;
      currency: string;
    };
  };
}

// ─── Billing Fase 2 — Invoice editing ───────────────

export interface InvoiceLineItemAdded extends BaseEvent {
  event: "invoice line_item added";
  properties: {
    entity_type: "invoice_line_item";
    entity_id: string;
    data: {
      invoice_id: string;
      line_type: string;
      amount_incl_vat: number;
    };
  };
}

export interface InvoiceLineItemEdited extends BaseEvent {
  event: "invoice line_item edited";
  properties: {
    entity_type: "invoice_line_item";
    entity_id: string;
    changes: Record<string, { before: unknown; after: unknown }>;
    // Required for billing_activity_log company_id resolution — the
    // provider walks from invoice_id → company_id. Without this the row
    // is rejected (see providers/billing-activity-log.ts).
    data: {
      invoice_id: string;
    };
  };
}

export interface InvoiceLineItemRemoved extends BaseEvent {
  event: "invoice line_item removed";
  properties: {
    entity_type: "invoice_line_item";
    entity_id: string;
    data: {
      invoice_id: string;
    };
  };
}

export interface InvoiceAdhocCreated extends BaseEvent {
  event: "invoice adhoc_created";
  properties: {
    entity_type: "invoice";
    entity_id: string;
    data: {
      company_id: string;
      amount_incl_vat: number;
    };
  };
}

export interface WorkspaceMarkedPaid extends BaseEvent {
  event: "workspace marked_paid";
  properties: {
    entity_type: "invoice";
    entity_id: string;
    data: {
      invoice_id: string;
      payment_date: string;
      payment_reference: string;
    };
  };
}

// ─── Billing Fase 2 — Rule / Integration CRUD ───────

export interface DispatchRuleCreated extends BaseEvent {
  event: "dispatch_rule created";
  properties: {
    entity_type: "billing_dispatch_rule";
    entity_id: string;
    data: {
      workspace_id: string | null;
      channel: string;
      trigger_event: string;
      action: "send" | "suppress";
    };
  };
}

export interface DispatchRuleUpdated extends BaseEvent {
  event: "dispatch_rule updated";
  properties: {
    entity_type: "billing_dispatch_rule";
    entity_id: string;
    changes: Record<string, { before: unknown; after: unknown }>;
  };
}

export interface DispatchRuleDeleted extends BaseEvent {
  event: "dispatch_rule deleted";
  properties: {
    entity_type: "billing_dispatch_rule";
    entity_id: string;
    data: {
      workspace_id: string | null;
    };
  };
}

export interface IntegrationCreated extends BaseEvent {
  event: "integration created";
  properties: {
    entity_type: "billing_integration";
    entity_id: string;
    data: {
      integration_type: string;
      is_placeholder: boolean;
      workspace_id: string | null;
    };
  };
}

export interface IntegrationUpdated extends BaseEvent {
  event: "integration updated";
  properties: {
    entity_type: "billing_integration";
    entity_id: string;
    changes: Record<string, { before: unknown; after: unknown }>;
  };
}

export interface IntegrationDeleted extends BaseEvent {
  event: "integration deleted";
  properties: {
    entity_type: "billing_integration";
    entity_id: string;
    data: {
      integration_type: string;
    };
  };
}

// Debug-only: per-invoice rule-evaluation summary. Logger-only destination
// helps reconstruct "why didn't the invoice go to X?" in production.
export interface DispatchRuleEvaluated extends BaseEvent {
  event: "dispatch_rule evaluated";
  properties: {
    entity_type: "invoice";
    entity_id: string;
    data: {
      trigger_event: string;
      platform_rule_count: number;
      workspace_rule_count: number;
      suppressed_count: number;
      final_dispatch_count: number;
    };
  };
}

// ─── Billing Fase 3A — Stripe Payments + Dunning ───
//
// Payment lifecycle events drive the platform-admin /billing/payments
// dashboard + trigger dunning suppression when an overdue invoice
// settles mid-cycle. All seven events route through billing_activity_log
// per ADR-0125 (platform audit stream). payment_attempt PII-read is a
// trigger-based audit that fires when platform-admin SELECTs the
// redacted_payload column (ADR-0141 sensitivity tagging).

export interface PaymentInitiated extends BaseEvent {
  event: "payment initiated";
  properties: {
    entity_type: "payment";
    entity_id: string;
    data: {
      invoice_id: string;
      company_id: string;
      amount: number;
      currency: string;
      payment_method: string;
    };
  };
}

export interface PaymentSucceeded extends BaseEvent {
  event: "payment succeeded";
  properties: {
    entity_type: "payment";
    entity_id: string;
    data: {
      invoice_id: string;
      company_id: string;
      amount: number;
      currency: string;
      external_id: string | null;
      // true when this payment brought sum(payments) >= invoice.amount_incl_vat
      // and the webhook flipped invoice.status → paid.
      invoice_settled: boolean;
    };
  };
}

// Routed to posthog (surfaces in alerting) + billing_activity_log. Treat
// this as the "alert" destination noted in spec §11 — Smartout's PostHog
// has alerting hooks for this event via saved-insight trigger.
export interface PaymentFailed extends BaseEvent {
  event: "payment failed";
  properties: {
    entity_type: "payment";
    entity_id: string;
    data: {
      invoice_id: string;
      company_id: string;
      amount: number;
      currency: string;
      external_id: string | null;
      error_code: string;
      error_message: string;
    };
  };
}

export interface PaymentRefunded extends BaseEvent {
  event: "payment refunded";
  properties: {
    entity_type: "payment";
    entity_id: string;
    data: {
      invoice_id: string;
      company_id: string;
      refunded_amount: number;
      currency: string;
      // "full" when refunded_amount == payment.amount, "partial" otherwise.
      // ADR-0142: full refund → auto credit-note; partial → credit-note
      // line only. Downstream credit-note auto-creation emits a separate
      // InvoiceCreditNoteAutoCreated event.
      refund_type: "full" | "partial";
    };
  };
}

export interface InvoiceDunningEscalated extends BaseEvent {
  event: "invoice dunning_escalated";
  properties: {
    entity_type: "invoice";
    entity_id: string;
    data: {
      // NULL on the very first escalation (e.g. issued → reminder_1).
      from_stage: string | null;
      to_stage: string;
      days_overdue: number;
      company_id: string;
    };
  };
}

// ADR-0142: distinct from the manual "invoice credit_note_issued" event.
// The _auto_created variant is emitted only when charge.refunded webhook
// triggers the automatic credit-note creation path.
export interface InvoiceCreditNoteAutoCreated extends BaseEvent {
  event: "invoice credit_note_auto_created";
  properties: {
    entity_type: "invoice";
    entity_id: string;
    data: {
      original_invoice_id: string;
      payment_id: string;
      amount_incl_vat: number;
      currency: string;
      trigger_type: "full_refund" | "partial_refund";
    };
  };
}

// ADR-0141: fires when a platform-admin reads payment_attempt.redacted_payload.
// Logger + billing_activity_log only — the audit stream IS the alert. No
// PostHog routing (these reads are normal support traffic and would
// overwhelm the dashboard).
export interface PlatformAdminPiiRead extends BaseEvent {
  event: "platform_admin_pii_read";
  properties: {
    entity_type: "payment_attempt";
    entity_id: string;
    data: {
      // Reason code from the platform-admin UI ("refund_investigation",
      // "dispute_response", "compliance_audit", "other"). Captured at
      // read-time so the audit trail shows WHY the PII was accessed.
      reason: string;
      payment_id: string;
    };
  };
}

// ─── Journey Engine Events (ADR-0175, S1.1 2026-04-22) ──
// Five events span the Journey Engine lifecycle: run start, per-step,
// completion, timeout-detection (stuck), and terminal failure. All five
// route to 4 destinations (posthog + logger + activity_trail + engine_event)
// so the mission state machine, analytics, audit trail, and Fjernkontroll
// card all see the same truth.
//
// Naming: registry keys use the space convention (e.g., "journey run_started").
// The dot form ("journey.run_started") is the post-toDotNotation() wire
// format consumed by engine-dispatch. Do NOT use dots in registry keys.
//
// Payload shape: FLAT (entity_type/entity_id/entity_label at properties
// root) + a nested `entity` block until broader L-0064 parity lands. The
// widened activity_trail resolver (resolveEntityRef in providers/activity-trail.ts)
// accepts both shapes; the nested block is carried here so we don't rely on
// that widening for this one family of events.
//
// `actor_id` + `workspace_id` are non-optional per ADR-0134 (mobile
// telemetry contract). Both come from the BaseEvent shape; BaseEvent
// declares `workspace_id: string | null` project-wide, but journey runtime
// paths MUST resolve non-null workspace via getProfileContext() before
// emit — enforced at the capability layer (S1.4), not at the registry.
export type JourneyCapability =
  | "journey.run_dev"
  | "journey.publish_mission"
  | "journey.publish_guide"
  | "journey.run_guided";

export type JourneySurface = "dev" | "admin" | "runtime_web" | "runtime_mobile";

export interface JourneyRunStarted extends BaseEvent {
  event: "journey run_started";
  properties: {
    journey_version_id: string;
    run_id: string;
    actor_id: string; // non-null per ADR-0134; duplicated from BaseEvent for ergonomics at call sites
    workspace_id: string; // non-null per ADR-0134
    capability: JourneyCapability;
    surface: JourneySurface;
    entity: {
      entity_type: "journey_run";
      entity_id: string; // = run_id
      entity_label: string; // human-readable run label
    };
  };
}

export interface JourneyStepReached extends BaseEvent {
  event: "journey step_reached";
  properties: {
    run_id: string;
    step_key: string;
    step_index: number;
    actor_id: string;
    workspace_id: string;
    entity: {
      entity_type: "journey_run";
      entity_id: string; // = run_id
      entity_label: string;
    };
  };
}

export interface JourneyCompleted extends BaseEvent {
  event: "journey completed";
  properties: {
    run_id: string;
    final_step: string;
    duration_ms: number;
    actor_id: string;
    workspace_id: string;
    entity: {
      entity_type: "journey_run";
      entity_id: string; // = run_id
      entity_label: string;
    };
  };
}

export interface JourneyStuck extends BaseEvent {
  event: "journey stuck";
  properties: {
    run_id: string;
    step_key: string;
    timeout_ms: number;
    actor_id: string;
    workspace_id: string;
    entity: {
      entity_type: "journey_run";
      entity_id: string; // = run_id
      entity_label: string;
    };
  };
}

export interface JourneyRunFailed extends BaseEvent {
  event: "journey run_failed";
  properties: {
    run_id: string;
    step_key: string;
    error_code: string;
    error_message: string;
    actor_id: string;
    workspace_id: string;
    entity: {
      entity_type: "journey_run";
      entity_id: string; // = run_id
      entity_label: string;
    };
  };
}

// ─── Journey Authoring Events (M4, ADR-0172 / ADR-0175) ──
// The five RUN-time events above cover capability invocations (run_dev,
// publish_*, run_guided). The four AUTHORING events below cover the
// journey_version row lifecycle on the admin UI:
//
//   journey_version created       — insert
//   journey_version saved         — update of title/slug/module/ir_json
//   journey_version transitioned  — journey_version_status change (ADR-0172)
//   journey_version archived      — terminal transition (emitted in addition
//                                   to "transitioned" for clarity in audit)
//
// These fire from Server Actions under
// apps/web/src/app/platform-admin/journeys/versions/actions/*.
// Destinations match the run-time pattern: posthog + logger + activity_trail.
// engine_event is NOT a destination — authoring does not drive the mission
// state machine (that's run-time's job).

export interface JourneyVersionCreated extends BaseEvent {
  event: "journey_version created";
  properties: {
    journey_version_id: string;
    journey_id: string;
    version_number: number;
    actor_id: string;
    workspace_id: string;
    entity: {
      entity_type: "journey_version";
      entity_id: string; // = journey_version_id
      entity_label: string;
    };
  };
}

export interface JourneyVersionSaved extends BaseEvent {
  event: "journey_version saved";
  properties: {
    journey_version_id: string;
    actor_id: string;
    workspace_id: string;
    fields_changed: ReadonlyArray<string>; // e.g. ["ir_json", "status"]
    entity: {
      entity_type: "journey_version";
      entity_id: string;
      entity_label: string;
    };
  };
}

// Mirrors Database["public"]["Enums"]["journey_version_status"] — kept as
// a local literal union so the telemetry package stays free of a
// @smartout/supabase dependency. Update here when the SQL enum changes.
export type JourneyVersionStatusLiteral =
  | "draft"
  | "ready_test"
  | "testing"
  | "ready_publish"
  | "published"
  | "archived";

export interface JourneyVersionTransitioned extends BaseEvent {
  event: "journey_version transitioned";
  properties: {
    journey_version_id: string;
    from_status: JourneyVersionStatusLiteral;
    to_status: JourneyVersionStatusLiteral;
    actor_id: string;
    workspace_id: string;
    entity: {
      entity_type: "journey_version";
      entity_id: string;
      entity_label: string;
    };
  };
}

export interface JourneyVersionArchived extends BaseEvent {
  event: "journey_version archived";
  properties: {
    journey_version_id: string;
    actor_id: string;
    workspace_id: string;
    entity: {
      entity_type: "journey_version";
      entity_id: string;
      entity_label: string;
    };
  };
}

// ─── Journey Authoring Wizard Events (ADR-0239) ──────────────────
// Two events for the wizard runtime. phase_advanced fires per save_draft
// with a next_phase set; journey_published fires once at publish_draft
// success. Both route to all 4 destinations (engine_event drives the
// closed-loop dashboard FLOW.md spine).

export type JourneyAuthoringPhase =
  | "discovery"
  | "classification"
  | "steps"
  | "testing"
  | "documentation"
  | "review";

export interface JourneyAuthoringPhaseAdvanced extends BaseEvent {
  event: "journey_authoring phase_advanced";
  properties: {
    wizard_session_id: string;
    phase: JourneyAuthoringPhase;
    actor_id: string;
    workspace_id: string;
    entity: {
      entity_type: "wizard_session";
      entity_id: string; // = wizard_session_id
      entity_label: string;
    };
  };
}

export interface JourneyAuthoringJourneyPublished extends BaseEvent {
  event: "journey_authoring journey_published";
  properties: {
    wizard_session_id: string;
    journey_id: string;
    journey_version_id: string;
    mission_id?: string; // populated once journey.publish_mission has run
    actor_id: string;
    workspace_id: string;
    entity: {
      entity_type: "journey";
      entity_id: string; // = journey_id
      entity_label: string;
    };
  };
}

// ─── Availability Events (ADR-0200 — campaign/daily-operation sortie 2) ──
// Three events for the employee-availability D2 capability family.
// Naming: registry keys use the DOT convention (e.g. "availability.set_own")
// per L-0129 and the 2026-04-23 Council K1 verdict. Historical space-form
// keys were renamed during supervisor review of sortie 2 before any emit
// code shipped.
//
// Payload shape: FLAT (entity_type/entity_id at properties root + nested
// data block), matching the shift_lifecycle family pattern. The registry
// widened activity_trail resolver accepts both the flat and nested shapes.
//
// set_own + cleared route to 4 destinations (posthog + logger + activity_trail
// + engine_event) — these are state mutations; engine_event drives downstream
// processes (e.g. schedule demand recalculation when availability changes).
// queried routes to 3 destinations (no engine_event) — queries are not state
// mutations, so engine_event would just pollute (L-0023).
export interface AvailabilitySetOwn extends BaseEvent {
  event: "availability.set_own";
  properties: {
    entity_type: "availability";
    entity_id: string; // = availability_id
    data: {
      availability_id: string;
      profile_id: string;
      workspace_id: string;
      preference_type: string;
      valid_from: string;
      valid_to: string | null;
      rrule: string | null;
    };
  };
}
export interface AvailabilityCleared extends BaseEvent {
  event: "availability.cleared";
  properties: {
    entity_type: "availability";
    entity_id: string; // = availability_id
    data: {
      availability_id: string;
      profile_id: string;
      workspace_id: string;
    };
  };
}
export interface AvailabilityQueried extends BaseEvent {
  event: "availability.queried";
  properties: {
    entity_type: "availability";
    // No single entity for a query — caller passes workspace_id as correlation.
    entity_id: string;
    data: {
      profile_id_filter: string[] | null;
      start_date: string;
      end_date: string;
      result_count: number;
    };
  };
}

// ─── Payroll Capability Events (ADR-0242, Wave 3 B7) ─────────────────────────
// Six events for the payroll capability family.
// update_payroll_profile + set_pension_scheme: state mutations → 4 destinations.
// tax_card_queried + salary_queried: read-only → PostHog + Logger + activity_trail (no engine_event).
// pii.revealed: audit-only → all 4 destinations (compliance trace).
//
// Naming: dot convention (payroll.*) per L-0129 registry naming standard.

export interface PayrollUpdatePayrollProfile extends BaseEvent {
  event: "payroll.update_payroll_profile";
  properties: {
    entity: EntityRef;
    data: {
      target_profile_id: string;
      fields_updated: string[];
      gate_evaluation_id: string | null;
    };
  };
}

export interface PayrollSetPensionScheme extends BaseEvent {
  event: "payroll.set_pension_scheme";
  properties: {
    entity: EntityRef;
    data: {
      target_profile_id: string;
      pension_scheme_id: string;
      gate_evaluation_id: string | null;
    };
  };
}

export interface PayrollTaxCardQueried extends BaseEvent {
  event: "payroll.tax_card_queried";
  properties: {
    entity: EntityRef;
    data: {
      target_profile_id: string;
      is_self: boolean;
    };
  };
}

export interface PayrollSalaryQueried extends BaseEvent {
  event: "payroll.salary_queried";
  properties: {
    entity: EntityRef;
    data: {
      target_profile_id: string;
      period_month: string | null;
      is_self: boolean;
    };
  };
}

// ─── Contract Module Events (ADR-0243, ADR-0244, Wave 3 B7) ──────────────────
// Events for contract obligations, amendments, and PII reveal.
// obligation_overdue + obligation_due_soon: state mutations → 4 destinations.
// amendment_proposed + amendment_signed + amendment_declined: 4 destinations.
// acknowledgement.block_confirmed (ADR-0244): 4 destinations.
// pii.revealed (ADR-0242): all 4 destinations (compliance trace).

export interface ContractObligationOverdue extends BaseEvent {
  event: "contract.obligation_overdue";
  properties: {
    entity: EntityRef;
    data: {
      obligation_id: string;
      contract_id: string;
      obligation_type: string;
      title: string;
      due_at: string;
      is_blocker: boolean;
      automated: boolean;
    };
  };
}

export interface ContractObligationDueSoon extends BaseEvent {
  event: "contract.obligation_due_soon";
  properties: {
    entity: EntityRef;
    data: {
      obligation_id: string;
      contract_id: string;
      obligation_type: string;
      title: string;
      due_at: string;
      days_remaining: number;
      is_blocker: boolean;
    };
  };
}

export interface ContractAmendmentProposed extends BaseEvent {
  event: "contract.amendment_proposed";
  properties: {
    entity: EntityRef;
    data: {
      amendment_id: string;
      contract_id: string;
      classification: "material" | "admin" | "derived" | "system";
      requires_employee_signature: boolean;
      is_constructive_dismissal_risk: boolean;
      changed_fields: string[];
    };
  };
}

export interface ContractAmendmentSigned extends BaseEvent {
  event: "contract.amendment_signed";
  properties: {
    entity: EntityRef;
    data: {
      amendment_id: string;
      contract_id: string;
      signed_by: "employee" | "employer" | "both";
    };
  };
}

export interface ContractAmendmentDeclined extends BaseEvent {
  event: "contract.amendment_declined";
  properties: {
    entity: EntityRef;
    data: {
      amendment_id: string;
      contract_id: string;
      declined_by: "employee" | "employer";
      reason?: string;
    };
  };
}

export interface ContractAcknowledgementBlockConfirmed extends BaseEvent {
  event: "contract.acknowledgement.block_confirmed";
  properties: {
    entity: EntityRef;
    data: {
      obligation_id: string;
      contract_id: string;
      /** True when the admin acknowledged constructive dismissal risk (Aml. §15-7) */
      is_constructive_dismissal_risk: boolean;
      acknowledged_by: string;
    };
  };
}

export interface ContractPiiRevealed extends BaseEvent {
  event: "contract.pii.revealed";
  properties: {
    entity: EntityRef;
    data: {
      pii_field: string;
      /** True when actual value was returned; false for presence-only checks */
      revealed: boolean;
      target_profile_id: string;
      is_self: boolean;
    };
  };
}

export interface ContractReadinessSelfFillRequested extends BaseEvent {
  event: "contract.readiness.self_fill_requested";
  properties: {
    entity: EntityRef;
    data: {
      target_profile_id: string;
      missing: string[];
    };
  };
}

// ─── Contract Wave 4 Events (ADR-0241/0234/0236, Wave 4 UI) ──────────────────
// employment_contract.upserted_inline: server action from people-page HR-tab →
//   4 destinations so engine_event can react to profile changes.
// contracts.compose.template_selected: UX funnel analytics (compose drawer step 1).
// contract.send_initiated: dispatch drawer send action → 4 destinations (C4 audit).
// contract.signing_link_opened: employee clicks sign link → 3 destinations (read).
// contract.obligation_assigned: admin assigns obligation → 4 destinations.
// contract.obligation_completed: employee completes obligation → 4 destinations.
// contract.pdf_preview_viewed: REQUIRED gate per ADR-0244 before AcknowledgementRing → 4.

export interface EmploymentContractUpsertedInline extends BaseEvent {
  event: "employment_contract.upserted_inline";
  properties: {
    entity: EntityRef;
    data: {
      target_profile_id: string;
      section: "ansettelse" | "lonnsprofil" | "tipsregel";
      fields_updated: string[];
      contract_id: string | null;
    };
  };
}

export interface ContractsComposeTemplateSelected extends BaseEvent {
  event: "contracts.compose.template_selected";
  properties: {
    entity: EntityRef;
    data: {
      template_id: string;
      target_profile_id: string;
      employment_category: string | null;
    };
  };
}

export interface ContractSendInitiated extends BaseEvent {
  event: "contract.send_initiated";
  properties: {
    entity: EntityRef;
    data: {
      contract_id: string;
      template_id: string;
      target_profile_id: string;
      blocks_acknowledged: string[];
      framework_snapshot_frozen: boolean;
    };
  };
}

export interface ContractSigningLinkOpened extends BaseEvent {
  event: "contract.signing_link_opened";
  properties: {
    entity: EntityRef;
    data: {
      contract_id: string;
      target_profile_id: string;
      is_self: boolean;
    };
  };
}

export interface ContractObligationAssigned extends BaseEvent {
  event: "contract.obligation_assigned";
  properties: {
    entity: EntityRef;
    data: {
      obligation_id: string;
      contract_id: string;
      obligation_type: string;
      protocol_id: string | null;
      is_blocker: boolean;
      due_within_days: number | null;
    };
  };
}

export interface ContractObligationCompleted extends BaseEvent {
  event: "contract.obligation_completed";
  properties: {
    entity: EntityRef;
    data: {
      obligation_id: string;
      contract_id: string;
      obligation_type: string;
      protocol_id: string | null;
      completed_at: string;
    };
  };
}

export interface ContractPdfPreviewViewed extends BaseEvent {
  event: "contract.pdf_preview_viewed";
  properties: {
    entity: EntityRef;
    data: {
      contract_id: string;
      template_id: string;
      viewed_at: string;
    };
  };
}

// ─── Legal Capability (ADR-0249, Phase 0c) ───────────────────────────────────
// Three events: legal.aml_14_6.validated, legal.law_cited, legal.amendment_classified.
// All require non-empty workspace_id + actor_id per ADR-0193.
// emitPrefix: "legal" per ADR-0194 (collision-checked in getAllCapabilities()).

// Fired by validate_aml_14_6 tool — mandatory gate before contract dispatch.
export interface LegalAml146Validated extends BaseEvent {
  event: "legal.aml_14_6.validated";
  properties: {
    entity: EntityRef; // entity_type: "employment_contract"
    data: {
      contract_id: string;
      validation_mode: "strict" | "advisory";
      pass: boolean;
      status: "passes" | "missing_fields" | "warnings" | "skip";
      error_count: number;
      warning_count: number;
      validator_version: string;
      /** Phase 0c stub marker — remove when Lovdata MCP integration lands. */
      stub?: boolean;
    };
  };
}

// Fired by cite_law tool — law paragraph lookup on chat or voice.
export interface LegalLawCited extends BaseEvent {
  event: "legal.law_cited";
  properties: {
    data: {
      query: string;
      lov: string | null;
      paragraph: string;
      version: string;
      confidence: "HØY" | "MEDIUM" | "LAV";
      stub?: boolean;
    };
  };
}

// Fired by classify_amendment tool — server-only field-change classification.
// 5-year audit retention per Bokføringsloven §13 via activity_trail destination.
export interface LegalAmendmentClassified extends BaseEvent {
  event: "legal.amendment_classified";
  properties: {
    entity: EntityRef; // entity_type: "employment_contract"
    data: {
      contract_id: string;
      field_count: number;
      classifications: Array<{
        classification: string;
        requires_resigning: boolean;
        confidence: string;
      }>;
      stub?: boolean;
    };
  };
}

// ────────────── Help Hub (ADR-0219) ──────────────
// /dashboard/help — Multi-Tier Hub telemetry.
// All events require non-empty workspace_id + actor_id per ADR-0134.

// Fired when the user submits a query in the Botsson chat hero or search bar.
export interface HelpSearchPerformedEvent extends BaseEvent {
  event: "help.search_performed";
  properties: {
    query: string;
    result_count: number;
    source: "botsson_hero" | "kb_search";
  };
  entity: EntityRef; // entity_type: "profile" — the searching user
}

// Fired when the user opens a KB article from Tier 3 (curated list) or Tier 2
// (quick-path card destination).
export interface HelpArticleOpenedEvent extends BaseEvent {
  event: "help.article_opened";
  properties: {
    article_id: string;
    source: "curated" | "quick_path" | "botsson_reply";
  };
  entity: EntityRef; // entity_type: "profile" — the reading user
}

// Fired when the Panic Bar routes a request to helpdesk_query.openTicket via
// the Server Action. Carries the resulting engine_state.id as ticket_id.
export interface HelpEscalatedToTicketEvent extends BaseEvent {
  event: "help.escalated_to_ticket";
  properties: {
    ticket_id: string; // engine_state.id for the created helpdesk ticket
    panic_category: "locked_out" | "shift_wrong" | "human";
  };
  entity: EntityRef; // entity_type: "profile" — the escalating user
}

// Fired when the user clicks "Les opp" (TTS) on a KB article or Botsson reply.
// Routes posthog-only: low-value for audit trail, high-value for UX analytics.
export interface HelpTtsInvokedEvent extends BaseEvent {
  event: "help.tts_invoked";
  properties: {
    content_id: string; // article_id or engine_state.id for Botsson reply
    content_type: "kb_article" | "botsson_reply";
    duration_ms: number | null; // null if user cancelled before end
  };
}

// Fired when the user invokes "Forklar enkelt" to simplify content via
// server-side capability rewrite (I-4 invariant). NOT client-side simplification.
export interface HelpForklarEnkeltInvokedEvent extends BaseEvent {
  event: "help.forklar_enkelt_invoked";
  properties: {
    content_id: string; // article_id or message_id being simplified
    content_type: "kb_article" | "botsson_reply";
  };
  entity: EntityRef; // entity_type: "profile" — the requesting user
}

// Fired when the active-ticket badge renders in the Help Hub header and the
// count is non-zero. Gives product signal on how many users have open tickets.
// workspace_id + actor_id from BaseEvent per ADR-0134.
export interface HelpActiveTicketBadgeViewedEvent extends BaseEvent {
  event: "help.active_ticket_badge_viewed";
  properties: {
    ticket_count: number; // number of open tickets shown in the badge
    role: "employee" | "admin" | "manager"; // viewer's role in the workspace
  };
}

// Fired when the user clicks the active-ticket badge to navigate to the ticket
// thread or the ticket list. Distinguishes between target contexts.
// workspace_id + actor_id from BaseEvent per ADR-0134.
export interface HelpActiveTicketBadgeClickedEvent extends BaseEvent {
  event: "help.active_ticket_badge_clicked";
  properties: {
    channel_id?: NonEmptyString; // engine_state.id for the linked ticket thread
    role: "employee" | "admin" | "manager"; // clicker's role in the workspace
    target?: "thread" | "list"; // where the badge click navigated to
  };
}

// Fired each time the tour harness invokes a tool step (navigate_to or
// highlight_element). Routes posthog + activity_trail so UX and audit
// both capture step-level fidelity. reduced_motion reflects the user's
// prefers-reduced-motion media query at invocation time.
// Dual-registered per L-0072: interface + runtime EVENT_ROUTING entry.
export interface HelpTourStepInvokedEvent extends BaseEvent {
  event: "help.tour_step_invoked";
  properties: {
    workspaceId: NonEmptyString;
    actorId: NonEmptyString;
    tool: "navigate_to" | "highlight_element";
    target_id:
      | "panic_bar"
      | "chat_hero"
      | "active_ticket_badge"
      | "quick_paths"
      | "curated_articles"
      | "kontakt_footer";
    reduced_motion: boolean;
  };
}

// Fired when the user completes the entire tour harness sequence without
// cancelling. step_count and duration_ms give product signal on drop-off.
// Dual-registered per L-0072.
export interface HelpTourCompletedEvent extends BaseEvent {
  event: "help.tour_completed";
  properties: {
    workspaceId: NonEmptyString;
    actorId: NonEmptyString;
    step_count: number;
    duration_ms: number;
  };
}

// Fired when the tour is dismissed before completion. trigger distinguishes
// keyboard (esc) from pointer (off_target_click) so UX can refine anchoring.
// step_count = index of the last step shown before cancellation.
// Dual-registered per L-0072.
export interface HelpTourCancelledEvent extends BaseEvent {
  event: "help.tour_cancelled";
  properties: {
    workspaceId: NonEmptyString;
    actorId: NonEmptyString;
    trigger: "esc" | "off_target_click";
    step_count: number;
  };
}

// ─── Governance content lifecycle (M2.3) ────────
// Fired by governance Server Actions (update-policy / update-protocol /
// update-handbook-chapter) AFTER successful gateAction + DB UPDATE/INSERT.
// Routes posthog + activity_trail + engine_event so engine-dispatch picks
// it up and triggers ingest-workspace-knowledge for source-targeted
// re-ingest into workspace_doc_chunk. ≤30s lag goal per spec I-1.
// Discriminator design (Q1 default): single event with source_type field
// rather than three separate events — cheaper to maintain registry.
export interface GovernanceContentUpdatedEvent extends BaseEvent {
  event: "governance.content_updated";
  properties: {
    source_type: "handbook_chapter" | "policy" | "protocol";
    source_id: NonEmptyString;
    trigger: "create" | "update" | "delete";
  };
}

// ─── Page-takeover lifecycle (M3.2 — ADR-0228) ─────
// Three-event sequence per invocation: proposed -> (confirmed | cancelled) ->
// executed (only after confirmed). G-AUDIT merge-blocker: action_executed
// MUST have matching action_proposed + action_confirmed predecessors.
// All four events route posthog + activity_trail. Default-deny per
// ADR-0228 — gateAction denial precedes action_proposed (no event when denied).

export type PageTakeoverActionType = "click" | "submit_form" | "wait_for_state";

export interface PageTakeoverActionProposedEvent extends BaseEvent {
  event: "page_takeover.action_proposed";
  properties: {
    target_id: NonEmptyString;
    action_type: PageTakeoverActionType;
    capability: NonEmptyString;
  };
}

export interface PageTakeoverActionConfirmedEvent extends BaseEvent {
  event: "page_takeover.action_confirmed";
  properties: {
    target_id: NonEmptyString;
    action_type: PageTakeoverActionType;
    preview_duration_ms: number;
  };
}

export interface PageTakeoverActionCancelledEvent extends BaseEvent {
  event: "page_takeover.action_cancelled";
  properties: {
    target_id: NonEmptyString;
    action_type: PageTakeoverActionType;
    trigger: "esc" | "off_target_click" | "timeout";
  };
}

export interface PageTakeoverActionExecutedEvent extends BaseEvent {
  event: "page_takeover.action_executed";
  properties: {
    target_id: NonEmptyString;
    action_type: PageTakeoverActionType;
    success: boolean;
    failure_reason?: string;
  };
}

// ─── The Single Truth Union ─────────────────────
// Add every feature's events here. If it isn't here, it can't be emitted.
// ─── Billing M3 — Accountant + Order events (ADR-A, 2026-05-02) ──────────────
//
// 10 new events for the accountant app surface (apps/admin).
//
// actor_id note (blueprint §7): accountants do not have workspace-scoped
// profiles. For these events, actor_id = user_identity.user_id (UUID from
// auth.getUser()). Exception granted for category "billing" accountant
// events — documented here and cross-linked to ADR-A.
//
// workspace_id note: `order list_viewed`, `accountant signed_in/out`,
// and `accountant grant_listed` may be platform-scoped — pass null when
// no specific workspace context exists (per registry "Nullable when
// genuinely platform-scoped" comment on BaseEvent).

export interface OrderListViewed extends BaseEvent {
  event: "order list_viewed";
  properties: {
    entity: EntityRef; // entity_type: "invoice", entity_id: placeholder UUID
    data: {
      filters: { status?: string; company?: string };
      count: number;
    };
  };
}

export interface OrderDetailViewed extends BaseEvent {
  event: "order detail_viewed";
  properties: {
    entity: EntityRef; // entity_type: "invoice"
    data: {
      invoice_id: string;
      source: "list_row" | "kartotek" | "deeplink";
    };
  };
}

export interface OrderDownloaded extends BaseEvent {
  event: "order downloaded";
  properties: {
    entity: EntityRef; // entity_type: "invoice"
    data: {
      invoice_id: string;
      format: "pdf";
      trigger: "manual";
    };
  };
}

export interface OrderExported extends BaseEvent {
  event: "order exported";
  properties: {
    entity: EntityRef; // entity_type: "invoice"
    data: {
      invoice_id: string;
      format: "csv";
      trigger: "manual";
    };
  };
}

export interface OrderMarkedReceived extends BaseEvent {
  event: "order marked_received";
  properties: {
    entity: EntityRef; // entity_type: "invoice"
    data: {
      invoice_id: string;
      payment_id: string;
      paid_at: string;
      channel: "accountant_confirmed";
    };
  };
}

export interface KartotekViewed extends BaseEvent {
  event: "kartotek viewed";
  properties: {
    entity: EntityRef; // entity_type: "workspace"
    data: {
      workspace_id: string;
      company_id: string;
      sections_loaded: number;
    };
  };
}

export interface KartotekSectionFailed extends BaseEvent {
  event: "kartotek section_failed";
  properties: {
    entity: EntityRef; // entity_type: "workspace"
    data: {
      workspace_id: string;
      section: string;
      reason: "rls_denied" | "fetch_error";
    };
  };
}

export interface AccountantSignedIn extends BaseEvent {
  event: "accountant signed_in";
  properties: {
    entity: EntityRef; // entity_type: "profile", entity_id: user_identity.user_id
    data: {
      method: "otp";
      company_count: number;
    };
  };
}

export interface AccountantGrantListed extends BaseEvent {
  event: "accountant grant_listed";
  properties: {
    entity: EntityRef; // entity_type: "accountant_company_grant"
    data: {
      count: number;
    };
  };
}

export interface AccountantSignedOut extends BaseEvent {
  event: "accountant signed_out";
  properties: {
    entity: EntityRef; // entity_type: "profile", entity_id: user_identity.user_id
    data: {
      session_duration_s: number;
    };
  };
}

export type SmartoutEvent =
  | AuthSignedUp
  | AuthSignedIn
  | AuthSignedOut
  | DepartmentCreated
  | DepartmentUpdated
  | DepartmentArchived
  | ShiftCreated
  | ShiftUpdated
  | ShiftDeleted
  | ShiftAddedManual
  | ShiftListViewed
  | ShiftDetailViewed
  | ShiftPublished
  | ShiftCompleted
  | ShiftPunchedIn
  | ShiftPunchedOut
  | ShiftBreakStarted
  | ShiftBreakEnded
  | ShiftSupplementClaimed
  | ShiftSupplementReviewed
  | ShiftNoteAdded
  | ShiftAdhocCreated
  | ShiftAdhocApproved
  | ShiftCallInitiated
  | ShiftLateDetected
  | ShiftNoShowEscalated
  | ShiftLifecyclePublished
  | ShiftLifecycleApproved
  | ShiftLifecycleInterpreted
  | ShiftLifecycleSettled
  | ShiftLifecycleDeviationBridgeOpened
  | ShiftLifecycleDeviationBridgeRefused
  | SessionOpened
  | SessionPendingSignoff
  | SessionClosed
  | SessionMissed
  | SessionDemotedToMissed
  | SessionHookFired
  | SessionHookCreated
  | SessionHookDeleted
  | SessionTaskCompleted
  | ChecklistStarted
  | ChecklistStepCompleted
  | ChecklistCompleted
  | ChecklistOverdue
  | ChecklistDeviationFlagged
  | InvitationAccepted
  | ProtocolAssigned
  | ProtocolStepCompleted
  | ProtocolTestSubmitted
  | ProtocolConfirmationSigned
  | ProtocolCompleted
  | ReconciliationSubmitted
  | ReconciliationStepCompleted
  | ReconciliationPendingSignoff
  | ReconciliationAdminAction
  | ReconciliationAdminOverride
  | ReconciliationLocked
  | SignupCompleted
  | OnboardingStepCompleted
  | WorkspaceCreated
  | ContractCreated
  | ContractSent
  | ContractViewed
  | ContractSigned
  | ContractCancelled
  | ContractDeclined
  | ContractExpired
  | ContractAttachmentUploaded
  | ContractAttachmentDeleted
  | ContractComposed
  | ContractComplianceBlocked
  | ContractComplianceOverridden
  | ContractIntakeStarted
  | ContractIntakeFieldSubmitted
  | ContractIntakeCompleted
  | ContractIntakeEscalated
  | ContractIntakeAdminBypass
  | ContractIntakeDeclined
  | ContractFrameworkDriftDetected
  | ContractRegenerated
  | ContractRevisionCreated
  | ContractRetentionArchived
  | ContractTemplateViewed
  | ContractTemplateHtmlCopied
  | ContractTemplateOpenedInAdmin
  | ContractTemplateCloned
  | ContractDetailViewed
  | ContractResendSubmitted
  | ContractCancelDialogOpened
  | ContractCancelConfirmed
  | ContractCancelAborted
  | ContractCancelFailed
  | ContractDeleteDialogOpened
  | ContractDeleteConfirmed
  | ContractSendSubmitted
  | ContractBulkSubmitted
  | ContractComposeOpened
  | ContractComposeSubmitted
  | FormsUnsavedGuardShown
  | FormsUnsavedGuardDiscarded
  | FormsUnsavedGuardKept
  | PricingTermsUpdated
  | HandbookChapterSaved
  | CommunicationSent
  | CommunicationCancelled
  | CommunicationFailed
  | WizardStepCompleted
  | WizardCompleted
  | WizardStarted
  | WizardStepEntered
  | WizardStepSkipped
  | WizardStepBack
  | WizardAbandoned
  | WizardValidationFailed
  | WizardFactEdited
  | ScrapeFailed
  | ScrapePartial
  | BrregLookupFailed
  | AiGenerationFailed
  | AuthSignupFailed
  | WorkspaceProvisionFailed
  | WorkspaceFinalizeFailed
  | IndustryPackageLoadFailed
  | BotssonNudgeShown
  | BotssonNudgeAccepted
  | BotssonNudgeDismissed
  | BotssonAutofillApplied
  | EscalationTriggered
  | FlowStarted
  | FlowSlideViewed
  | FlowAnswerSubmitted
  | FlowCompleted
  | FlowSkipped
  | SeasonCreated
  | SeasonActivated
  | SeasonActivationFailed
  | SeasonActivationPreviewed
  | SeasonArchived
  | SeasonUpdated
  | SeasonOperatingHoursCopied
  | SeasonOperatingHoursUpdated
  | SeasonOperatingHoursRemoved
  | SeasonOperatingHoursGenerated
  | SeasonBudgetUpdated
  | SeasonGoalCreated
  | SeasonGoalUpdated
  | SeasonGoalDeleted
  | SeasonPolicyBindingUpdated
  | PlanningCycleActivated
  | PlanningCycleArchived
  | YearWheelBlockClicked
  | YearWheelPinClicked
  | YearWheelYearNavigated
  | SeasonDrawStarted
  | SeasonDrawCompleted
  | SeasonDrawCancelled
  | SeasonSidebarFilterChanged
  | SeasonYearWheelViewed
  | SeasonTabChanged
  | DayFactorsUpdated
  | HourFactorsUpdated
  | OperatingHoursUpdated
  | WorkspaceOperatingHoursUpdated
  | WorkspaceSettingsUpdated
  | TeamCreated
  | TeamDeleted
  | KpiTargetUpdated
  | WorkspaceBudgetUpdated
  | AbsenceCreated
  | AbsenceDeleted
  | AbsenceApproved
  | AbsenceRejected
  | AbsenceRequested
  | AbsenceCancelled
  | ShiftHoursConfirmed
  | HaccpLogged
  | HandoffSubmitted
  | ChatMessageSent
  | ChatChannelMessageSent
  | RosterCreated
  | RosterUpdated
  | RosterDeleted
  | OpenShiftCreated
  | OpenShiftAssigned
  | OpenShiftDeleted
  | TemplateCreated
  | TemplateUpdated
  | TemplateDeleted
  | TemplateBindingCreated
  | TemplateBindingUpdated
  | TemplateBindingDeleted
  | ContractTemplateCopied
  // ─── Contract Hub Redesign (Council 2026-04-22 Gate G2) ───
  | ContractTemplateForked
  | ContractTemplateCreated
  | ContractTemplateClauseUpdated
  | ContractTemplatePublished
  | ContractTemplateUnpublished
  | ContractTemplateRenamed
  | ContractTemplateDeprecated
  | ContractTemplateDeleted
  | ContractHubViewed
  | ContractTabSwitched
  | ContractBotssonChipInvoked
  | ContractBulkSendInitiated
  | ContractComposeOpened
  | ContractComposeSubmitted
  | ContractTemplateDriftViewed
  | ContractTemplateDriftDismissed
  | ContractTemplateViewed
  | ContractTemplateHtmlCopied
  | ContractTemplateOpenedInAdmin
  | ContractTemplateCloned
  // ─── Contract Data-Table events (Fix 4 / Fix 7 / telemetry holes) ───
  | ContractResendSubmitted
  | ContractCancelDialogOpened
  | ContractCancelConfirmed
  | ContractCancelAborted
  | ContractCancelFailed
  | ContractDeleteDialogOpened
  | ContractDeleteConfirmed
  | ContractDetailViewed
  // ─── Contract Send / Bulk / Guard (Fix 9) ─────────────────────────────────
  | ContractSendSubmitted
  | ContractBulkSubmitted
  | FormsUnsavedGuardShown
  | FormsUnsavedGuardDiscarded
  | FormsUnsavedGuardKept
  | TemplateLoaded
  | TemplateApplied
  | WeekReset
  | TemplateShiftCreated
  | ShiftAssigned
  | ShiftUnassigned
  | ShiftTypeConfigCreated
  | ShiftTypeConfigUpdated
  | ShiftTypeConfigRemoved
  | DayInfoCreated
  | DayInfoUpdated
  | DayInfoDeleted
  | GuardianSignalAcknowledged
  | GuardianSignalDismissed
  | LeaderPulseAnswered
  | LeaderPulseDismissed
  | ConversationCreated
  | MessageSent
  | FinancialCloseConfigUpdated
  | PayrollSettingsUpdated
  | ShiftLockPolicyUpdated
  | TeamCreated
  | TeamDeleted
  | SalaryCodeCreated
  | SalaryCodeUpdated
  | SalaryCodeDeleted
  | EmployeeGroupCreated
  | EmployeeGroupUpdated
  | EmployeeGroupDeleted
  | GroupMemberAdded
  | GroupMemberUpdated
  | GroupMemberRemoved
  | ShiftTypeCreated
  | ShiftTypeUpdated
  | ShiftTypeDeleted
  | SupplementRuleCreated
  | SupplementRuleUpdated
  | SupplementRuleDeleted
  | BreakRuleCreated
  | BreakRuleUpdated
  | BreakRuleDeleted
  | WorkingTimeRulesUpdated
  | AuthorityConfigUpdated
  | OnboardingGuideUpdated
  | SetupGuideCompleted
  | IndustryPackageLoaded
  | HolidayCalendarCreated
  | HolidayCalendarUpdated
  | HolidayCalendarDeleted
  | HolidayEntryCreated
  | HolidayEntryUpdated
  | HolidayEntryDeleted
  | ChangeProposalApproved
  | ChangeProposalRejected
  | HolidaysImported
  | MealRuleCreated
  | MealRuleUpdated
  | MealRuleDeleted
  | PageViewed
  | ButtonClicked
  | ChannelCreated
  | ChannelArchived
  | ChannelRenamed
  | ChannelDeleted
  | ChannelMemberRemoved
  | ChannelMemberAdded
  | ChannelMemberRoleChanged
  | ChannelAiPolicyUpdated
  | ChannelRetentionChanged
  | ChannelAccessScopeSet
  | HelpdeskQueryOpened
  | HelpdeskQueryResolved
  | HelpdeskQueryReassigned
  | HelpdeskDeskCreated
  | HelpdeskDeskResponsibleAssigned
  | HelpdeskDeskArchived
  | HelpdeskSlaNobodyResolved
  | ChannelHelpdeskEnabled
  | ChannelHelpdeskDisabled
  | ChannelResponsibleReassigned
  | HelpdeskPiiDetected
  | HelpdeskPiiClassifierTimeout
  | HelpdeskQuerySlaBreached
  | HelpdeskSlaNobodyResolved
  | EngineContextPatchedTargeted
  | EngineCrossStateWriteBlocked
  | ChannelMessageSent
  | ChannelMessageEdited
  | ChannelMessageDeleted
  | ChannelMemberJoined
  | ChannelMemberLeft
  | ChannelReactionAdded
  | ChannelReactionRemoved
  | ChannelRead
  | ChannelMessagePinned
  | ChannelMessageUnpinned
  | HelpRequestCreated
  | HelpRequestResolved
  | KnowledgeShared
  | NewsPostCreated
  | NewsPostReacted
  | WebsiteCreated
  | WebsitePublished
  | WebsiteUnpublished
  | WebsiteRollback
  | WebsiteDomainVerified
  | WebsiteDomainFailed
  | WebsitePreviewCreated
  | WebsiteContentGenerated
  | WebsiteUpdated
  | WebsiteSetupCompleted
  | WebsitePageCreated
  | WebsitePageDeleted
  | WebsitePagesReordered
  | WebsiteSectionCreated
  | WebsiteSectionDeleted
  | WebsiteSectionUpdated
  | WebsiteSectionsReordered
  | WebsiteAssetUploaded
  | WebsitePreviewTokenCreated
  | WebsiteHoursUpdated
  | WebsiteMenuSynced
  | WebsiteSystemSectionAdded
  | WebsiteSpokespersonAssigned
  | WebsiteSpokespersonApproved
  | WebsiteSpokespersonDeclined
  | WebsiteSpokespersonContentSubmitted
  | WebsiteSpokespersonTaskOverdue
  | WebsiteSpokespersonRevoked
  | DeviationReported
  | DeviationUpdated
  | DeviationResolved
  | ChannelCallStarted
  | ChannelCallEnded
  | ChannelCallParticipantJoined
  | ChannelCallParticipantLeft
  | ChannelCallInviteSent
  | ChannelCallInviteAccepted
  | ChannelCallInviteRejected
  | ChannelCallInviteMissed
  | ChannelCallGroupAnnounced
  | ChannelCallPttActivated
  | ChannelCallPttDeactivated
  | ChannelCallParticipantMuted
  | AgentSessionStarted
  | AgentSessionClosed
  | AgentToolCalled
  | AgentHookBlocked
  | AgentContextWindowTruncated
  | AgentBudgetExhausted
  | AgentTokensUsed
  | BotssonTurnStarted
  | BotssonTurnCompleted
  | BotssonIntentClassified
  | BotssonToolInvoked
  | BotssonToolFailed
  | BotssonStepCapHit
  | VoiceSessionStarted
  | VoiceSessionEnded
  | VoiceTranscriptIn
  | VoiceResponseOut
  | RecorderTurnFlagged
  | RecorderWhisperCreated
  | RecorderSessionFlagged
  | RecorderSessionForceStopped
  | RecorderUserFlagSubmitted
  | AdminPiiReveal
  | EmmaTaskScheduled
  | EmmaTaskCompleted
  | NotificationDeepLinkFollowed
  | HubActionTapped
  | TaskSurfaceViewed
  | TaskSurfaceClicked
  | TaskSurfaceSnapshot
  | EntityDrawerOpened
  | EntityDrawerClosed
  | EntityDrawerPinned
  | EntityDrawerTabSwitched
  | ProfessionCreated
  | PositionCreated
  | PositionUpdated
  | ZoneCreated
  | ZoneUpdated
  | AssetCreated
  | AssetUpdated
  | LocationCreated
  | LocationUpdated
  | TeamUpdated
  | LegalFunctionAssigned
  | ProfileAccessGranted
  | ProfileAccessRevoked
  | ProfileRoleUpdated
  | ProfileDepartmentUpdated
  | ProfileStatusUpdated
  | ProfileDeactivated
  | ProfileReactivated
  | ProfileLoginCodeSent
  | InvitationCancelled
  | InvitationResent
  | InvitationCreated
  | InvitationDispatched
  | InvitationOpened
  | InvitationExpired
  | OnboardingProfessionsConfirmed
  | TelegramSessionCreated
  | TelegramMessageReceived
  | TelegramMessageSent
  | TelegramEscalationSent
  | TelegramEscalationResolved
  | TelegramPollSent
  | TelegramPollResolved
  | TelegramBridgeOpened
  | TelegramBridgeClosed
  | TelegramBridgeMessageRelayed
  | SessionTaskCreated
  | SessionTaskAssigned
  | TaskAddedManual
  | CommunicationBroadcastSent
  | AuthOtpSent
  | AuthOtpVerified
  | AuthOtpFailed
  | AuthLoggedIn
  | LoginCodeSent
  | AuthPasswordResetRequested
  | AuthPasswordResetCompleted
  | SecurityRateLimited
  | SecurityLockoutTriggered
  | SecuritySandboxBlocked
  | GateEvaluated
  | GateDenied
  | WorkspaceAbandoned
  | EnrichmentRequested
  | EnrichmentHit
  | EnrichmentMissed
  | EnrichmentCorrected
  | ShiftSwapRequested
  | ShiftSwapAccepted
  | ShiftSwapRejected
  | ShiftSwapApproved
  | ShiftSwapExecuted
  | ShiftSwapCancelled
  | ServiceConfigCreated
  | ServiceConfigUpdated
  | ServiceConfigRestarted
  | ServiceConfigDeleted
  | ScheduleRollback
  | OpsCompileDayBrief
  | OpsCompilePreclose
  | OpsCompileShiftBrief
  | OpsTriageClassified
  | OpsMonitorLatePunchin
  | OpsMonitorNoShow
  | OpsMonitorTaskOverdue
  | OpsMonitorCriticalTaskMissed
  | OpsMonitorUnderstaffing
  | OpsMonitorApproachingClose
  | OpsMonitorUnsignedSession
  | OpsMonitorAlertsQueried
  | OpsMonitorSessionIntelligenceQueried
  | OpsActEscalated
  | OpsActTasksRedistributed
  | OpsActSessionFrozen
  | OpsPredictGenerated
  | OpsPredictCoverageQueried
  | OpsPredictComplianceQueried
  | OpsLearnPatternExtracted
  | OpsLearnRetentionCleaned
  | OpsLearnPatternsQueried
  | PolicyPublished
  | ObserverRequestCreated
  | ObserverRequestClaimed
  | ObserverRequestResolved
  | ApprovalRequested
  | ApprovalResolved
  | ReminderSent
  | ReminderOpened
  | ReminderConverted
  // ─── Billing (ADR-0118) ───
  | InvoiceGenerated
  | InvoiceIssued
  | InvoiceSent
  | InvoiceMarkedPaid
  | InvoiceVoided
  | InvoiceMarkedUncollectible
  | InvoiceOverdueDetected
  | InvoiceCreditNoteIssued
  | InvoiceBasisDriftDetected
  | UsageSnapshotCreated
  | BillingPricingTermsUpdated
  | DunningNoteAdded
  // ─── Billing Fase 2 (dispatch + integration + editing) ───
  | InvoiceDispatched
  | InvoiceDispatchFailed
  | InvoiceDispatchRetried
  | InvoiceDispatchRetryRequested
  | IntegrationSyncSucceeded
  | IntegrationSyncFailed
  | IntegrationSyncMocked
  | IntegrationTestConnectionSucceeded
  | IntegrationTestConnectionFailed
  | IntegrationAuditViolation
  | InvoiceLineItemAdded
  | InvoiceLineItemEdited
  | InvoiceLineItemRemoved
  | InvoiceAdhocCreated
  | WorkspaceMarkedPaid
  | DispatchRuleCreated
  | DispatchRuleUpdated
  | DispatchRuleDeleted
  | IntegrationCreated
  | IntegrationUpdated
  | IntegrationDeleted
  | DispatchRuleEvaluated
  // ─── Billing Fase 3A (ADR-0131, ADR-0128, ADR-0141–ADR-0144) ───
  | PaymentInitiated
  | PaymentSucceeded
  | PaymentFailed
  | PaymentRefunded
  | InvoiceDunningEscalated
  | InvoiceCreditNoteAutoCreated
  | PlatformAdminPiiRead
  // ─── Billing Fase 3B — CSV/PDF-eksport ───
  | BillingEhfExportGenerated
  | BillingAccountantMarkedPaid
  // ─── Journey Engine (ADR-0175, S1.1) ─────────────
  | JourneyRunStarted
  | JourneyStepReached
  | JourneyCompleted
  | JourneyStuck
  | JourneyRunFailed
  // ─── Journey Authoring (M4, ADR-0172) ────────────
  | JourneyVersionCreated
  | JourneyVersionSaved
  | JourneyVersionTransitioned
  | JourneyVersionArchived
  // ─── Journey Authoring Wizard (ADR-0239) ─────────
  | JourneyAuthoringPhaseAdvanced
  | JourneyAuthoringJourneyPublished
  // ─── Availability (ADR-0200, Sortie 2) ───────────
  | AvailabilitySetOwn
  | AvailabilityCleared
  | AvailabilityQueried
  // ─── Payroll Capability (ADR-0242, Wave 3 B7) ────
  | PayrollUpdatePayrollProfile
  | PayrollSetPensionScheme
  | PayrollTaxCardQueried
  | PayrollSalaryQueried
  // ─── Contract Module (ADR-0243/0236, Wave 3 B7) ──
  | ContractObligationOverdue
  | ContractObligationDueSoon
  | ContractAmendmentProposed
  | ContractAmendmentSigned
  | ContractAmendmentDeclined
  | ContractAcknowledgementBlockConfirmed
  | ContractReadinessSelfFillRequested
  | ContractPiiRevealed
  // ─── Contract Wave 4 UI (ADR-0241/0234/0236, Wave 4) ─
  | EmploymentContractUpsertedInline
  | ContractsComposeTemplateSelected
  | ContractSendInitiated
  | ContractSigningLinkOpened
  | ContractObligationAssigned
  | ContractObligationCompleted
  | ContractPdfPreviewViewed
  // ─── Legal Capability (ADR-0249, Phase 0c) ──────
  | LegalAml146Validated
  | LegalLawCited
  | LegalAmendmentClassified
  // ─── Help Hub (ADR-0219, campaign/core-module) ──
  | HelpSearchPerformedEvent
  | HelpArticleOpenedEvent
  | HelpEscalatedToTicketEvent
  | HelpTtsInvokedEvent
  | HelpForklarEnkeltInvokedEvent
  | HelpActiveTicketBadgeViewedEvent
  | HelpActiveTicketBadgeClickedEvent
  | HelpTourStepInvokedEvent
  | HelpTourCompletedEvent
  | HelpTourCancelledEvent
  | GovernanceContentUpdatedEvent
  | PageTakeoverActionProposedEvent
  | PageTakeoverActionConfirmedEvent
  | PageTakeoverActionCancelledEvent
  | PageTakeoverActionExecutedEvent
  // ─── Personal Capability (feat/botsson-personal-tools) ───
  | PersonalNoteAdded
  | PersonalTaskCreated
  | PersonalReminderSet
  | PersonalHistoryQueried
  | PersonalSettingUpdated
  // ─── Welcome Wizard (first-login, WelcomeWizard component) ───
  | ProfileWelcomeWizardStarted
  | ProfileWelcomeWizardStepCompleted
  | ProfileWelcomeWizardCompleted
  | ProfileWelcomeWizardSkippedOptional
  | LegalAml146Validated
  | LegalLawCited
  | LegalAmendmentClassified
  // ─── Sixten Orchestrator (Phase 0d.1) ────────────────────────
  | SixtenPulseProcessed
  | SixtenCheckBreach
  | SixtenEscalation
  // ─── Billing M3 — Accountant + Order events (ADR-A, 2026-05-02) ─
  | OrderListViewed
  | OrderDetailViewed
  | OrderDownloaded
  | OrderExported
  | OrderMarkedReceived
  | KartotekViewed
  | KartotekSectionFailed
  | AccountantSignedIn
  | AccountantGrantListed
  | AccountantSignedOut;

// ─── Sixten Orchestrator Events (Phase 0d.1) ─────────────────────────────────
// Platform-scoped (workspace_id = null). Actor = system sentinel UUID.
// Three events: pulse_processed (summary), check_breach (per-check), escalation.

export interface SixtenPulseProcessed extends BaseEvent {
  event: "sixten pulse_processed";
  properties: {
    pulse_id: string;
    checks_run: number;
    breaches: number;
    duration_ms: number;
  };
}

export interface SixtenCheckBreach extends BaseEvent {
  event: "sixten check_breach";
  properties: {
    pulse_id: string;
    check_name: string;
    metric: number;
    threshold: number;
  };
}

export interface SixtenEscalation extends BaseEvent {
  event: "sixten escalation";
  properties: {
    pulse_id: string;
    check_name: string;
    escalation_reason: string;
  };
}

// ─── Personal Capability Events (feat/botsson-personal-tools) ──────────────
// Five tools: add_note, create_task, set_reminder, get_history, update_setting.

export interface PersonalNoteAdded extends BaseEvent {
  event: "personal.note_added";
  properties: {
    entity: EntityRef;
    data: { tags: string[] };
  };
}

export interface PersonalTaskCreated extends BaseEvent {
  event: "personal.task_created";
  properties: {
    entity: EntityRef;
    data: { title: string; priority: string; has_due_at: boolean };
  };
}

export interface PersonalReminderSet extends BaseEvent {
  event: "personal.reminder_set";
  properties: {
    entity: EntityRef;
    data: { fire_at: string };
  };
}

export interface PersonalHistoryQueried extends BaseEvent {
  event: "personal.history_queried";
  properties: {
    data: { category: string | null; limit: number };
  };
}

export interface PersonalSettingUpdated extends BaseEvent {
  event: "personal.setting_updated";
  properties: {
    entity: EntityRef;
    data: { key: string };
  };
}

// ─── Routing Map Implementation ─────────────────
// Each valid event is explicitly instructed where it belongs.
export const EVENT_ROUTING: Record<SmartoutEvent["event"], EventMeta> = {
  "auth signed_up": { destinations: ["posthog", "logger"], category: "auth" },
  "auth signed_in": { destinations: ["posthog", "logger"], category: "auth" },
  "auth signed_out": { destinations: ["posthog"], category: "auth" },

  "department created": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "org_structure",
  },
  "department updated": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "org_structure",
  },
  "department archived": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "org_structure",
  },

  "shift created": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "shift updated": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "shift deleted": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "shift added_manual": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "shift published": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "shift completed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },

  // Journey 03 (Sjekke vakter) — PoC events. All four destinations required:
  // engine_event drives the journey state machine; the others maintain analytics
  // and audit trail parity with peer scheduling events (per spec section 1).
  "shift list_viewed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "shift detail_viewed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },

  "shift punched_in": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },
  "shift punched_out": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },
  "shift break_started": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "shift break_ended": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "shift supplement_claimed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "shift supplement_reviewed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "shift note_added": {
    destinations: ["logger", "activity_trail"],
    category: "operations",
  },
  "shift adhoc_created": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },
  "shift adhoc_approved": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "shift call_initiated": {
    destinations: ["posthog", "logger"],
    category: "operations",
  },
  "shift late_detected": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },
  "shift no_show_escalated": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },

  "session opened": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },
  "session pending_signoff": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },
  "session closed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },
  "session missed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },
  // ADR-0187 single-emit source: engine_event is emitted by the DB trigger
  // `trg_session_demoted_to_missed` (migration
  // 20260517130000_session_watchdog_demoter.sql). The Edge Function writes
  // only activity_trail + logger; the parity test's TRIGGER_WRITTEN_ENGINE_EVENTS
  // list (see `__tests__/parity.test.ts`) exempts this event from the
  // Edge-Function-must-emit-engine_event assertion.
  "session demoted_to_missed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },
  "session hook_fired": {
    destinations: ["logger", "engine_event"],
    category: "operations",
  },
  "session_hook created": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "operations",
  },
  "session_hook deleted": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "operations",
  },
  "session_task completed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },

  "checklist started": {
    destinations: ["posthog", "activity_trail"],
    category: "operations",
  },
  "checklist step_completed": {
    destinations: ["activity_trail"],
    category: "operations",
  },
  "checklist completed": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "operations",
  },
  "checklist overdue": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "operations",
  },
  "checklist deviation_flagged": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "operations",
  },

  "invitation accepted": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "onboarding",
  },

  // emit site: supabase/functions/create-invitation/index.ts (post-insert, direct insert pattern)
  "invitation created": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "auth",
  },
  // emit site: supabase/functions/create-invitation/index.ts (per-channel dispatch loop, direct insert pattern)
  "invitation dispatched": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "auth",
  },
  // emit site: RPC track_invitation_opened call path from apps/web/src/app/invite/[token]/page.tsx
  // Pre-auth visitor event (variant A: not signed in; variant B: no profile yet) — actor_id is
  // empty at emit time. activity_trail.actor_id is NOT NULL UUID, so routing here would silently
  // fail the insert per ADR-0134 + L-0083. PostHog + logger carry the analytics record.
  "invitation opened": {
    destinations: ["posthog", "logger"],
    category: "auth",
  },
  // emit site: on-read expiration check in apps/web/src/app/invite/[token]/page.tsx
  //            (status transition pending → expired)
  "invitation expired": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "auth",
  },

  "protocol assigned": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "training",
  },
  "protocol step_completed": {
    destinations: ["posthog", "logger", "engine_event"],
    category: "training",
  },
  "protocol test_submitted": {
    destinations: ["posthog", "logger", "engine_event"],
    category: "training",
  },
  "protocol confirmation_signed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "training",
  },
  "protocol completed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "training",
  },

  "reconciliation submitted": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },
  "reconciliation step_completed": {
    // M2 wizard step-by-step save — no activity_trail (too chatty per step).
    destinations: ["posthog", "logger"],
    category: "operations",
  },
  "reconciliation pending_signoff": {
    // Trigger-emitted from trg_session_pending_signoff (ADR-0187 sole emitter).
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },
  "reconciliation admin_action": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },
  "reconciliation admin_override": {
    // Preflight-blocker override via mobile BFF (closure Item 4). activity_trail
    // carries override=true + gate_blocked codes + reason for audit queries.
    // No engine_event — override does not trigger downstream workflow steps.
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "reconciliation locked": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },

  "communication sent": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "communication",
  },
  "communication cancelled": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "communication",
  },
  "communication failed": {
    destinations: ["posthog", "logger"],
    category: "communication",
  },

  "contract created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "contract sent": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract viewed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "contract signed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract cancelled": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "contract declined": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract expired": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract attachment uploaded": {
    destinations: ["logger", "activity_trail"],
    category: "contracts",
  },
  "contract attachment deleted": {
    destinations: ["logger", "activity_trail"],
    category: "contracts",
  },
  "contract composed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "contract compliance blocked": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "contract compliance overridden": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "contract intake started": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract intake field submitted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "contract intake completed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract intake escalated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "contract intake admin bypass": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "contract intake declined": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract framework drift detected": {
    destinations: ["posthog", "logger"],
    category: "contracts",
  },
  "contract regenerated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "contract revision created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "contract retention archived": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "pricing terms updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },

  "handbook chapter_saved": {
    destinations: ["posthog", "logger", "engine_event"],
    category: "training",
  },

  "signup completed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "onboarding",
  },
  "onboarding step_completed": {
    destinations: ["posthog", "logger", "engine_event"],
    category: "onboarding",
  },
  "workspace created": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "onboarding",
  },
  "wizard step_completed": {
    destinations: ["posthog", "logger"],
    category: "onboarding",
  },
  "wizard fact_edited": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "onboarding",
  },
  "wizard completed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "onboarding",
  },
  "wizard started": {
    destinations: ["posthog", "logger"],
    category: "onboarding",
  },
  "wizard step_entered": {
    destinations: ["posthog", "logger"],
    category: "onboarding",
  },
  "wizard step_skipped": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "onboarding",
  },
  "wizard step_back": {
    destinations: ["posthog", "logger"],
    category: "onboarding",
  },
  "wizard abandoned": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "onboarding",
  },
  "wizard validation_failed": {
    destinations: ["posthog", "logger"],
    category: "onboarding",
  },

  // ─── Error events ───
  "scrape failed": { destinations: ["posthog", "logger"], category: "onboarding" },
  "scrape partial": { destinations: ["posthog", "logger"], category: "onboarding" },
  "brreg lookup_failed": { destinations: ["posthog", "logger"], category: "onboarding" },
  "ai generation_failed": { destinations: ["posthog", "logger"], category: "onboarding" },
  "auth signup_failed": { destinations: ["posthog", "logger"], category: "auth" },
  "workspace provision_failed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "onboarding",
  },
  "workspace finalize_failed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "onboarding",
  },
  "industry_package load_failed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "onboarding",
  },

  // ─── Botsson response events (circuit breaker: NO engine_event) ───
  "botsson nudge_shown": { destinations: ["posthog", "logger"], category: "agent" },
  "botsson nudge_accepted": { destinations: ["posthog", "logger"], category: "agent" },
  "botsson nudge_dismissed": { destinations: ["posthog", "logger"], category: "agent" },
  "botsson autofill_applied": { destinations: ["posthog", "logger"], category: "agent" },
  "escalation triggered": { destinations: ["posthog", "logger"], category: "agent" },

  "flow started": { destinations: ["posthog", "logger"], category: "onboarding" },
  "flow slide_viewed": { destinations: ["posthog"], category: "onboarding" },
  "flow answer_submitted": {
    destinations: ["posthog", "logger"],
    category: "onboarding",
  },
  "flow completed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "onboarding",
  },
  "flow skipped": { destinations: ["posthog", "logger"], category: "onboarding" },
  "season created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  // ADR-0212 (extending ADR-0187): sole emitter is the DB trigger
  // `trg_season_activated`. Application code MUST NOT
  // `emit({event: "season activated"})` — the trigger writes
  // `engine_event.event_type='season.activated'`, and the
  // `engine_event`-subscriber (shared infra with ADR-0187, pending)
  // fans this out to PostHog / Logger / activity_trail under the
  // space-delimited name. Until the subscriber lands, this is an
  // orphan registry entry — identical to `session pending_signoff`
  // after ADR-0187 implementation. Do not "fix" by re-introducing
  // the application emit.
  "season activated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "season activation_failed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "season activation_preview": {
    destinations: ["posthog", "logger"],
    category: "operations",
  },
  "season archived": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "season updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "season operating_hours_copied": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "season operating_hours_updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "season operating_hours_removed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "season operating_hours_generated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "season_goal created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "season_goal updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "season_goal deleted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "season_policy_binding updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "planning_cycle activated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "planning_cycle archived": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "season block_clicked": {
    destinations: ["posthog"],
    category: "navigation",
  },
  "season pin_clicked": {
    destinations: ["posthog"],
    category: "navigation",
  },
  "season year_navigated": {
    destinations: ["posthog"],
    category: "navigation",
  },
  "season draw_started": {
    destinations: ["posthog", "logger"],
    category: "navigation",
  },
  "season draw_completed": {
    destinations: ["posthog", "logger"],
    category: "operations",
  },
  "season draw_cancelled": {
    destinations: ["posthog", "logger"],
    category: "navigation",
  },
  "season sidebar_filter_changed": {
    destinations: ["posthog", "logger"],
    category: "navigation",
  },
  "season year_wheel_viewed": {
    destinations: ["posthog", "logger"],
    category: "navigation",
  },
  "season tab_changed": {
    destinations: ["posthog", "logger"],
    category: "navigation",
  },
  "season_budget updated": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },
  "day_factors updated": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },
  "hour_factors updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "operating_hours updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "workspace_operating_hours updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "workspace_settings updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "team created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "org_structure",
  },
  "team deleted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "org_structure",
  },
  "kpi_target updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "workspace_budget updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },

  "absence created": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "absence deleted": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "absence approved": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "absence rejected": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "absence requested": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "absence cancelled": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },

  // ─── Mobile Mutation Events ─────────────────────────
  "shift hours_confirmed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },
  "shift_lifecycle published": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "shift_lifecycle approved": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "shift_lifecycle interpreted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "shift_lifecycle settled": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "shift_lifecycle deviation_bridge_opened": {
    destinations: ["posthog", "logger"],
    category: "scheduling",
  },
  "shift_lifecycle deviation_bridge_refused": {
    destinations: ["posthog", "logger"],
    category: "scheduling",
  },
  "haccp logged": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "haccp",
  },
  "handoff submitted": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },
  "chat message_sent": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "communication",
  },
  "chat channel_message_sent": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },

  "roster created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "roster updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "roster deleted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "open_shift created": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "open_shift assigned": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "open_shift deleted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "template created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "template updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "template deleted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "template_binding created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "template_binding updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "template_binding deleted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "contract_template copied": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },

  // ─── Contract Hub Redesign (Council 2026-04-22 Gate G2) ───
  // All 10 events route to 4 destinations (posthog, logger,
  // activity_trail, engine_event) so Event Engine consumers can
  // react to drift chips, deprecations, and forks.
  "contract_template forked": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract_template created": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract_template clause_updated": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract_template published": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract_template unpublished": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract_template renamed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract_template deprecated": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract_template deleted": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract.hub_viewed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract.tab_switched": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract.botsson_chip_invoked": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract.bulk_send_initiated": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },

  // ─── Contract Hub Surface Events ─────────────────────────────────
  "contracts.template.viewed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "contracts.template.html_copied": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "contracts.template.opened_in_admin": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "contracts.template.cloned": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contracts.detail.viewed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "contracts.resend.submitted": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contracts.cancel.dialog_opened": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "contracts.cancel.confirmed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contracts.cancel.aborted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "contracts.cancel.failed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "contracts.delete.dialog_opened": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "contracts.delete.confirmed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contracts.send.submitted": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contracts.bulk.submitted": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contracts.compose.opened": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contracts.compose.submitted": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },

  // ─── Forms Surface Events ────────────────────────────────────────
  "forms.unsaved_guard.shown": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "navigation",
  },
  "forms.unsaved_guard.discarded": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "navigation",
  },
  "forms.unsaved_guard.kept": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "navigation",
  },

  "contract_template.drift_viewed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract_template.drift_dismissed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "template loaded": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "template applied": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "week reset": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "template_shift created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "shift assigned": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "shift unassigned": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "shift_type_config created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "shift_type_config updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "shift_type_config removed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "day_info created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "day_info updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "day_info deleted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "guardian_signal acknowledged": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "system",
  },
  "guardian_signal dismissed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "system",
  },

  "leader_pulse answered": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "leader_pulse dismissed": {
    destinations: ["posthog", "logger"],
    category: "operations",
  },

  "conversation created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "communication",
  },
  "message sent": {
    destinations: ["posthog", "logger"],
    category: "communication",
  },

  "financial_close_config updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "payroll_settings updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "shift_lock_policy updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "system",
  },

  "salary_code created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "salary_code updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "salary_code deleted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },

  "employee_group created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "employee_group updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "employee_group deleted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "group_member added": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "group_member updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "group_member removed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },

  "shift_type created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "shift_type updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "shift_type deleted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },

  "supplement_rule created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "supplement_rule updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "supplement_rule deleted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },

  "break_rule created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "break_rule updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "break_rule deleted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },

  "working_time_rules updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },

  "authority_config updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "system",
  },

  "onboarding_guide updated": {
    destinations: ["posthog", "logger"],
    category: "onboarding",
  },

  "setup_guide completed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "onboarding",
  },

  "industry_package loaded": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "onboarding",
  },

  "holiday_calendar created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "holiday_calendar updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "holiday_calendar deleted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "holiday_entry created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "holiday_entry updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "holiday_entry deleted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "change_proposal approved": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },
  "change_proposal rejected": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },
  "holidays imported": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },

  "meal_rule created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "meal_rule updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "meal_rule deleted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },

  "page viewed": { destinations: ["posthog"], category: "navigation" },
  "button clicked": { destinations: ["posthog"], category: "navigation" },

  // Channel events
  "channel.created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },
  "channel.archived": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },
  // Channel Settings tabs — admin-only operational writes (no workflow trigger)
  "channel.renamed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },
  "channel.deleted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },
  "channel.member_removed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },
  "channel.member_added": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },
  "channel.member_role_changed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },
  "channel.ai_policy_updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },
  "channel.retention_changed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },
  "channel.access_scope_set": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },

  // Helpdesk (ADR-0160 — projected to channel_event via trigger; ADR-0161 ontology)
  "helpdesk.query.opened": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "helpdesk",
  },
  "helpdesk.query.resolved": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "helpdesk",
  },
  "helpdesk.query.reassigned": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "helpdesk",
  },
  "helpdesk.desk.created": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "helpdesk",
  },
  "helpdesk.desk.responsible_assigned": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "helpdesk",
  },
  "helpdesk.desk.archived": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "helpdesk",
  },

  // Progressive Channel (ADR-0165) — flag-based helpdesk lifecycle.
  // channel_event projection trigger (ADR-0160) picks these up when the
  // event prefix matches 'helpdesk.%'; channel.helpdesk.* events use the
  // 'channel.' prefix instead so they fan via the channel_event whitelist
  // separately (audit + observability, not Komm UI Min kø driver).
  "channel.helpdesk.enabled": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "helpdesk",
  },
  "channel.helpdesk.disabled": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "helpdesk",
  },
  "channel.responsible.reassigned": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "helpdesk",
  },

  // ADR-0166 — PII classifier observability. activity_trail is mandatory
  // (compliance evidence), engine_event is included so the admin PII log
  // viewer (Phase 1A.2 UI) can query across workspaces without a separate
  // table. `helpdesk.%` prefix trips the channel_event projection too,
  // surfacing redactions inline on the timeline.
  "helpdesk.pii.detected": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "helpdesk",
  },
  "helpdesk.pii.classifier_timeout": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "helpdesk",
  },

  // ADR-0227 — SLA breach event routed to engine_event so the engine_trigger
  // (seeded by T3 migration) picks it up and drives the breach-handling path.
  // PostHog included — SLA breach rate is a product metric.
  "helpdesk.query.sla_breached": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "helpdesk",
  },

  // ADR-0226 — Operational warn when proxy resolution chain finds no observer.
  // NOT PostHog (not an analytics event), NOT engine_event (no downstream consumer).
  // Logger + activity_trail only — surfaces silent SLA failure in audit data.
  "helpdesk.sla.no_observer_resolved": {
    destinations: ["logger", "activity_trail"],
    category: "helpdesk",
  },

  // ADR-0236 — update_context_targeted success: cross-state context patch.
  // engine_event so UI subscribers reading the patched ticket can react;
  // activity_trail for the cross-state-write audit trail. PII-safe by contract
  // (patch_keys only, never values per ADR-0163).
  "engine.context_patched_targeted": {
    destinations: ["activity_trail", "engine_event"],
    category: "system",
  },

  // ADR-0236 — CVE-class workspace-integrity-guard breach. Logger (warn)
  // surfaces in operational dashboards; activity_trail makes it greppable
  // for security review. NOT engine_event — security boundary breach, not
  // a workflow signal downstream processes should consume.
  "engine.cross_state_write_blocked": {
    destinations: ["logger", "activity_trail"],
    category: "system",
  },

  "channel.message.sent": {
    destinations: ["posthog", "logger"],
    category: "channels",
  },
  "channel.message.edited": {
    destinations: ["posthog", "logger"],
    category: "channels",
  },
  "channel.message.deleted": {
    destinations: ["posthog", "logger"],
    category: "channels",
  },
  "channel.member.joined": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },
  "channel.member.left": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },
  "channel.reaction.added": {
    destinations: ["posthog"],
    category: "channels",
  },
  "channel.reaction.removed": {
    destinations: ["posthog"],
    category: "channels",
  },
  "channel.read": {
    destinations: ["posthog"],
    category: "channels",
  },
  "channel.message.pinned": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },
  "channel.message.unpinned": {
    destinations: ["posthog", "logger"],
    category: "channels",
  },

  // Komm redesign events
  "help_request.created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },
  "help_request.resolved": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },
  "knowledge.shared": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },
  "news.post.created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },
  "news.post.reacted": {
    destinations: ["posthog"],
    category: "channels",
  },

  // Website factory events
  "website created": { destinations: ["posthog", "activity_trail"], category: "system" },
  "website published": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "system",
  },
  "website unpublished": { destinations: ["posthog", "activity_trail"], category: "system" },
  "website rollback": { destinations: ["posthog", "activity_trail"], category: "system" },
  "website domain_verified": { destinations: ["activity_trail"], category: "system" },
  "website domain_failed": { destinations: ["activity_trail", "logger"], category: "system" },
  "website preview_created": { destinations: ["activity_trail"], category: "system" },
  "website content_generated": { destinations: ["posthog", "activity_trail"], category: "system" },
  "website updated": { destinations: ["posthog", "activity_trail"], category: "system" },
  "website setup completed": { destinations: ["posthog", "activity_trail"], category: "system" },
  "website page created": { destinations: ["posthog", "activity_trail"], category: "system" },
  "website page deleted": { destinations: ["activity_trail"], category: "system" },
  "website pages reordered": { destinations: ["activity_trail"], category: "system" },
  "website section created": { destinations: ["posthog", "activity_trail"], category: "system" },
  "website section deleted": { destinations: ["activity_trail"], category: "system" },
  "website section updated": { destinations: ["activity_trail"], category: "system" },
  "website sections reordered": { destinations: ["activity_trail"], category: "system" },
  "website asset uploaded": { destinations: ["activity_trail"], category: "system" },
  "website preview token created": { destinations: ["activity_trail"], category: "system" },
  "website hours_updated": { destinations: ["posthog", "activity_trail"], category: "system" },
  "website menu_synced": { destinations: ["activity_trail"], category: "system" },
  "website system_section_added": {
    destinations: ["posthog", "activity_trail"],
    category: "system",
  },
  "website spokesperson_assigned": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "system",
  },
  "website spokesperson_approved": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "system",
  },
  "website spokesperson_declined": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "system",
  },
  "website spokesperson_content_submitted": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "system",
  },
  "website spokesperson_task_overdue": {
    destinations: ["activity_trail", "engine_event"],
    category: "system",
  },
  "website spokesperson_revoked": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "system",
  },

  // ─── HMS: Deviations ────────────────────────────
  "deviation reported": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },
  "deviation updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "deviation resolved": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },

  // Channel call events
  "channel.call.started": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "channels",
  },
  "channel.call.ended": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "channels",
  },
  "channel.call.participant_joined": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },
  "channel.call.participant_left": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },
  "channel.call.invite_sent": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },
  "channel.call.invite_accepted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },
  "channel.call.invite_rejected": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },
  "channel.call.invite_missed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },
  "channel.call.group_announced": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },
  "channel.call.ptt_activated": {
    destinations: ["posthog"],
    category: "channels",
  },
  "channel.call.ptt_deactivated": {
    destinations: ["posthog"],
    category: "channels",
  },
  "channel.call.participant_muted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },

  // Agent events
  "agent session_started": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "agent session_closed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "agent tool_called": {
    destinations: ["logger", "activity_trail"],
    category: "agent",
  },
  "agent hook_blocked": {
    destinations: ["posthog", "activity_trail"],
    category: "agent",
  },
  "agent context_window_truncated": {
    destinations: ["posthog"],
    category: "agent",
  },
  "agent budget_exhausted": {
    destinations: ["posthog", "activity_trail"],
    category: "agent",
  },
  "agent tokens_used": {
    destinations: ["posthog"],
    category: "agent",
  },

  // Botsson runtime events (Phase 3, ADR-0116)
  "botsson.turn_started": {
    destinations: ["logger", "activity_trail"],
    category: "agent",
  },
  "botsson.turn_completed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "botsson.intent_classified": {
    destinations: ["posthog", "activity_trail"],
    category: "agent",
  },
  "botsson.tool_invoked": {
    destinations: ["posthog", "activity_trail"],
    category: "agent",
  },
  "botsson.tool_failed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "botsson.step_cap_hit": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },

  // Mobile Voice (LiveKit) events (ADR-0132, ADR-0135, Phase C1).
  // All four destinations: PostHog (analytics), logger (debugging),
  // activity_trail (audit), engine_event (drives observability dashboards).
  "voice.session_started": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "agent",
  },
  "voice.session_ended": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "agent",
  },
  "voice.transcript_in": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "agent",
  },
  "voice.response_out": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "agent",
  },

  // Session Recorder events (ADR-0184, ADR-0185)
  "recorder.turn_flagged": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "recorder.whisper_created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "recorder.session_flagged": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "recorder.session_force_stopped": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "recorder.user_flag_submitted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "admin.pii_reveal": {
    // Break-glass reveal — MUST land in activity_trail for audit (ADR-0185).
    destinations: ["logger", "activity_trail"],
    category: "security",
  },

  "emma_task scheduled": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "emma_task completed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },

  // Navigation events (mobile)
  "notification deep_link_followed": {
    destinations: ["posthog", "logger"],
    category: "navigation",
  },
  "hub action_tapped": {
    destinations: ["posthog", "logger"],
    category: "navigation",
  },

  // Cascade Task Surface
  "task_surface viewed": {
    destinations: ["posthog", "logger"],
    category: "navigation",
  },
  "task_surface clicked": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "navigation",
  },
  "task_surface snapshot": {
    destinations: ["posthog", "logger"],
    category: "navigation",
  },
  "entity_drawer opened": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "navigation",
  },
  "entity_drawer closed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "navigation",
  },
  "entity_drawer pinned": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "navigation",
  },
  "entity_drawer tab_switched": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "navigation",
  },

  "profession created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "org_structure",
  },
  "position created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "org_structure",
  },
  "position updated": {
    destinations: ["logger", "activity_trail"],
    category: "org_structure",
  },
  "zone created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "org_structure",
  },
  "zone updated": {
    destinations: ["logger", "activity_trail"],
    category: "org_structure",
  },
  "asset created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "org_structure",
  },
  "asset updated": {
    destinations: ["logger", "activity_trail"],
    category: "org_structure",
  },
  "location created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "org_structure",
  },
  "location updated": {
    destinations: ["logger", "activity_trail"],
    category: "org_structure",
  },
  "team updated": {
    destinations: ["logger", "activity_trail"],
    category: "org_structure",
  },
  "legal_function assigned": {
    destinations: ["logger", "activity_trail", "engine_event"],
    category: "org_structure",
  },
  "profile granted": {
    destinations: ["logger", "activity_trail"],
    category: "org_structure",
  },
  "profile revoked": {
    destinations: ["logger", "activity_trail"],
    category: "org_structure",
  },
  "profile role updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "org_structure",
  },
  "profile department updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "org_structure",
  },
  "profile status updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "org_structure",
  },
  "profile deactivated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "org_structure",
  },
  "profile reactivated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "org_structure",
  },
  "profile login code sent": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "org_structure",
  },
  "invitation cancelled": {
    destinations: ["logger", "activity_trail"],
    category: "org_structure",
  },
  "invitation resent": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "org_structure",
  },
  "profession confirmed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "onboarding",
  },
  // ─── Telegram ─────────────────────────────────
  "telegram session_created": {
    destinations: ["logger", "activity_trail"],
    category: "telegram",
  },
  "telegram message_received": {
    destinations: ["logger", "activity_trail"],
    category: "telegram",
  },
  "telegram message_sent": {
    destinations: ["logger", "activity_trail"],
    category: "telegram",
  },
  "telegram escalation_sent": {
    destinations: ["logger", "activity_trail"],
    category: "telegram",
  },
  "telegram escalation_resolved": {
    destinations: ["logger", "activity_trail", "posthog"],
    category: "telegram",
  },
  "telegram poll_sent": {
    destinations: ["logger", "activity_trail"],
    category: "telegram",
  },
  "telegram poll_resolved": {
    destinations: ["logger", "activity_trail", "posthog"],
    category: "telegram",
  },
  "telegram bridge_opened": {
    destinations: ["logger", "activity_trail"],
    category: "telegram",
  },
  "telegram bridge_closed": {
    destinations: ["logger", "activity_trail"],
    category: "telegram",
  },
  "telegram bridge_message_relayed": {
    destinations: ["logger"],
    category: "telegram",
  },
  "session_task.created": {
    destinations: ["activity_trail", "engine_event", "posthog"],
    category: "operations",
  },
  "session_task.assigned": {
    destinations: ["activity_trail", "engine_event", "posthog"],
    category: "operations",
  },
  "task.added_manual": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },
  "communication.broadcast_sent": {
    destinations: ["activity_trail", "posthog"],
    category: "communication",
  },
  // ─── Auth OTP ─────────────────────────────────
  "auth otp_sent": { destinations: ["posthog", "logger"], category: "auth" },
  "auth otp_verified": { destinations: ["posthog", "logger"], category: "auth" },
  "auth otp_failed": { destinations: ["posthog", "logger"], category: "auth" },
  "auth logged_in": { destinations: ["posthog", "logger"], category: "auth" },
  "login_code sent": { destinations: ["posthog", "logger", "activity_trail"], category: "auth" },
  // emit site: apps/web/src/app/reset-password/page.tsx submit handler (password-reset form)
  // Pre-auth visitor event — the user has lost access and is not signed in, so actor_id is empty
  // at emit time. activity_trail.actor_id is NOT NULL UUID, so routing here would silently fail
  // the insert per ADR-0134 + L-0083. PostHog + logger carry the (email-hashed) analytics record.
  "auth password_reset_requested": {
    destinations: ["posthog", "logger"],
    category: "auth",
  },
  // emit site: apps/web/src/app/reset-password/page.tsx post-updateUser success handler
  "auth password_reset_completed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "auth",
  },
  // ─── Security ─────────────────────────────────
  "security rate_limited": { destinations: ["logger", "activity_trail"], category: "security" },
  "security lockout_triggered": {
    destinations: ["logger", "activity_trail"],
    category: "security",
  },
  "security sandbox_blocked": { destinations: ["logger", "activity_trail"], category: "security" },
  // ADR-0099: unified authority gate — every gate_action evaluation and every denial.
  "gate evaluated": {
    destinations: ["posthog", "activity_trail"],
    category: "security",
  },
  "gate denied": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "security",
  },
  "workspace abandoned": {
    destinations: ["logger", "activity_trail", "engine_event"],
    category: "security",
  },
  // ─── Enrichment ────────────────────────────────
  "enrichment requested": { destinations: ["posthog", "logger"], category: "enrichment" },
  "enrichment hit": { destinations: ["posthog", "logger"], category: "enrichment" },
  "enrichment missed": { destinations: ["posthog", "logger"], category: "enrichment" },
  "enrichment corrected": { destinations: ["posthog", "logger"], category: "enrichment" },

  // Shift swap events (ADR-0067)
  "shift_swap.requested": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "shift_swap.accepted": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "shift_swap.rejected": {
    destinations: ["posthog", "activity_trail"],
    category: "scheduling",
  },
  "shift_swap.approved": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "shift_swap.executed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "shift_swap.cancelled": {
    destinations: ["posthog", "activity_trail"],
    category: "scheduling",
  },

  // ─── Platform Admin: Service Config ─────────────
  "service_config created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "system",
  },
  "service_config updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "system",
  },
  "service_config restarted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "system",
  },
  "service_config deleted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "system",
  },

  // ─── Schedule Audit: Rollback ──────────────────
  "schedule rollback": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },

  // ─── Operations Intelligence (ADR-0088) ────────
  "ops.compile day_brief": {
    destinations: ["logger", "engine_event"],
    category: "ops_intelligence",
  },
  "ops.compile preclose_summary": {
    destinations: ["logger", "engine_event"],
    category: "ops_intelligence",
  },
  "ops.compile shift_brief": {
    destinations: ["logger", "engine_event"],
    category: "ops_intelligence",
  },
  "ops.triage classified": {
    destinations: ["logger", "engine_event"],
    category: "ops_intelligence",
  },
  // Phase 2: MONITOR + ACT events
  "ops.monitor late_punchin": {
    destinations: ["logger", "engine_event"],
    category: "ops_intelligence",
  },
  "ops.monitor no_show": { destinations: ["logger", "engine_event"], category: "ops_intelligence" },
  "ops.monitor task_overdue": {
    destinations: ["logger", "engine_event"],
    category: "ops_intelligence",
  },
  "ops.monitor critical_task_missed": {
    destinations: ["logger", "engine_event"],
    category: "ops_intelligence",
  },
  "ops.monitor understaffing": {
    destinations: ["logger", "engine_event"],
    category: "ops_intelligence",
  },
  "ops.monitor session_approaching_close": {
    destinations: ["logger", "engine_event"],
    category: "ops_intelligence",
  },
  "ops.monitor unsigned_session": {
    destinations: ["logger", "engine_event"],
    category: "ops_intelligence",
  },
  "ops.monitor alerts_queried": {
    destinations: ["logger", "engine_event"],
    category: "ops_intelligence",
  },
  "ops.monitor session_intelligence_queried": {
    destinations: ["logger", "engine_event"],
    category: "ops_intelligence",
  },
  "ops.act escalated": {
    destinations: ["logger", "engine_event", "activity_trail"],
    category: "ops_intelligence",
  },
  "ops.act tasks_redistributed": {
    destinations: ["logger", "engine_event", "activity_trail"],
    category: "ops_intelligence",
  },
  "ops.act session_frozen": {
    destinations: ["logger", "engine_event", "activity_trail"],
    category: "ops_intelligence",
  },
  // Phase 3: PREDICT + LEARN events
  "ops.predict generated": {
    destinations: ["logger", "engine_event"],
    category: "ops_intelligence",
  },
  "ops.predict coverage_queried": {
    destinations: ["logger", "engine_event"],
    category: "ops_intelligence",
  },
  "ops.predict compliance_queried": {
    destinations: ["logger", "engine_event"],
    category: "ops_intelligence",
  },
  "ops.learn pattern_extracted": {
    destinations: ["logger", "engine_event"],
    category: "ops_intelligence",
  },
  "ops.learn retention_cleaned": {
    destinations: ["logger", "engine_event"],
    category: "ops_intelligence",
  },
  "ops.learn patterns_queried": {
    destinations: ["logger", "engine_event"],
    category: "ops_intelligence",
  },

  // ─── Governance / Training MVP — Phase 0 (ADR-0101..0106) ────
  "policy published": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "training",
  },
  "observer_request created": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "training",
  },
  "observer_request claimed": {
    destinations: ["posthog", "activity_trail"],
    category: "training",
  },
  "observer_request resolved": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "training",
  },
  "approval requested": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "training",
  },
  "approval resolved": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "training",
  },
  "reminder sent": {
    destinations: ["posthog", "logger"],
    category: "training",
  },
  "reminder opened": {
    destinations: ["posthog"],
    category: "training",
  },
  "reminder converted": {
    destinations: ["posthog", "activity_trail"],
    category: "training",
  },

  // ─── Billing (ADR-0118 / ADR-0125) ───
  // Route via billing_activity_log, never activity_trail (profile-scoped actor
  // model can't admit platform-admin writers). engine_event drives the
  // invoice_lifecycle state machine seeded in Phase 1.10.
  "invoice generated": {
    destinations: ["posthog", "logger", "billing_activity_log", "engine_event"],
    category: "billing",
  },
  "invoice issued": {
    destinations: ["posthog", "logger", "billing_activity_log", "engine_event"],
    category: "billing",
  },
  "invoice sent": {
    destinations: ["logger", "billing_activity_log", "engine_event"],
    category: "billing",
  },
  "invoice marked_paid": {
    destinations: ["posthog", "logger", "billing_activity_log", "engine_event"],
    category: "billing",
  },
  "invoice voided": {
    destinations: ["logger", "billing_activity_log", "engine_event"],
    category: "billing",
  },
  "invoice marked_uncollectible": {
    destinations: ["logger", "billing_activity_log", "engine_event"],
    category: "billing",
  },
  "invoice overdue_detected": {
    destinations: ["logger", "billing_activity_log", "engine_event"],
    category: "billing",
  },
  "invoice credit_note_issued": {
    destinations: ["logger", "billing_activity_log", "engine_event"],
    category: "billing",
  },
  "invoice basis_drift_detected": {
    destinations: ["logger", "billing_activity_log", "engine_event"],
    category: "billing",
  },
  "usage_snapshot created": {
    destinations: ["logger", "billing_activity_log"],
    category: "billing",
  },
  "pricing_terms updated": {
    destinations: ["posthog", "logger", "billing_activity_log"],
    category: "billing",
  },
  "dunning_note added": {
    destinations: ["logger", "billing_activity_log"],
    category: "billing",
  },

  // ─── Billing Fase 2 (ADR-0126 to ADR-0130) ───
  // Dispatch lifecycle. `dispatch failed` surfaces to posthog + alerting
  // per spec §11; `retried` is logger-only (high-volume debug).
  "invoice dispatched": {
    destinations: ["posthog", "logger", "billing_activity_log", "engine_event"],
    category: "billing",
  },
  "invoice dispatch failed": {
    destinations: ["posthog", "logger", "billing_activity_log", "engine_event"],
    category: "billing",
  },
  "invoice dispatch retried": {
    destinations: ["logger"],
    category: "billing",
  },
  "invoice dispatch retry_requested": {
    destinations: ["logger", "billing_activity_log"],
    category: "billing",
  },

  // Integration sync. `mocked` is the PlaceholderAdapter emit per ADR-0129
  // and stays logger-only so audit readers do not conflate it with real
  // adapter success.
  "integration sync succeeded": {
    destinations: ["posthog", "logger", "billing_activity_log", "engine_event"],
    category: "billing",
  },
  "integration sync failed": {
    destinations: ["posthog", "logger", "billing_activity_log", "engine_event"],
    category: "billing",
  },
  "integration sync mocked": {
    destinations: ["logger"],
    category: "billing",
  },
  "integration test_connection succeeded": {
    destinations: ["logger", "billing_activity_log"],
    category: "billing",
  },
  "integration test_connection failed": {
    destinations: ["logger", "billing_activity_log"],
    category: "billing",
  },

  // ADR-0129 audit-safety: adapter violated the placeholder contract.
  // High-severity — PostHog + billing_activity_log + engine_event so both
  // PostHog alerts and the admin audit queries catch the anomaly.
  "integration audit violation": {
    destinations: ["posthog", "logger", "billing_activity_log", "engine_event"],
    category: "billing",
  },

  // Invoice editing (platform-admin manual lines + ad-hoc drawer).
  "invoice line_item added": {
    destinations: ["posthog", "logger", "billing_activity_log"],
    category: "billing",
  },
  "invoice line_item edited": {
    destinations: ["posthog", "logger", "billing_activity_log"],
    category: "billing",
  },
  "invoice line_item removed": {
    destinations: ["posthog", "logger", "billing_activity_log"],
    category: "billing",
  },
  "invoice adhoc_created": {
    destinations: ["posthog", "logger", "billing_activity_log"],
    category: "billing",
  },

  // Workspace-admin manual "mark paid". engine_event so the state machine
  // treats it as a settlement event (parity with invoice marked_paid).
  "workspace marked_paid": {
    destinations: ["posthog", "logger", "billing_activity_log", "engine_event"],
    category: "billing",
  },

  // Rule CRUD — audit trail in billing_activity_log for who changed what.
  "dispatch_rule created": {
    destinations: ["posthog", "logger", "billing_activity_log"],
    category: "billing",
  },
  "dispatch_rule updated": {
    destinations: ["posthog", "logger", "billing_activity_log"],
    category: "billing",
  },
  "dispatch_rule deleted": {
    destinations: ["posthog", "logger", "billing_activity_log"],
    category: "billing",
  },

  // Integration CRUD — same pattern.
  "integration created": {
    destinations: ["posthog", "logger", "billing_activity_log"],
    category: "billing",
  },
  "integration updated": {
    destinations: ["posthog", "logger", "billing_activity_log"],
    category: "billing",
  },
  "integration deleted": {
    destinations: ["posthog", "logger", "billing_activity_log"],
    category: "billing",
  },

  // Debug-only: rule-evaluation summary per dispatch cycle.
  "dispatch_rule evaluated": {
    destinations: ["logger"],
    category: "billing",
  },

  // ─── Billing Fase 3A (ADR-0131, ADR-0128, ADR-0141–ADR-0144) ───
  // payment lifecycle. `payment succeeded` routes to engine_event so the
  // dunning suppressor + any downstream workflow can react. `payment
  // failed` surfaces to posthog for alerting (ADR-0131 ops visibility).
  "payment initiated": {
    destinations: ["posthog", "logger", "billing_activity_log"],
    category: "billing",
  },
  "payment succeeded": {
    destinations: ["posthog", "logger", "billing_activity_log", "engine_event"],
    category: "billing",
  },
  "payment failed": {
    destinations: ["posthog", "logger", "billing_activity_log"],
    category: "billing",
  },
  "payment refunded": {
    destinations: ["posthog", "logger", "billing_activity_log"],
    category: "billing",
  },

  // Dunning escalation — engine_event so the state machine can react
  // (e.g. future automatic collection-notice handover).
  "invoice dunning_escalated": {
    destinations: ["posthog", "logger", "billing_activity_log", "engine_event"],
    category: "billing",
  },

  // ADR-0142 automatic credit-note. engine_event so settlement audit
  // correctly pairs the credit-note with the refund that triggered it.
  "invoice credit_note_auto_created": {
    destinations: ["posthog", "logger", "billing_activity_log", "engine_event"],
    category: "billing",
  },

  // ADR-0141 PII read audit. Logger + billing_activity_log only —
  // intentionally NOT in PostHog (support traffic would flood).
  platform_admin_pii_read: {
    destinations: ["logger", "billing_activity_log"],
    category: "billing",
  },

  // ─── Billing Fase 3B — CSV/PDF-eksport (platform-admin) ───
  // Lav-volum (månedlig). Logger + billing_activity_log dekker audit +
  // drift. Ingen PostHog fordi det er et platform-admin-click, ikke
  // produkt-metric.
  "billing ehf_export_generated": {
    destinations: ["logger", "billing_activity_log"],
    category: "billing",
  },
  "billing accountant_marked_paid": {
    destinations: ["logger", "billing_activity_log", "engine_event"],
    category: "billing",
  },

  // ─── Billing M3 — Accountant + Order events (ADR-A, 2026-05-02) ─
  // actor_id = user_identity.user_id (not profile_id) for accountant
  // events — blueprint §7 grants exception for category "billing" from
  // accountant origin. workspace_id null for list/sign-in/out events
  // where no workspace context exists.
  "order list_viewed": {
    destinations: ["posthog", "activity_trail"],
    category: "billing",
  },
  "order detail_viewed": {
    destinations: ["posthog", "activity_trail"],
    category: "billing",
  },
  "order downloaded": {
    destinations: ["posthog", "activity_trail", "billing_activity_log"],
    category: "billing",
  },
  "order exported": {
    destinations: ["posthog", "activity_trail", "billing_activity_log"],
    category: "billing",
  },
  "order marked_received": {
    destinations: ["posthog", "activity_trail", "billing_activity_log", "engine_event"],
    category: "billing",
  },
  "kartotek viewed": {
    destinations: ["posthog", "activity_trail"],
    category: "billing",
  },
  "kartotek section_failed": {
    destinations: ["logger", "activity_trail"],
    category: "billing",
  },
  "accountant signed_in": {
    destinations: ["posthog", "activity_trail"],
    category: "billing",
  },
  "accountant grant_listed": {
    destinations: ["posthog"],
    category: "billing",
  },
  "accountant signed_out": {
    destinations: ["posthog", "activity_trail"],
    category: "billing",
  },

  // ─── Journey Engine (ADR-0175, S1.1 2026-04-22) ────────────
  // All five events route to 4 destinations. engine_event drives the
  // mission state machine and Fjernkontroll card. activity_trail gives
  // the audit trail. posthog/logger supply analytics + ops visibility.
  // Registry keys use the space convention; engine-dispatch sees the
  // dot form after toDotNotation() (e.g., "journey.run_started").
  "journey run_started": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "journey",
  },
  "journey step_reached": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "journey",
  },
  "journey completed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "journey",
  },
  "journey stuck": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "journey",
  },
  "journey run_failed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "journey",
  },
  // ─── Journey Authoring (M4, ADR-0172) ─────
  // Authoring events route to audit + analytics, NOT engine_event.
  // Authoring does not drive the mission state machine — that's run-time
  // telemetry's job (see journey.run_started / step_reached / completed).
  "journey_version created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "journey",
  },
  "journey_version saved": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "journey",
  },
  "journey_version transitioned": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "journey",
  },
  "journey_version archived": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "journey",
  },

  // ─── Journey Authoring Wizard (ADR-0239) ─────
  // The wizard's 6-phase flow emits phase_advanced per save_draft with a
  // next_phase, and journey_published once at the Review-phase publish_draft.
  // Routed to all 4 destinations: engine_event powers the closed-loop
  // dashboard (FLOW.md spine), activity_trail audits the authoring decision,
  // posthog tracks completion funnel, logger surfaces ops visibility.
  "journey_authoring phase_advanced": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "journey",
  },
  "journey_authoring journey_published": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "journey",
  },

  // ─── Availability (ADR-0200, Sortie 2 Task H) ─────
  // set_own + cleared are state mutations → full 4-destination fanout so
  // engine_event downstream (demand recalculation, swap eligibility, etc.)
  // picks up the change alongside analytics + audit.
  // queried is read-only → 3 destinations (no engine_event). Queries are
  // observable for audit/analytics but don't drive the state machine.
  "availability.set_own": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "availability",
  },
  "availability.cleared": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "availability",
  },
  "availability.queried": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "availability",
  },

  // ─── Payroll Capability (ADR-0242, Wave 3 B7) ─────
  // update + set_pension: state mutations → 4 destinations (engine_event
  // allows downstream processes to react to payroll changes).
  // tax_card + salary: read-only queries → 3 destinations (no engine_event;
  // reads don't drive state machine per L-0023).
  "payroll.update_payroll_profile": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "payroll.set_pension_scheme": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "payroll.tax_card_queried": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "payroll.salary_queried": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },

  // ─── Contract Module (ADR-0243/0236, Wave 3 B7) ────
  // obligation_overdue + obligation_due_soon: obligation state transitions →
  // 4 destinations so engine_event can trigger push notifications + escalation.
  // amendment_proposed + amendment_signed + amendment_declined: 4 destinations
  // (C4 governance events must route to engine_event for authority audit).
  // acknowledgement.block_confirmed: 4 destinations (compliance trace).
  // pii.revealed: 4 destinations (security compliance — every PII access logged).
  "contract.obligation_overdue": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract.obligation_due_soon": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract.amendment_proposed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract.amendment_signed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract.amendment_declined": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract.acknowledgement.block_confirmed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract.pii.revealed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract.readiness.self_fill_requested": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },

  // ─── Contract Wave 4 UI (ADR-0241/0234/0236, Wave 4) ────
  // upserted_inline: people-page server action → 4 destinations (engine reacts to profile changes).
  // template_selected: UX funnel → 3 destinations (no engine_event — read-only selection).
  // send_initiated: C4 governance event → 4 destinations.
  // signing_link_opened: read-only click → 3 destinations (no engine_event).
  // obligation_assigned + completed: lifecycle state → 4 destinations.
  // pdf_preview_viewed: WCAG/compliance gate per ADR-0244 → 4 destinations.
  "employment_contract.upserted_inline": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contracts.compose.template_selected": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "contract.send_initiated": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract.signing_link_opened": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "contract.obligation_assigned": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract.obligation_completed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract.pdf_preview_viewed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  // ─── Legal Capability (ADR-0249, Phase 0c) ────────────────────────────────
  // aml_14_6.validated: posthog (funnel) + activity_trail (C4 legal audit).
  //   No engine_event — validation is advisory, not a state transition.
  // law_cited: posthog + logger — usage analytics, no PII, no audit requirement.
  // amendment_classified: posthog + activity_trail — 5yr Bokføringsloven §13 retention.
  //   No engine_event at Phase 0c stub — real classifier drives amendment flow.
  "legal.aml_14_6.validated": {
    destinations: ["posthog", "activity_trail"],
    category: "contracts",
  },
  "legal.law_cited": {
    destinations: ["posthog", "logger"],
    category: "contracts",
  },
  "legal.amendment_classified": {
    destinations: ["posthog", "activity_trail"],
    category: "contracts",
  },

  // ─── Help Hub (ADR-0219, campaign/core-module) ────────────
  // search_performed + article_opened: analytics + audit (user intent + usage).
  // escalated_to_ticket: full 3-destination fan-out — engine_event drives
  //   helpdesk state machine (ADR-0161); activity_trail + posthog for audit/analytics.
  // tts_invoked: posthog-only — low-value for audit, high-value for UX analytics (I-5).
  // forklar_enkelt_invoked: posthog + activity_trail — server-side rewrite is
  //   auditable per I-4 invariant (each rewrite must be traceable).
  "help.search_performed": {
    destinations: ["posthog", "activity_trail"],
    category: "help",
  },
  "help.article_opened": {
    destinations: ["posthog", "activity_trail"],
    category: "help",
  },
  "help.escalated_to_ticket": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "help",
  },
  "help.tts_invoked": {
    destinations: ["posthog"],
    category: "help",
  },
  "help.forklar_enkelt_invoked": {
    destinations: ["posthog", "activity_trail"],
    category: "help",
  },
  "help.active_ticket_badge_viewed": {
    destinations: ["posthog", "activity_trail"],
    category: "help",
  },
  "help.active_ticket_badge_clicked": {
    destinations: ["posthog", "activity_trail"],
    category: "help",
  },
  "help.tour_step_invoked": {
    destinations: ["posthog", "activity_trail"],
    category: "help",
  },
  "help.tour_completed": {
    destinations: ["posthog", "activity_trail"],
    category: "help",
  },
  "help.tour_cancelled": {
    destinations: ["posthog", "activity_trail"],
    category: "help",
  },
  "governance.content_updated": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "governance",
  },
  "page_takeover.action_proposed": {
    destinations: ["posthog", "activity_trail"],
    category: "page_takeover",
  },
  "page_takeover.action_confirmed": {
    destinations: ["posthog", "activity_trail"],
    category: "page_takeover",
  },
  "page_takeover.action_cancelled": {
    destinations: ["posthog", "activity_trail"],
    category: "page_takeover",
  },
  "page_takeover.action_executed": {
    destinations: ["posthog", "activity_trail"],
    category: "page_takeover",
  },

  // ─── Personal Capability (feat/botsson-personal-tools) ───────────────────
  "personal.note_added": {
    destinations: ["posthog", "activity_trail"],
    category: "agent",
  },
  "personal.task_created": {
    destinations: ["posthog", "activity_trail"],
    category: "agent",
  },
  "personal.reminder_set": {
    destinations: ["posthog", "activity_trail"],
    category: "agent",
  },
  "personal.history_queried": {
    destinations: ["posthog", "logger"],
    category: "agent",
  },
  "personal.setting_updated": {
    destinations: ["posthog", "activity_trail"],
    category: "agent",
  },
  // ─── Welcome Wizard (first-login) ────────────────────────────────────────
  // started + step_completed + skipped_optional: posthog (funnel analytics)
  //   + activity_trail (per-step audit for PII governance — who completed each
  //   step and when).
  // completed: posthog + logger + activity_trail + engine_event — completion
  //   triggers downstream onboarding flows via engine.
  "profile welcome_wizard_started": {
    destinations: ["posthog", "activity_trail"],
    category: "onboarding",
  },
  "profile welcome_wizard_step_completed": {
    destinations: ["posthog", "activity_trail"],
    category: "onboarding",
  },
  "profile welcome_wizard_completed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "onboarding",
  },
  "profile welcome_wizard_skipped_optional": {
    destinations: ["posthog", "activity_trail"],
    category: "onboarding",
  },

  // ─── Sixten Orchestrator (Phase 0d.1) ────────────────────────────────────
  // Platform-scoped: workspace_id null. Destinations: logger + engine_event
  // (no activity_trail — requires non-null workspace_id per ADR-0193).
  "sixten pulse_processed": {
    destinations: ["logger", "engine_event"],
    category: "system",
  },
  "sixten check_breach": {
    destinations: ["logger", "engine_event"],
    category: "system",
  },
  "sixten escalation": {
    destinations: ["logger", "engine_event"],
    category: "system",
  },
};
