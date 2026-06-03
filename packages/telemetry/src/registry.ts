import type { NonEmptyString } from "./non-empty-string.js";

// ─── Base Event Shape ───────────────────────────
export interface BaseEvent {
  // Nullable when an event is genuinely platform-scoped (billing_activity_log).
  // When present, must be NonEmptyString — no "" fallback permitted (ADR-0193).
  workspace_id: NonEmptyString | null;
  actor_id: NonEmptyString | null; // profile_id; null for pre-auth events where no identity exists yet
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
  | "page_takeover" // M3.2 (campaign/core-module — Page-Takeover Harness, ADR-0228)
  | "tips" // campaign/tips-handling Sortie 1 (spec 2026-04-28-tips-handling-hybrid-design)
  | "lovsen" // ADR-0256 — Lovsen Norwegian labor-law advisor (P1.S0)
  | "welcome" // ADR-0274 — Welcome Mission V0 (mission-engine first-meeting flow)
  | "inquiry" // ADR-0274 — Open inquiries cross-session state
  | "payroll" // ADR-0057 — Payroll Engine Phase 1
  | "pos" // ADR-0305 — POS integration adapter pattern
  | "shift_marketplace" // ADR-0306 — Open-shift marketplace
  | "scheduler" // ADR-0307/0309 — Constraint-solver scheduler greedy V1
  | "cost" // ui-shell-cost-polish — Cost overview telemetry
  | "hms" // ui-shell-hms-cluster-polish-read — HMS module read-surface telemetry
  | "cascade" // ADR-0356 — cascade-namespace delegation tools (cross-namespace writes)
  | "people" // SM-2-followup-training 2026-05-19 — People hub read-surface telemetry
  | "bulk_import" // ADR-0401 — bulk_import capability (Sortie A: parse_spreadsheet)
  | "oppgaver"; // P11 — Oppgaver read-surface telemetry (task board view + interaction events)

// ─── Entity Reference (for robust UI audit trails) ─
export interface EntityRef {
  entity_type: EntityType;
  entity_id: string;
  entity_label?: string; // Context-friendly label (e.g., "Tuesday 18:00 - Kitchen")
}

export type EntityType =
  | "company"
  | "user_identity"
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
  | "accountant_company_grant"
  // ─── Billing M7 — Avstemming / Settlement (ADR-E, 2026-05-02) ───
  | "settlement_run"
  | "settlement_period"
  | "settlement_artifact"
  // ─── Tips (campaign/tips-handling Sortie 1) ─────
  | "tip_pool"
  | "tip_distribution"
  // ─── People / Staff Events (ADR-0285) ────────────
  | "staff_event"
  // ─── Payroll Engine (ADR-0057, Phase 1) ─────────
  | "payroll_period"
  | "payroll_calculation"
  | "payroll_deviation"
  | "payroll_supplement_rule"
  | "payroll_timebank_entry"
  // ─── Payroll Engine Phase 3 (CSV Export) ─────────
  | "payroll_export_event"
  // ─── Botsson Chat Persistence (ADR-0296, F-CHAT-LIST) ───────
  | "engine_session"
  // ─── Session-Task Defense (ADR-0298, Sortie 1) ──────────────
  | "personal_task"
  | "schedule_day_task"
  | "emma_task"
  | "schedule_shift"
  // ─── Contracts Compliance Debt Cleanup (SMA-328 follow-up, ADR-0311) ─
  | "consent_document"
  // ─── POS Integration (ADR-0305, C1 sortie) ───────────────────
  | "pos_account"
  | "pos_sale_event"
  // ─── WFM Foundation — Open-shift marketplace (ADR-0306, C2 sortie) ─────────
  | "schedule_shift_offer"
  // ─── Dagslinjen targeted note (ADR-0331, Track E, 2026-05-15) ───────────────
  | "session_note"
  // ─── Timeline Templates (ADR-0334, T2 sortie 2026-05-16) ────────────────────
  | "timeline_template"
  // ─── Cost overview (ui-shell-cost-polish) ────────────────────────────────────
  | "cost_overview"
  // ─── Cascade Delegation (ADR-0356, Sortie 3 2026-05-17) ─────────────────────
  | "workspace_union_binding"
  | "supplement_rule"
  // ─── Day-Line Runtime (ADR-0367, BT0-FOUNDATION 2026-05-18) ─────────────────
  | "day_line"
  | "shift_session"
  | "day_line_item"
  // ─── Bootstrap Gate (ADR-0407, Phase 1) ──────────────────────────────────
  | "workspace_bootstrap_gate";

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
  properties: { data: { context: "workspace_entry" | "login" | "recovery" } };
}

export interface AuthOtpVerified extends BaseEvent {
  event: "auth otp_verified";
  properties: { data: { attempts: number; duration_ms: number } };
}

export interface AuthOtpFailed extends BaseEvent {
  event: "auth otp_failed";
  properties: { data: { reason: "expired" | "wrong_code" | "max_attempts" } };
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

// Mobile auth Universal-Link bridge — fires from the `/m/*` web bridge routes
// when a non-installer (desktop browser, or mobile without app installed) lands
// on a Universal-Link target. Lets us measure cross-device drop-off
// (email-on-desktop → bridge → fallback vs Universal-Link → app native).
//
// When app IS installed, the OS intercepts the URL before any web render runs —
// no `bridge_relayed` fires. So the absence of this event for a given session
// indicates successful app-intent capture.
export interface AuthBridgeRelayed extends BaseEvent {
  event: "auth bridge_relayed";
  properties: {
    data: {
      surface:
        | "oauth_callback"
        | "invite_callback"
        | "update_password"
        | "confirm_email"
        | "invite_token";
      // True if the bridge fired the scheme-URL relay before the fallback
      // HTML renders (best-effort — we cannot detect whether the OS intent
      // actually opened the app, only whether we attempted the relay).
      relay_attempted: boolean;
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

/** Emitted when an employee's profile is activated (trainee→active) via signed contract.
 * System-initiated (actor=system, ADR-0281). Distinct from ProfileReactivated
 * (inactive→active manual path). Source: employee_activation engine_process (ADR-0379).
 */
// Dual-registered per L-0072: interface + runtime EVENT_ROUTING entry.
export interface ProfileActivated extends BaseEvent {
  event: "profile activated";
  properties: {
    entity: EntityRef;
    data: { contract_id: string; submission_id: string };
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

/** Emitted when an admin adds a profile to a team. */
export interface ProfileTeamMemberAdded extends BaseEvent {
  event: "profile team_member added";
  properties: {
    entity: EntityRef;
    data: { team_id: string };
  };
}

/** Emitted when an admin removes a profile from a team. */
export interface ProfileTeamMemberRemoved extends BaseEvent {
  event: "profile team_member removed";
  properties: {
    entity: EntityRef;
    data: { team_id: string };
  };
}

/** Emitted when an admin updates emergency contact info on a user_identity row. */
export interface ProfileEmergencyContactUpdated extends BaseEvent {
  event: "profile emergency_contact updated";
  properties: {
    entity: EntityRef;
    data: Record<string, never>;
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

export interface ProfileWelcomeWizardDismissed extends BaseEvent {
  event: "profile welcome_wizard_dismissed";
  properties: {
    entity: EntityRef;
    data: { step: number; step_name: string };
  };
}

export interface ProfileWelcomeWizardResumed extends BaseEvent {
  event: "profile welcome_wizard_resumed";
  properties: {
    entity: EntityRef;
    data: { step: number; step_name: string };
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
      /** ADR-0430 Rule 6b: zone UUIDs assigned to shift at creation time.
       *  Optional — absent on pre-M2N shifts and unassigned template shifts.
       *  ADR-0356 Pattern B fields present when emitted from timeline-template
       *  (cross-namespace write). */
      zone_ids?: string[];
      actor_capability?: string;
      delegated_via?: string;
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
      /** ADR-0430 Rule 6b: zone UUIDs assigned at manual add time.
       *  Optional — absent when no zones requested (empty zone_ids[]). */
      zone_ids?: string[];
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

// Added 2026-06-10 (sortie audit-fsc04-day-control-server-actions, F-SC-04-13).
// Fires when a manager reassigns duty_leader_id on department_session
// through `updateDepartmentSessionDutyLeaderAction` (the Server Action that
// replaced the inline `<select onChange>` direct DB write in OversiktTab).
// Tracks the operational handover so downstream attribution (control plane,
// reconciliation pending_signoff) can resolve `duty_leader_id` to the right
// profile even when the assignee changes mid-day.
export interface SessionDutyLeaderUpdated extends BaseEvent {
  event: "session duty_leader_updated";
  properties: {
    entity: EntityRef;
    data: {
      department_session_id: string;
      department_id: string;
      session_date: string;
      previous_duty_leader_id: string | null;
      new_duty_leader_id: string | null;
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

// ─── Session-Task Defense: shift + hours confirmed (ADR-0298, Sortie 1) ────
export interface ShiftConfirmed extends BaseEvent {
  event: "shift confirmed";
  properties: {
    entity: EntityRef;
    metadata: {
      source: "session" | "mobile";
      channel: string;
    };
  };
}

export interface HoursConfirmed extends BaseEvent {
  event: "hours confirmed";
  properties: {
    entity: EntityRef;
    metadata: {
      source: "session" | "mobile";
      channel: string;
    };
  };
}

// ─── Task Capability Unified Events (ADR-0298 Sortie 3) ──────────────────────
// Single event family replacing per-source task events.
// entity_type per source: session_task | personal_task | schedule_day_task | emma_task.
// 30-day aliases (session_task.created, personal.task_created, emma_task completed,
// task.added_manual) are preserved; these unified events run in parallel.

/**
 * task.list_mine — Read-path observability event. Emitted by consumer (BFF or UI hook)
 * after a successful fn_list_my_tasks RPC call or stage-engine TS-fallback query.
 * NOT emitted inside the RPC body or listMine.execute — caller responsibility.
 * Destinations: posthog + logger only (read-path — no audit trail row, no engine_event).
 * ADR-0317: auth divergence invariant. ADR-0298 R4: service_role uses TS-fallback.
 * row_count enables p50/p95 task-list size analytics and empty-result detection.
 */
export interface TaskListMine extends BaseEvent {
  event: "task.list_mine";
  properties: {
    metadata: {
      row_count: number;
      path: "rpc" | "ts_fallback";
      window_days: number;
    };
  };
}

export interface TaskCreated extends BaseEvent {
  event: "task created";
  properties: {
    entity: EntityRef;
    metadata: {
      source: "session" | "personal" | "day_ad_hoc";
      actor_kind: string;
      assigned_to_self: boolean;
      hook_id?: string | null;
      compliance?: boolean;
      reason?: string;
      manual?: boolean;
      description?: string;
      scheduled_at?: string;
    };
  };
}

export interface TaskCompleted extends BaseEvent {
  event: "task completed";
  properties: {
    entity: EntityRef;
    metadata: {
      source: "session" | "personal" | "day_ad_hoc" | "emma";
      completed_via: "self" | "manager" | "agent";
    };
  };
}

export interface TaskCancelled extends BaseEvent {
  event: "task cancelled";
  properties: {
    entity: EntityRef;
    metadata: {
      source: "personal";
      reason: string;
    };
  };
}

/**
 * task.session_task_updated — Partial update of a session_task row via the
 * `task.update_session_task` capability tool (Wave 1 Phase A DnD re-timing).
 * Logs which fields were actually changed: scheduled_at and/or assigned_to.
 *
 * Emitted only when the gate allows + the workspace-scoped row exists +
 * the update succeeded (L-0177 fail-fast, ADR-0287 gate-mandatory).
 *
 * Destinations: posthog (DnD adoption), activity_trail (audit who/what),
 * engine_event (downstream workflows may react to assignee change e.g. notify).
 */
export interface TaskSessionTaskUpdated extends BaseEvent {
  event: "task.session_task_updated";
  properties: {
    entity: EntityRef;
    metadata: {
      source: "task.update_session_task";
      reason: string;
      /** Present when the caller updated the field. ISO-8601. */
      scheduled_at?: string;
      /** Present when the caller updated assignment. null = explicit unassign. */
      assigned_to?: string | null;
      /** ADR-0356 audit symmetry — capability that initiated the write. */
      actor_capability?: string;
      /** ADR-0356 delegation chain (e.g. 'day-line-dnd'). */
      delegated_via?: string;
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
 * session_task.overdue — A session_task crossed its due_at threshold without
 * being completed. Emitted by `session-task-overdue-cron` (Deno Edge Function)
 * when it flips status → 'overdue'. One emit per affected task per run.
 *
 * Destinations: activity_trail (audit) + engine_event (workflow reactions e.g.
 * auto-escalate or re-assign) + posthog (analytics: overdue rate per workspace).
 *
 * actor_id: SYSTEM_ACTOR_ID (00000000-0000-0000-0000-000000000001) — cron actor.
 * workspace_id: non-null (all session_task rows are workspace-scoped).
 */
export interface SessionTaskOverdue extends BaseEvent {
  event: "session_task.overdue";
  properties: {
    entity: EntityRef;
    metadata: {
      /** Profile that was assigned to the task (null if unassigned). */
      assigned_to: string | null;
      /** ISO-8601 original due_at from session_task. */
      due_at: string;
      /** Minutes elapsed past the due_at threshold. */
      elapsed_minutes: number;
      /** department_session_id the task belongs to. */
      department_session_id: string;
      /** Whether the task is compliance-required (HACCP, HMS, etc.). */
      is_compliance_required: boolean;
    };
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
      source: "web_day_control_tasks_tab" | "mobile_addsheet";
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

// Interaction event: manager opens the deviation detail drawer.
// posthog (engagement funnel) + logger (observability) + activity_trail (audit).
// No engine_event — viewing is not a state-machine input.
export interface DeviationViewed extends BaseEvent {
  event: "deviation viewed";
  properties: {
    entity: EntityRef;
    data: {
      status: string;
      severity: string;
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

// Interaction event: user clicks a chapter in the sidebar nav.
// posthog (content engagement) + logger (observability) + activity_trail (audit).
// No engine_event — navigation is not a state-machine input.
export interface HandbookChapterOpened extends BaseEvent {
  event: "handbook chapter_opened";
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

// ─── Chat: Message Read Receipt ─────────────────────
export interface ChatMessageRead extends BaseEvent {
  event: "chat message_read";
  properties: {
    data: {
      channel_message_id: string;
      profile_id: string;
      read_at: string;
    };
  };
}

// ─── Chat: Typing Presence ──────────────────────────
export interface ChatTyping extends BaseEvent {
  event: "chat typing";
  properties: {
    data: { channel_id: string; profile_id: string };
  };
}

// ─── Chat: Message Delivered (presence-join ack) ────
// Fired on the SENDER side when a receiver broadcasts their presence-join
// event, transitioning sender's outbound messages from `sent` → `delivered`.
// Ephemeral — no durable column (Phase 2 T5, G1 decision: broadcast only).
export interface ChatMessageDelivered extends BaseEvent {
  event: "chat message_delivered";
  properties: {
    data: { channel_id: string; message_ids: string[] };
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

export interface ContractReviseOpened extends BaseEvent {
  event: "contracts.revise.opened";
  properties: {
    entity: EntityRef;
    data: {
      contract_id: string;
    };
  };
}

export interface CostOverviewViewed extends BaseEvent {
  event: "cost.overview.viewed";
  properties: {
    entity: EntityRef;
  };
}

// billing.invoices.viewed — emitted when admin/owner lands on /dashboard/billing.
//   posthog: adoption funnel (how often do admins check invoices?).
//   logger: observability.
//   activity_trail: admin engagement audit.
//   No engine_event — read-only surface; no downstream workflow reactions.
export interface BillingInvoicesViewed extends BaseEvent {
  event: "billing.invoices.viewed";
  properties: {
    entity: EntityRef;
    data: {
      /** Number of invoices rendered on first load. */
      invoice_count: number;
    };
  };
}

// ─── HMS Read-surface events (ui-shell-hms-cluster-polish-read) ─────────────
// hms.umbrella.viewed — emitted when manager lands on /dashboard/hms.
//   activity_trail records manager readiness-surface engagement; posthog tracks adoption.
// hms.drift.viewed — emitted when /dashboard/hms/drift loads; helps us know
//   how often drift is actively monitored vs. ignored.
// hms.documents.opened — emitted when /dashboard/hms/documents loads;
//   distinguishes passive-document vs. training engagement patterns.
// hms.training.viewed — emitted when /dashboard/hms/training loads;
//   training funnel analytics entry point.
// No engine_event: read-side HMS views do NOT trigger downstream workflow steps.

export interface HmsUmbrellaViewed extends BaseEvent {
  event: "hms.umbrella.viewed";
  properties: {
    entity: EntityRef;
    data: {
      // Snapshot of aggregate readiness at view time (0-100). Useful for cohort
      // analysis: managers who see low readiness → do they take action?
      workspace_readiness_percent: number;
    };
  };
}

export interface HmsDriftViewed extends BaseEvent {
  event: "hms.drift.viewed";
  properties: {
    entity: EntityRef;
    data: {
      // Number of active sessions visible to the user at view time.
      active_session_count: number;
    };
  };
}

export interface HmsDocumentsOpened extends BaseEvent {
  event: "hms.documents.opened";
  properties: {
    entity: EntityRef;
  };
}

export interface HmsTrainingViewed extends BaseEvent {
  event: "hms.training.viewed";
  properties: {
    entity: EntityRef;
    data: {
      // Total protocols in scope at view time; lets us see how readiness-load
      // affects return visit frequency.
      protocol_count: number;
    };
  };
}

// my.training.viewed — emitted when /dashboard/my-training loads (employee self-view).
// Distinct from hms.training.viewed (manager HMS surface) and people.training.viewed
// (manager people hub). PostHog + Logger only: activity_trail excluded — read-only view
// event; no downstream workflow triggered. protocol_count drives funnel analytics.
export interface MyTrainingViewed extends BaseEvent {
  event: "my.training.viewed";
  properties: {
    entity: EntityRef;
    data: {
      // Total protocols assigned to this employee at view time.
      protocol_count: number;
      // How many are already completed.
      completed_count: number;
    };
  };
}

// notifications.page_viewed — emitted when any profile lands on /dashboard/komm/varsler.
// Distinct from the bell-overlay peek (read-without-navigating). Unread count at view
// time feeds adoption funnel: do users who open the full page mark things read?
// PostHog + Logger only: activity_trail excluded — read-only view, no actor mutation.
// No engine_event: read-side surface; no downstream workflow triggered.
export interface NotificationsPageViewed extends BaseEvent {
  event: "notifications.page_viewed";
  properties: {
    data: {
      // Total unread count at the moment the page mounts.
      unread_count: number;
    };
  };
}

// people.training.viewed — emitted when /dashboard/people/training loads (manager view).
// Mirrors hms.training.viewed but scoped to the people hub surface.
// No engine_event: read-side view; no downstream workflow triggered.
export interface PeopleTrainingViewed extends BaseEvent {
  event: "people.training.viewed";
  properties: {
    entity: EntityRef;
    data: {
      // Total active+trainee profiles visible at view time.
      profile_count: number;
      // Workspace-level readiness snapshot (0-100) at view time.
      workspace_readiness_percent: number;
      // Count of expired assignments at view time.
      expired_count: number;
    };
  };
}

export interface ContractAwaitingSignatureViewed extends BaseEvent {
  event: "contracts.awaiting_signature.viewed";
  properties: {
    entity: EntityRef;
    data: {
      pending_count: number;
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

// ─── GDPR §13 Retention Events (ADR-0312, SMA-308) ──────────────────────────
// Emitted via inline INSERT INTO activity_trail in anonymize_contract RPC (SECURITY DEFINER).
// Two events distinguish successful anonymization from skipped (no clock anchor).
// paragraph_ref in payload distinguishes §13 (terminated/expired) from GDPR Art. 17 (declined).
// See: ADR-0312, Bokf.lov §13, GDPR Art. 17.

export interface ContractRetentionAnonymizedParagraf13 extends BaseEvent {
  event: "contract.retention_anonymized_§13";
  properties: {
    entity: EntityRef;
    data: {
      contract_id: string;
      workspace_id: string;
      terminated_at_or_end_date: string; // DATE ISO 8601
      cutoff_applied: string; // TIMESTAMPTZ ISO 8601
      status_at_anonymization: "terminated" | "expired" | "declined";
      paragraph_ref: "Bokf.lov §13" | "GDPR Art. 17";
      dry_run: boolean;
    };
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

// channel.viewed — emitted when /dashboard/komm root loads and a profileId resolves.
// PostHog + Logger only: read-only view event; no downstream workflow triggered.
// surface: "channels" | "chat" — which tab the user landed on.
export interface ChannelViewed extends BaseEvent {
  event: "channel.viewed";
  properties: {
    data: {
      surface: "channels" | "chat";
    };
  };
}

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

// ADR-0424 — Engine-dispatch action-type `invoke_capability_tool` telemetry.
// Emitted by the handler AFTER the capability tool execute() returns (success,
// denied, or error). workspace_id always from parent engine_state row — never
// from action.args (ADR-0151). gate_action_id links to the gate_evaluation row
// written before tool invocation. delegated_via carries the engine_process chain
// per ADR-0356 audit-symmetry contract ("engine_process:<id>:<step>").
// 4 destinations: posthog + logger + activity_trail + engine_event — so
// downstream consumers (e.g. monitoring rules) can react to tool failures;
// activity_trail provides per-step audit for C4 governance.
export interface EngineActionInvokedInvokeCapabilityTool extends BaseEvent {
  event: "engine.action.invoked.invoke_capability_tool";
  properties: {
    data: {
      engine_state_id: string; // UUID — the executing engine_state row
      engine_process_id: string; // process blueprint identifier
      step_index: number; // 0-based step index within the state
      capability_name: string; // e.g. "operations", "schedule"
      tool_name: string; // snake_case tool identifier
      gate_action_id: string | null; // UUID of gate_evaluation row; null if gate skipped (platform actor)
      delegated_via: string; // "engine_process:<id>:<step>" per ADR-0356
      tool_status: "success" | "denied" | "error"; // outcome of tool execute()
      tool_error: string | null; // error message when tool_status === "error"; null otherwise
      duration_ms: number | null; // wall-clock ms from gate pass to tool return; null if not measured
    };
  };
}

// ADR-0424 §Telemetry split — EF-side transport fact for invoke_capability_tool bridge.
// Emitted by engine-dispatch EF AFTER the fetch() to stage-engine returns (success or error).
// Distinct from `engine.action.invoked.invoke_capability_tool` (Node-side execution fact).
// 3 destinations: posthog + logger + activity_trail. NOT engine_event — Node side already
// writes the engine_event row for the execution; duplicating would produce two engine_event
// rows per invocation (same class as L-0094 phantom-emit-contracts).
// workspace_id always from engine_state row (ADR-0151).
export interface EngineDispatchBridgeInvoked extends BaseEvent {
  event: "engine.dispatch.bridge_invoked";
  properties: {
    data: {
      workspace_id: string; // from engine_state row — never from step config (ADR-0151)
      engine_state_id: string; // UUID of the executing engine_state
      engine_process_id: string; // process blueprint identifier (state.process_id)
      step_index: number; // step_order within the state
      capability_name: string; // e.g. "operations", "schedule"
      tool_name: string; // snake_case tool identifier
      bridge_status: "success" | "error"; // EF-layer outcome (fetch result)
      fetch_duration_ms: number; // wall-clock ms for fetch() call (network + Node endpoint total)
      endpoint_status: "ok" | "error"; // Node endpoint ok field; "error" on HTTP-level failure
      endpoint_error: string | null; // error string when endpoint_status === "error"; null otherwise
    };
  };
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
  properties: {
    channel_id: string;
    origin_type: string;
    message_type: string;
    // Wave A extensions — Nyheter audience targeting + notification priority
    audience_kind?: string;
    visibility_scope?: string;
    target_profile_count?: number;
    notification_priority?: number;
    notification_mode?: string;
    // V2 extensions — kind/tier/link/tags (Track D + Track F)
    announcement_kind?: string;
    announcement_tier?: string;
    announcement_tag_count?: number;
    announcement_has_link?: boolean;
    announcement_link_type?: string; // AnnouncementLinkType
    announcement_tier_overridden?: boolean;
    has_entity_link?: boolean;
    tag_count?: number;
    // ADR-0372 extension — celebration branch
    celebration_subtype?: string; // 'birthday' | 'work_anniversary'
  };
  entity: EntityRef;
}

// ─── Birthday celebration auto-publish (ADR-0372) ─────────────────────────────
//
// celebration.auto_published
//   Emitted by publish-birthday-celebrations Edge Function after a birthday announcement
//   is successfully published via publish_announcement_atomic.
//   posthog:       product analytics (adoption + celebration funnel).
//   activity_trail: audit — every auto-celebration is traceable to workspace + profile.
//   logger:        stdout observability for Edge Function run.
//   No engine_event: celebration publish is terminal, no downstream workflow reaction.
//
// Note: channel.message.sent is ALSO emitted per celebration (with celebration_subtype='birthday')
// for continuity with the existing message analytics pipeline (ADR-0372 Q8 dual emit).

export interface CelebrationAutoPublished extends BaseEvent {
  event: "celebration.auto_published";
  properties: {
    workspace_id: string;
    profile_id: string; // profile being celebrated
    channel_id: string;
    message_id: string;
    celebration_subtype: string; // 'birthday' | 'work_anniversary'
  };
  entity: EntityRef;
}

export interface CelebrationSkippedWorkspaceDisabled extends BaseEvent {
  event: "celebration.skipped_workspace_disabled";
  properties: {
    workspace_id: string;
    profile_id: string;
    celebration_subtype: string;
  };
  entity: EntityRef;
}

export interface CelebrationSkippedAlreadyPublished extends BaseEvent {
  event: "celebration.skipped_already_published";
  properties: {
    workspace_id: string;
    profile_id: string;
    celebration_subtype: string;
  };
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
  properties: {
    channel_id: string;
    message_id?: string;
  };
  entity: EntityRef;
}

export interface ChannelMessageUnpinned extends BaseEvent {
  event: "channel.message.unpinned";
  properties: {
    channel_id: string;
    message_id?: string;
  };
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

// ─── Announcement V2 Events (Track F — §12 spec 2026-05-18) ──────────────────
// Registered per ADR-0358: every event has a wired emit() call-site.
export interface AnnouncementLinkFollowed extends BaseEvent {
  event: "announcement.link_followed";
  properties: {
    message_id: string;
    kind: string; // AnnouncementKind
    link_type: string; // AnnouncementLinkType
    link_id: string;
  };
  entity: EntityRef; // entity_type: 'channel_message', entity_id: message_id
}

export interface AnnouncementKindChanged extends BaseEvent {
  event: "announcement.kind_changed";
  properties: {
    from_kind: string;
    to_kind: string;
    tier_auto_updated: boolean;
  };
}

export interface AnnouncementTierOverridden extends BaseEvent {
  event: "announcement.tier_overridden";
  properties: {
    kind: string;
    default_tier: string;
    chosen_tier: string;
  };
}

// ─── InlineConfirmCard HITL Gate Events (ADR-0398, Phase 1) ────────────────
//
// Four events covering the full HITL lifecycle for Botsson mutations rendered
// as an InlineConfirmCard. Emitted server-side (tool body) per L-0233 — voice
// context is separate and must not receive card descriptors.
//
// inline_confirm_card.shown
//   Emitted in publish_announcement.ts draft branch when capability returns
//   {phase:"draft"} and proposal_id. Call-site: T3 (parallel).
//
// inline_confirm_card.confirmed
//   Emitted in publish_announcement.ts commit branch after atomic RPC succeeds.
//   Call-site: T3 (parallel).
//
// inline_confirm_card.cancelled
//   Emitted when browser returns action:"cancel" via ClientToolCallResult roundtrip.
//   Call-site: T4 (deferred — BotssonChat client-tool impl).
//
// inline_confirm_card.edited
//   Emitted when browser returns action:"edit" with patch. edited_field_count
//   counts whitelisted editable_fields modified in the patch (per ADR-0398 §resume-payload).
//   Call-site: T4 (deferred — BotssonChat client-tool impl).
//
// Destinations: posthog + logger + activity_trail.
//   engine_event EXCLUDED — these are UI telemetry events, NOT workflow triggers.
//   (Sibling pattern: channel.message.sent — posthog + logger + activity_trail.)
//
export interface InlineConfirmCardShown extends BaseEvent {
  event: "inline_confirm_card.shown";
  properties: {
    surface: "announcement" | "message" | "shift_approve";
    proposal_id: string; // = p_client_message_id passed to atomic RPC
    recipient_count?: number;
  };
}

export interface InlineConfirmCardConfirmed extends BaseEvent {
  event: "inline_confirm_card.confirmed";
  properties: {
    surface: "announcement" | "message" | "shift_approve";
    proposal_id: string;
    recipient_count?: number;
  };
}

export interface InlineConfirmCardCancelled extends BaseEvent {
  event: "inline_confirm_card.cancelled";
  properties: {
    surface: "announcement" | "message" | "shift_approve";
    proposal_id: string;
  };
}

export interface InlineConfirmCardEdited extends BaseEvent {
  event: "inline_confirm_card.edited";
  properties: {
    surface: "announcement" | "message" | "shift_approve";
    proposal_id: string;
    edited_field_count: number; // count of whitelisted editable_fields present in patch
  };
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

// ─── Agent Schedule Query Events (feat/schedule-admin-view 2026-05-11) ────────
// Emitted by the schedule capability tools when a schedule query is executed.
// Read-only queries — no gate_action needed; telemetry provides query-pattern
// observability for admin-vs-employee traffic analytics.
// Destinations: posthog + logger + activity_trail (audit trail for schedule
// data access; no engine_event since these are read-only probes).
export interface AgentScheduleWorkspaceQueried extends BaseEvent {
  event: "agent.schedule.workspace_queried";
  properties: {
    data: {
      /** Calendar date queried (YYYY-MM-DD). */
      date: string;
      /** Department filter, null when workspace-wide. */
      department_id: string | null;
      /** Number of shift rows returned. */
      result_count: number;
      scope: "workspace";
    };
  };
}

export interface AgentScheduleDateQueriedSelf extends BaseEvent {
  event: "agent.schedule.date_queried_self";
  properties: {
    data: {
      /** Calendar date queried (YYYY-MM-DD). */
      date: string;
      /** Number of shift rows returned. */
      result_count: number;
      scope: "personal";
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

// ─── Botsson Chat Persistence (ADR-0296, F-CHAT-LIST) ─
// Emitted by:
//   - stage-engine: NOT emitted today (engine creates rows directly; clients
//     observe via list endpoint). Interface reserved for future stage-engine
//     emit + symmetry with archived.
//   - BFF        : botsson.session.archived from DELETE /api/botsson/sessions/[id]
export interface BotssonSessionCreated extends BaseEvent {
  event: "botsson.session.created";
  properties: {
    entity: EntityRef; // entity_type: "agent_session", entity_id: <uuid>
    data: {
      session_id: string;
      channel: "chat" | "voice";
      mode: "agent";
    };
  };
}

export interface BotssonSessionArchived extends BaseEvent {
  event: "botsson.session.archived";
  properties: {
    entity: EntityRef; // entity_type: "agent_session", entity_id: <uuid>, entity_label: <summary or 60ch truncate>
    data: {
      session_id: string;
      archived_by: string; // profile_id
      archived_at: string; // ISO
    };
  };
}

// ─── Botsson Authority Filtering (ADR-0327 Phase 3, ADR-0184) ─
// Emitted by:
//   - stage-engine : agent-router.ts, when bundle.authority.blockedTools is
//     non-empty after HarnessAdapter resolves the chat tool bundle.
// Closes the authority audit black hole: blockedTools + rule names now land in
// activity_trail + PostHog so audit replays can show what the harness filtered.
export interface BotssonAuthorityFiltered extends BaseEvent {
  event: "botsson.authority_filtered";
  properties: {
    entity: EntityRef; // entity_type: "agent_session", entity_id: <sessionId>
    data: {
      session_id: string;
      channel: "chat" | "voice";
      blocked_count: number;
      blocked_tools: string[]; // tool names
      blocked_rules: string[]; // AuthorityRuleName for each blocked tool
    };
  };
}

// ─── Attachment Deterministic Routing (Sortie 0) ─────────────────
// Emitted by:
//   - stage-engine : agent-router.ts, when MIME-type resolver matches a
//     spreadsheet attachment (.xlsx/.xls/.csv) BEFORE intent classification.
//     Forces bulk_import capability; intent-classifier is never called.
// Routing decision telemetry only — not a user action, no activity_trail.
export interface AttachmentRouted extends BaseEvent {
  event: "attachment.routed";
  properties: {
    data: {
      capability: string;
      source: "deterministic_attachment";
      filename: string;
      attachment_count: number;
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

// ─── Voice Runtime Quality Events (ADR-0282 R6 amendment 2026-05-10) ──────────
// Replaces synthetic VAD-bench gate (E9) with runtime observability.
// Emitted by services/voice-agent/src/agent.ts session event listeners.
// Destinations: posthog + logger only — these are OBSERVATIONAL, not workflow
// triggers (no engine_event) and not PII audit events (no activity_trail).
// Phase F1 reads PostHog dashboards to decide if config tuning is needed.
export interface VoiceFirstSpeechTs extends BaseEvent {
  event: "voice.first_speech_ts_ms";
  properties: {
    data: {
      session_id: string;
      /** Mission slug (e.g. "lise-interview", "mr-botsson"). String to avoid cross-package dependency. */
      mission_id: string;
      /** Milliseconds from session.start() to first user speech detected. */
      ts_ms: number;
    };
  };
}

export interface VoiceTurnEndTs extends BaseEvent {
  event: "voice.turn_end_ts_ms";
  properties: {
    data: {
      session_id: string;
      /** Mission slug (e.g. "lise-interview", "mr-botsson"). String to avoid cross-package dependency. */
      mission_id: string;
      /** Milliseconds from session.start() to this turn-end timestamp. */
      ts_ms: number;
      /** Sequential turn counter within the session (1-based). */
      turn_count: number;
    };
  };
}

export interface VoiceUserRecut extends BaseEvent {
  event: "voice.user_recut";
  properties: {
    data: {
      session_id: string;
      /** Mission slug (e.g. "lise-interview", "mr-botsson"). String to avoid cross-package dependency. */
      mission_id: string;
      /** Gap in ms between agent's last speech-end and user re-starting speech. */
      silence_duration_ms: number;
    };
  };
}

export interface VoiceSessionAbandonment extends BaseEvent {
  event: "voice.session_abandonment";
  properties: {
    data: {
      session_id: string;
      /** Mission slug (e.g. "lise-interview", "mr-botsson"). String to avoid cross-package dependency. */
      mission_id: string;
      /** Milliseconds from session.start() to user disconnect. */
      ts_ms: number;
    };
  };
}

// ─── Voice Bootstrap Snapshot Events (ADR-0297, feat/mobile-voice-bootstrap-pipe) ──────────────
// Emitted by POST /api/emma/voice/transcript (BFF) during workforce snapshot lifecycle.
// Routing: posthog + activity_trail.
//   posthog: bootstrap funnel analytics (cold-start vs drift-refresh adoption).
//   activity_trail: audit — snapshot dispatch is a data-transfer event that must be traceable.
//   No engine_event: these are informational events, not workflow-driving state transitions.
//   No logger-only: snapshot_assembly_failed needs audit trail for debugging PII-boundary issues.
export interface VoiceBootstrapSnapshotSent extends BaseEvent {
  event: "voice.bootstrap.snapshot_sent";
  properties: {
    entity: EntityRef;
    data: {
      session_id: string;
      livekit_room_id: string;
      /** Stable version token: `${workspaceId}:${profileId}:${unix_ms}` */
      snapshot_version: string;
      /** sha256(JSON.stringify(payload)) truncated to 16 hex chars */
      snapshot_hash: string;
      /** Serialised payload size in bytes (for size-guard monitoring) */
      payload_bytes: number;
      /** Whether payload was omitted and a payload_url was returned instead */
      size_guard_triggered: boolean;
      /**
       * Discriminator for how this snapshot_sent was triggered.
       * Absent on normal cold-start / drift-refresh (transcript route).
       * "payload_url_fetch" when emitted by GET /api/emma/voice/snapshot/:version.
       */
      trigger?: "payload_url_fetch";
    };
  };
}

export interface VoiceBootstrapSnapshotRefreshed extends BaseEvent {
  event: "voice.bootstrap.snapshot_refreshed";
  properties: {
    entity: EntityRef;
    data: {
      session_id: string;
      livekit_room_id: string;
      /** Version token of the stale snapshot sent by the client */
      stale_version: string;
      /** Version token of the refreshed snapshot */
      new_version: string;
      snapshot_hash: string;
      payload_bytes: number;
      size_guard_triggered: boolean;
    };
  };
}

export interface VoiceBootstrapSnapshotAssemblyFailed extends BaseEvent {
  event: "voice.bootstrap.snapshot_assembly_failed";
  properties: {
    entity: EntityRef;
    data: {
      session_id: string;
      livekit_room_id: string;
      /** Short error code — never PII, never full stack trace */
      error_code: string;
    };
  };
}

// ─── Voice Bootstrap Publish Events (ADR-0297, P3 mobile-voice-runtime-wire) ─────────────────────
// Emitted by the mobile app when publishing the botsson-context data-channel message.
// snapshot_published — posthog + logger + activity_trail. Data-transfer audit.
// publish_failed    — posthog + logger + activity_trail. Error audit for degraded sessions.
export interface VoiceBootstrapSnapshotPublished extends BaseEvent {
  event: "voice.bootstrap.snapshot_published";
  properties: {
    entity: EntityRef;
    data: {
      /** Stable version token that was published: `${workspaceId}:${profileId}:${unix_ms}` */
      version: string;
      /** Serialised payload size in bytes */
      payload_bytes: number;
      /** Time (ms) from RoomEvent.Connected to successful publish */
      latency_ms: number;
      /** Always 'mobile' — disambiguates from future web publish path */
      device_type: "mobile";
    };
  };
}

export interface VoiceBootstrapPublishFailed extends BaseEvent {
  event: "voice.bootstrap.publish_failed";
  properties: {
    entity: EntityRef;
    data: {
      /** Snapshot version we attempted to publish */
      version: string;
      /** Human-readable failure reason (no PII) */
      reason: string;
      /** Number of attempts made (1 or 2) */
      attempts: number;
      /** Always 'mobile' */
      device_type: "mobile";
    };
  };
}

// ─── Voice Bootstrap RPC Events (P4 mobile-voice-runtime-wire, L-0234 closure) ──────────────────
// Emitted by the mobile app during tool-register and RPC round-trips.
// tool_registered      — posthog + logger + activity_trail. Confirms client-tool pipe is live.
// tool_register_failed — posthog + logger + activity_trail. Error audit for degraded sessions.
// rpc_completed        — posthog (latency funnel) + logger + activity_trail (AI-action audit).
// rpc_failed           — posthog + logger + activity_trail. Error audit.
export interface VoiceBootstrapToolRegistered extends BaseEvent {
  event: "voice.bootstrap.tool_registered";
  properties: {
    entity: EntityRef;
    data: {
      /** Number of tools registered in this batch (5 for mobile MVP) */
      tool_count: number;
      /** Always 'mobile' */
      device_type: "mobile";
    };
  };
}

export interface VoiceBootstrapToolRegisterFailed extends BaseEvent {
  event: "voice.bootstrap.tool_register_failed";
  properties: {
    entity: EntityRef;
    data: {
      /** Human-readable failure reason (no PII) */
      reason: string;
      /** Always 'mobile' */
      device_type: "mobile";
    };
  };
}

export interface VoiceBootstrapRpcCompleted extends BaseEvent {
  event: "voice.bootstrap.rpc_completed";
  properties: {
    entity: EntityRef;
    data: {
      /** Tool name that was invoked (e.g. "mobile_navigate_to") */
      tool: string;
      /** Correlation ID from voice-agent — links call to result in logs */
      call_id: string;
      /** Round-trip latency from DataReceived to result publish (ms) */
      latency_ms: number;
      /** Always 'mobile' */
      device_type: "mobile";
    };
  };
}

export interface VoiceBootstrapRpcFailed extends BaseEvent {
  event: "voice.bootstrap.rpc_failed";
  properties: {
    entity: EntityRef;
    data: {
      /** Tool name that was invoked (unknown if tool name unresolvable) */
      tool: string;
      /** Correlation ID from voice-agent */
      call_id: string;
      /** Human-readable failure reason (no PII) */
      reason: string;
      /** Always 'mobile' */
      device_type: "mobile";
    };
  };
}

// ─── Mobile AI Surface Events (P2 UI scaffold, feat/mobile-mobile-voice-bootstrap-pipe) ─────────
// Emitted by the mobile app UI layer (not BFF) for interaction funnel analytics.
// fab.long_press — posthog + logger. Non-auditable interaction signal.
// ai_prefs.changed — posthog + logger + activity_trail. Preference mutations are auditable.
// botsson_sheet.opened — posthog + logger. Non-auditable session-start signal.
export interface MobileFabLongPress extends BaseEvent {
  event: "mobile.fab.long_press";
  properties: {
    data: {
      device_type: "mobile";
    };
  };
}

export interface MobileAiPrefsChanged extends BaseEvent {
  event: "mobile.ai_prefs.changed";
  properties: {
    data: {
      /** Which preference key changed */
      pref_key: string;
      /** Stringified new value — boolean "true"/"false", or string enum */
      pref_value: string;
      device_type: "mobile";
    };
  };
}

export interface MobileBotssonSheetOpened extends BaseEvent {
  event: "mobile.botsson_sheet.opened";
  properties: {
    data: {
      source: "fab_long_press" | "fab_swipe_layer_2" | "intent";
      device_type: "mobile";
    };
  };
}

// ─── Mobile Chat Events (P5 mobile-voice-runtime-wire 2026-05-20) ────────────
// Emitted by use-emma-chat.ts on the mobile thin client.
// message_sent: posthog (funnel analytics) + logger + activity_trail (message-send audit).
//   No engine_event — informational, not workflow-driving.
// response_received: posthog (latency funnel) + logger + activity_trail (AI-action audit).
//   No engine_event — informational.
// error: posthog (error funnel) + logger + activity_trail (error audit for degraded sessions).
//   No engine_event — not a state-machine input.
export interface MobileChatMessageSent extends BaseEvent {
  event: "mobile.chat.message_sent";
  properties: {
    data: {
      /** Character length of the message — no PII. */
      length: number;
      /** Whether a stage-engine session_id was supplied (warm vs cold turn). */
      session_id_present: boolean;
      device_type: "mobile";
    };
  };
}

export interface MobileChatResponseReceived extends BaseEvent {
  event: "mobile.chat.response_received";
  properties: {
    data: {
      /** End-to-end latency from send() call to response parsed (ms). */
      latency_ms: number;
      /** Character length of the agent response — no PII. */
      response_length: number;
      /** Routed intent returned by stage-engine (e.g. "schedule", "profile"). */
      intent?: string;
      device_type: "mobile";
    };
  };
}

export interface MobileChatError extends BaseEvent {
  event: "mobile.chat.error";
  properties: {
    data: {
      /** Short error code — never PII, never full stack trace. */
      reason: string;
      /** HTTP status from BFF, or 0 for network failures. */
      status_code: number;
      device_type: "mobile";
    };
  };
}

// ─── Mobile Voice UX Events (P6 mobile-voice-runtime-wire 2026-05-20) ────────
// Emitted by use-botsson-voice-session.ts + botsson-provider.tsx on mobile.
// mic_permission_denied: posthog + logger + activity_trail.
//   posthog: permission-denial funnel (how many users hit this).
//   activity_trail: auditable — permission denial is a security-surface event.
//   No engine_event — not a workflow trigger.
// disconnect_recovered: posthog + logger.
//   posthog: reliability funnel (how often do we recover vs fail completely).
//   logger: debugging disconnect patterns. No activity_trail — transient infra event.
// disconnect_failed: posthog + logger + activity_trail.
//   activity_trail: degraded-session audit. posthog: reliability KPI.
// policy_flipped: posthog + logger + activity_trail.
//   activity_trail: governance audit — workspace policy change mid-session is a notable event.
export interface MobileVoiceMicPermissionDenied extends BaseEvent {
  event: "mobile.voice.mic_permission_denied";
  properties: {
    entity: EntityRef; // entity_type: "agent_session", entity_id: <channelId>
    data: {
      workspace_id: string;
      device_type: "mobile";
    };
  };
}

export interface MobileVoiceDisconnectRecovered extends BaseEvent {
  event: "mobile.voice.disconnect_recovered";
  properties: {
    entity: EntityRef; // entity_type: "agent_session", entity_id: <channelId>
    data: {
      workspace_id: string;
      /** Which retry attempt succeeded (1-based). */
      attempt: number;
      /** Milliseconds from first disconnect detection to successful reconnect. */
      recovery_ms: number;
      device_type: "mobile";
    };
  };
}

export interface MobileVoiceDisconnectFailed extends BaseEvent {
  event: "mobile.voice.disconnect_failed";
  properties: {
    entity: EntityRef; // entity_type: "agent_session", entity_id: <channelId>
    data: {
      workspace_id: string;
      /** Total retry attempts exhausted. */
      attempts: number;
      /** Total ms elapsed from first disconnect to final failure. */
      elapsed_ms: number;
      device_type: "mobile";
    };
  };
}

export interface MobileVoicePolicyFlipped extends BaseEvent {
  event: "mobile.voice.policy_flipped";
  properties: {
    entity: EntityRef; // entity_type: "agent_session", entity_id: <channelId>
    data: {
      workspace_id: string;
      /** HTTP status from BFF that indicated policy denial (typically 403). */
      status_code: number;
      device_type: "mobile";
    };
  };
}

// ─── Mobile Routine Events ───────────────────────────────────────────────────
// Emitted by useRoutineExtract hook (apps/mobile) after a photo-to-routine
// extraction succeeds. Routing: posthog + logger (no audit trail needed for
// a draft extraction — commit is the auditable action).
export interface MobileRoutinePhotoExtracted extends BaseEvent {
  event: "mobile.routine.photo_extracted";
  properties: {
    entity: { entity_type: "routine"; entity_id: string };
    data: {
      /** Number of steps returned in the draft */
      step_count: number;
    };
  };
}

// ─── Agent Memory Events (F-MEM-UNBLOCK-A3, Phase A3 items 3+4) ─────────────
// Emitted by session-manager.ts when a session expires or is abandoned and
// a summary is written to engine_memory.
// Routing: posthog (product analytics) + logger (debugging) + activity_trail
// (audit — memory mutations are auditable per ADR-0116).
// No engine_event — summary write is not a workflow trigger.
export interface AgentMemorySummaryWritten extends BaseEvent {
  event: "agent.memory.summary_written";
  properties: {
    data: {
      session_id: string;
      /** How the session ended: expired by TTL or explicitly abandoned */
      close_reason: "expired" | "abandoned";
      /** Char count of the written summary */
      summary_length: number;
      /** Number of user turns included in the summary */
      turn_count: number;
    };
  };
}

// ─── Agent Memory Added (SE02-03 closure, audit 2026-05-15) ─────────────────
// Emitted by /api/emma/memory POST when Emma writes a memory directly from
// chat (separate from summary_written which fires at session-end). Same
// destinations: posthog + logger + activity_trail. ADR-0116.
export interface AgentMemoryAdded extends BaseEvent {
  event: "agent.memory.added";
  properties: {
    data: {
      memory_id: string;
      /** Resolved memory_type stored on the row */
      memory_type: "preference" | "fact" | "summary" | "general" | "constant";
      /** Char count of the content (PII-safe — never log the content itself) */
      content_length: number;
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

// godmode.admin_access — audit every protected admin route visit by a godmode user.
// Per ADR-0410: every godmode route access must land in activity_trail.
export interface GodmodeAdminAccess extends BaseEvent {
  event: "godmode.admin_access";
  properties: {
    entity: EntityRef;
    data: {
      route: string;
    };
  };
}

// godmode.workspace_joined — godmode user auto-joined a workspace as admin.
// Per ADR-0410: profile insert + audit trail. Idempotent (returns existing if already member).
export interface GodmodeWorkspaceJoined extends BaseEvent {
  event: "godmode.workspace_joined";
  properties: {
    entity: EntityRef;
    data: {
      workspace_id: string;
      profile_id: string;
      was_existing: boolean;
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

// ─── Notification Read Mutations (ADR-0134 — agent-callable surface) ─────────
// notification.marked_read: single notification marked as read by the user or agent.
//   activity_trail: mutation audit — agent-callable via Botsson harness tools.
//   posthog: engagement analytics.
//   logger: operational stdout.
// notification.marked_all_read: bulk "mark all as read" action.
//   Same routing as single — one emit per bulk action (NOT per notification row).
export interface NotificationMarkedRead extends BaseEvent {
  event: "notification.marked_read";
  properties: {
    data: { notification_id: string; notification_type: string };
  };
}

export interface NotificationMarkedAllRead extends BaseEvent {
  event: "notification.marked_all_read";
  properties: {
    data: { marked_count: number };
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

// ADR-0151 Invariant I4 — forgery defence on /api/wizard/start voice BFF.
// Fires when body.workspace_id disagrees with JWT-resolved profile.workspace_id.
// resolved_workspace_id may be null when profile row exists but workspace_id is NULL
// (mid-onboarding state). Per ADR-0193 / L-0177: null is permitted, "" is forbidden.
export interface SecurityWorkspaceIdForgeryRejected extends BaseEvent {
  event: "security.workspace_id_forgery_rejected";
  properties: {
    data: {
      request_id: string;
      body_workspace_id: string | null;
      resolved_workspace_id: string | null;
      user_id: string;
      mission_id?: string;
    };
  };
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

// ─── Composition Orchestrator Gate (ADR-0204 SS-5, Audit 2026-05-06 M-02) ────
// Distinct from "gate evaluated" (individual gate_action call-site).
// gatedMutation() fires this after BOTH Pathway A + B resolve, carrying the
// composite decision. Underscore form is intentional — gatedMutation.ts
// comments use this name throughout; space form is already taken by the
// per-cap callGateAction event.
export interface GatedMutationEvaluated extends BaseEvent {
  event: "gate_evaluated";
  properties: {
    data: {
      capability: string;
      action_type: string;
      channel: string;
      allow: boolean;
      denied_by: "capability" | "data_rule" | "not_implemented" | null;
      correlation_id: string;
      gate_evaluation_id?: string | null;
      proposal_id?: string | null;
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

// ─── People / Staff Events ───────────────────────────────────────
// Staff events (innkalling) — utviklingssamtale, personalmøte, personalfest, annet.
// Routes to all three state-mutation destinations so engine_event can react
// (e.g. trigger follow-up journey) and activity_trail keeps a full audit record.
export interface StaffEventCreated extends BaseEvent {
  event: "staff_event created";
  properties: {
    entity: EntityRef;
    data: {
      event_type: "utviklingssamtale" | "personalmote" | "personalfest" | "annet";
      attendee_count: number;
    };
  };
}

// ─── Governance / Training MVP — Phase 0 (ADR-0101..0106) ──────
// Policy created via the /dashboard/policies create dialog.
export interface PolicyCreated extends BaseEvent {
  event: "policy created";
  properties: {
    entity: EntityRef;
    data: {
      policy_type: "operational" | "haccp" | "hr" | "safety" | "access" | "payroll" | "custom";
    };
  };
}

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

// Watchdog event: cron detected that a company with contract_status='active'
// has no non-void recurring invoice for the previous calendar month.
// Written directly to billing_activity_log by fn_check_billing_run()
// (SECURITY DEFINER, ADR-0125). entity_id = company_id (no invoice exists yet).
// feat/billing-cron-correctness R1, 2026-05-20.
export interface InvoiceGenerationMissing extends BaseEvent {
  event: "invoice generation_missing";
  properties: {
    entity_type: "company";
    entity_id: string; // company_id
    data: {
      company_id: string;
      period_from: string;
      period_to: string;
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

// ─── Billing Fase 3B — EHF settings (workspace-admin) ──────────────────────
// Firer når workspace-admin/owner slår EHF på/av eller oppdaterer
// peppol_participant_id. Company-scoped (workspace_id null) fordi
// EHF-konfigurasjonen følger org.nr., ikke enkelt workspace.
// activity_trail gir audit-trail; posthog gir produkt-metric på
// EHF-adopsjon på tvers av kunder.

export interface CompanyEhfSettingsUpdated extends BaseEvent {
  event: "company.ehf_settings_updated";
  properties: {
    entity_type: "company";
    entity_id: string;
    changes: {
      ehf_enabled: { before: boolean | null; after: boolean };
      peppol_participant_id: { before: string | null; after: string | null };
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

// ─── Journey Authoring Wizard Events (ADR-0257) ──────────────────
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

// ─── Tips Events (campaign/tips-handling Sortie 1, spec 2026-04-28) ────────────
// Four events span the tip lifecycle: pool creation, per-employee distribution
// calculation, manual adjustment, and pool approval (lock).
//
// Naming: space form per registry convention ("tip_pool created", not dot form).
//
// tip_pool created       — 4 destinations (posthog + logger + activity_trail + engine_event)
//                          Leader sets the pool; engine_event drives distribution calculation.
// tip_distribution calculated — 2 destinations (logger + engine_event)
//                          High-volume (one row per employee per pool). No posthog/activity_trail
//                          to avoid noise; engine_event propagates to payroll-prep downstream.
// tip_distribution adjusted — 4 destinations (posthog + logger + activity_trail + engine_event)
//                          Explicit leader override; audit + analytics require full fanout.
// tip_pool approved      — 4 destinations (posthog + logger + activity_trail + engine_event)
//                          Terminal mutation before payout; full fanout.
export type TipAlgorithm = "equal" | "by_hours" | "by_role";

export interface TipPoolCreated extends BaseEvent {
  event: "tip_pool created";
  properties: {
    entity: {
      entity_type: "tip_pool";
      entity_id: string; // = pool_id
      entity_label: string; // e.g. "Kjøkken — tirsdag 22. apr"
    };
    data: {
      pool_id: string;
      department_session_id: string;
      amount_nok: number;
      distribution_count: number;
      algorithm: TipAlgorithm;
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
      /** Which schema keys were present in the params payload (for audit). */
      fields_changed: string[];
      /** True if any of the 5 tax-card fields were touched in this update. */
      tax_fields_touched: boolean;
    };
  };
}

export interface TipDistributionCalculated extends BaseEvent {
  event: "tip_distribution calculated";
  properties: {
    entity: {
      entity_type: "tip_distribution";
      entity_id: string; // = distribution_id
      entity_label: string;
    };
    data: {
      pool_id: string;
      distribution_id: string;
      profile_id: string;
      calculated_amount: number;
      weight_applied: number;
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

export interface TipDistributionAdjusted extends BaseEvent {
  event: "tip_distribution adjusted";
  properties: {
    entity: {
      entity_type: "tip_distribution";
      entity_id: string; // = distribution_id
      entity_label: string;
    };
    data: {
      distribution_id: string;
      pool_id: string;
      profile_id: string;
      old_amount: number | null;
      new_amount: number;
      reason: string; // min 5 chars enforced at capability layer
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

export interface TipPoolApproved extends BaseEvent {
  event: "tip_pool approved";
  properties: {
    entity: {
      entity_type: "tip_pool";
      entity_id: string; // = pool_id
      entity_label: string;
    };
    data: {
      pool_id: string;
      department_session_id: string;
      total_distributed: number;
      distribution_count: number;
      adjustment_count: number;
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

// ─── Tips Workspace Toggle (Phase 4 — settings UI) ───────────────────────────
// Single event covering both enable and disable. The `enabled` field in data
// distinguishes direction. category: "tips" (matches other tips events).
// 3 destinations: posthog (feature adoption) + logger + activity_trail (admin audit).
// engine_event excluded: no state-machine trigger downstream for a feature flag.
export interface TipsWorkspaceSettingsToggled extends BaseEvent {
  event: "tips_workspace_settings toggled";
  properties: {
    entity: {
      entity_type: "workspace";
      entity_id: string; // = workspace_id
    };
    data: {
      enabled: boolean;
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

// ─── Contract Dispatch UX Pass (SMA-303 + SMA-305 + SMA-307) ─────────────────

export interface ContractPreviewEdited extends BaseEvent {
  event: "contract.preview.edited";
  properties: {
    entity: EntityRef;
    data: {
      contract_id: string;
      edit_count: number;
    };
  };
}

export interface ContractSendBlockedMissingFields extends BaseEvent {
  event: "contract.send_blocked.missing_fields";
  properties: {
    entity: EntityRef;
    data: {
      target_profile_id: string;
      missing_fields: string[];
      field_count: number;
    };
  };
}

export interface PayrollAdminFilledPii extends BaseEvent {
  event: "payroll.admin_filled_pii";
  properties: {
    entity: EntityRef;
    data: {
      // NEVER log field values — count + group only (ADR-0077 + L-0172).
      target_profile_id?: string; // optional — lives in entity.entity_id, duplicated for filtering
      field_group: string;
      field_count: number;
      high_pii_acknowledged: boolean;
    };
  };
}

export interface ContractSendRetryAfterFill extends BaseEvent {
  event: "contract.send_retry_after_fill";
  properties: {
    entity: EntityRef;
    data: {
      target_profile_id: string;
      filled_groups: string[];
    };
  };
}

export interface ContractSendFailedServiceDown extends BaseEvent {
  event: "contract.send_failed.service_down";
  properties: {
    entity: EntityRef;
    data: {
      contract_id: string;
      error: string;
    };
  };
}

// ─── Contracts Compliance Cluster (SMA-306/307/310/311, ADR-0308-0310) ──────
// contract.dispatch_failed_safe: infra-level send failure — service unavailable.
//   Replaces ad-hoc usage; complements contract.send_failed.service_down alias.
// contract.aml_14_6.validation_failed: paired diagnostic for non-pass results.
// contract.pdf_gate.enforced: server persisted pdf_preview_viewed_at successfully.
// contract.pdf_gate.bypassed_attempt: scripted bypass detected (attack signal).
// gate.contract_send_denied: C4 gateAction denied a contract route.

export interface ContractDispatchFailedSafe extends BaseEvent {
  event: "contract.dispatch_failed_safe";
  properties: {
    entity: EntityRef;
    data: {
      contract_id: string;
      error: string;
      route: string; // e.g. "send" | "send_single" | "bulk_send"
    };
  };
}

export interface ContractAml146ValidationFailed extends BaseEvent {
  event: "contract.aml_14_6.validation_failed";
  properties: {
    entity: EntityRef;
    data: {
      contract_id: string;
      bokstaver_failed: string[]; // e.g. ["d", "j"]
      error_count: number;
      validation_mode: "strict" | "advisory";
      validator_version: string;
    };
  };
}

export interface ContractPdfGateEnforced extends BaseEvent {
  event: "contract.pdf_gate.enforced";
  properties: {
    entity: EntityRef;
    data: {
      contract_id: string;
      pdf_preview_viewed_at: string; // ISO timestamp persisted to DB
    };
  };
}

export interface ContractPdfGateBypassed extends BaseEvent {
  event: "contract.pdf_gate.bypassed_attempt";
  properties: {
    entity: EntityRef;
    data: {
      contract_id: string;
      reason: "missing_field" | "future_timestamp" | "not_persisted";
    };
  };
}

export interface GateContractSendDenied extends BaseEvent {
  event: "gate.contract_send_denied";
  properties: {
    entity: EntityRef;
    data: {
      contract_id: string;
      capability: "contract";
      action_type: string; // e.g. "send_single" | "revise" | "regenerate" | "compose" | "send_dispatch"
      reason: string | null;
      denied_by: string | null;
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
// Shape updated ADR-0310 (Q-H3): added bokstaver_failed[], rule_count, validator_version.
// Existing consumers gate on properties.data.stub === true (non-breaking add).
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
      /** Bokstaver that failed (e.g. ["d", "j"]). Empty array when pass=true. ADR-0310. */
      bokstaver_failed: string[];
      /** Number of framework_rule rows evaluated. ADR-0310. */
      rule_count: number;
      /** Phase 0c stub marker — absent when rule-driven validator is active. */
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

// ─── Lovsen — Norwegian Labor-Law Advisor (ADR-0256, P1.S0) ─────────────────
//
// 9 events covering the full Lovsen capability lifecycle:
// query receipt → intent classification → skill invocation → MCP fetch lifecycle
// → answer composition → confidence degradation → citation staleness.
//
// All 9 use dot-notation keys per the availability/page_takeover precedent in
// this file. Destinations: ['posthog', 'logger', 'activity_trail'] — no
// engine_event in P1.S0 (added in P1.S4 when capability layer lands).
//
// workspace_id + actor_id are NonEmptyString on all events (ADR-0134/ADR-0193).

export interface LovsenQueryReceived extends BaseEvent {
  event: "lovsen.query.received";
  workspace_id: NonEmptyString;
  actor_id: NonEmptyString;
  properties: {
    query: string;
    channel: string;
  };
}

export interface LovsenQueryClassified extends BaseEvent {
  event: "lovsen.query.classified";
  workspace_id: NonEmptyString;
  actor_id: NonEmptyString;
  properties: {
    intent: string;
    skill_picked: string;
    tier: number;
  };
}

export interface LovsenSkillInvoked extends BaseEvent {
  event: "lovsen.skill.invoked";
  workspace_id: NonEmptyString;
  actor_id: NonEmptyString;
  properties: {
    skill_name: string;
    skill_version: string;
  };
}

export interface LovsenMcpFetch extends BaseEvent {
  event: "lovsen.mcp.fetch";
  workspace_id: NonEmptyString;
  actor_id: NonEmptyString;
  properties: {
    mcp_server: string;
    tool: string;
    params: Record<string, unknown>;
  };
}

export interface LovsenMcpFetchCompleted extends BaseEvent {
  event: "lovsen.mcp.fetch.completed";
  workspace_id: NonEmptyString;
  actor_id: NonEmptyString;
  properties: {
    mcp_server: string;
    tool: string;
    latency_ms: number;
    cache_hit: boolean;
  };
}

export interface LovsenMcpFetchFailed extends BaseEvent {
  event: "lovsen.mcp.fetch.failed";
  workspace_id: NonEmptyString;
  actor_id: NonEmptyString;
  properties: {
    mcp_server: string;
    tool: string;
    error_kind: string;
    error_message: string;
  };
}

export interface LovsenAnswerComposed extends BaseEvent {
  event: "lovsen.answer.composed";
  workspace_id: NonEmptyString;
  actor_id: NonEmptyString;
  properties: {
    citation_count: number;
    confidence_level: "HØY" | "MEDIUM" | "LAV";
    escalation_recommended: boolean;
  };
}

export interface LovsenConfidenceDegraded extends BaseEvent {
  event: "lovsen.confidence.degraded";
  workspace_id: NonEmptyString;
  actor_id: NonEmptyString;
  properties: {
    score: number;
    reasons: string[];
  };
}

export interface LovsenCitationStale extends BaseEvent {
  event: "lovsen.citation.stale";
  workspace_id: NonEmptyString;
  actor_id: NonEmptyString;
  properties: {
    hash: string;
    paragraph_ref: string;
    fetched_at: string;
    age_hours: number;
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

// ─── Billing M7 — Avstemming / Settlement events (ADR-E, 2026-05-02) ─────────
// actor_id = user_identity.user_id (accountant). workspace_id null for
// cross-workspace run events (run spans multiple workspaces). workspace_id
// set per-workspace for period_locked / period_closed events.
//
// Routing rationale:
//  run_initiated: posthog (Erik's click funnel) + activity_trail (audit).
//  run_completed: posthog + activity_trail + billing_activity_log (compliance audit trail).
//  run_failed: logger + activity_trail + billing_activity_log (ops visibility + audit).
//  period_locked: posthog + activity_trail + billing_activity_log (state transition audit).
//  period_closed: posthog + activity_trail + billing_activity_log + engine_event (triggers downstream).
//  artifact_downloaded: posthog + activity_trail (analytics + access audit).

export interface SettlementRunInitiated extends BaseEvent {
  event: "settlement run_initiated";
  properties: {
    entity: EntityRef; // entity_type: "settlement_run"
    data: {
      period_start: string;
      period_end: string;
      workspace_count: number;
      scope: "single_workspace" | "all_workspaces";
    };
  };
}

export interface SettlementRunCompleted extends BaseEvent {
  event: "settlement run_completed";
  properties: {
    entity: EntityRef; // entity_type: "settlement_run"
    data: {
      run_id: string;
      period_start: string;
      period_end: string;
      workspace_count: number;
      artifact_count: number;
      /** ADR-0264: fan-out anchor for billing_activity_log. One audit row is
       *  inserted per company_id. Required for Bokføringsloven §10 coverage when
       *  the run spans multiple companies (workspace_id is null on this event). */
      company_ids?: string[];
    };
  };
}

export interface SettlementRunFailed extends BaseEvent {
  event: "settlement run_failed";
  properties: {
    entity: EntityRef; // entity_type: "settlement_run"
    data: {
      run_id: string;
      period_start: string;
      period_end: string;
      error: string;
      /** ADR-0264: fan-out anchor for billing_activity_log — same semantics as
       *  run_completed. Derived from companyMap (outer scope) in the catch block. */
      company_ids?: string[];
    };
  };
}

export interface SettlementPeriodLocked extends BaseEvent {
  event: "settlement period_locked";
  properties: {
    entity: EntityRef; // entity_type: "settlement_period"
    data: {
      workspace_id: string;
      period_start: string;
      period_end: string;
      /** ADR-0264: enables single-company path in billing_activity_log provider.
       *  This event is workspace-scoped; company_id is resolved from companyMap. */
      company_id?: string;
    };
  };
}

export interface SettlementPeriodClosed extends BaseEvent {
  event: "settlement period_closed";
  properties: {
    entity: EntityRef; // entity_type: "settlement_period"
    data: {
      workspace_id: string;
      period_start: string;
      period_end: string;
      closed_by: string;
    };
  };
}

export interface SettlementArtifactDownloaded extends BaseEvent {
  event: "settlement artifact_downloaded";
  properties: {
    entity: EntityRef; // entity_type: "settlement_artifact"
    data: {
      run_id: string;
      artifact_type: "summary_pdf" | "detail_csv" | "invoice_bundle_pdf" | "discrepancy_pdf";
    };
  };
}

// ─── Welcome Mission V0 Events (ADR-0274 + B5-fix per L-0046 space-form) ───
// Dual-registered per L-0072: interface + runtime EVENT_ROUTING entry.
export interface WelcomeStageAdvanced extends BaseEvent {
  event: "welcome stage_advanced";
  properties: {
    session_id: string;
    from_stage_id: string;
    to_stage_id: string;
    stage_idx: number;
  };
}

export interface WelcomeStageFailed extends BaseEvent {
  event: "welcome stage_failed";
  properties: {
    session_id: string;
    stage_id: string;
    stage_idx: number;
    attempts: number;
    last_error: string;
  };
}

export interface WelcomeMissionAbandoned extends BaseEvent {
  event: "welcome mission_abandoned";
  properties: {
    session_id: string;
    last_stage: string;
    reason: "user_left" | "channel_failure" | "stage1_timeout" | "resume_window_exceeded";
  };
}

export interface WelcomeSessionResumed extends BaseEvent {
  event: "welcome session_resumed";
  properties: {
    session_id: string;
    elapsed_hours: number;
    current_stage_id: string;
  };
}

export interface WelcomeSessionRestartedAfterWindow extends BaseEvent {
  event: "welcome session_restarted_after_window";
  properties: {
    abandoned_session_id: string;
    new_session_id: string;
    inquiries_carried_count: number;
  };
}

export interface WelcomeSpawnEvaluated extends BaseEvent {
  event: "welcome spawn_evaluated";
  properties: {
    profile_id: string;
    spawn_action: "spawned" | "skipped_existing" | "resumed";
  };
}

export interface WelcomeEarlyExitViaTransition extends BaseEvent {
  event: "welcome early_exit_via_transition";
  properties: {
    session_id: string;
    from_stage_id: string;
    to_mission_id: string;
  };
}

// ─── Inquiry Events (ADR-0274 — cross-session open threads) ───────────────
export interface InquiryNoted extends BaseEvent {
  event: "inquiry noted";
  properties: {
    inquiry_id: string;
    inquiry_type: string; // 'name' | 'vision' | 'startpoint' | 'demonstrated' | 'general'
    source_session_id: string;
    source_mission_id: string;
    priority: "low" | "normal" | "high";
  };
}

export interface InquiryClosed extends BaseEvent {
  event: "inquiry closed";
  properties: {
    inquiry_id: string;
    closed_by_session_id: string;
  };
}

// ─── Mission-capability events (ADR-0274 transition-tool) ─────────────────
export interface MissionTransitioned extends BaseEvent {
  event: "mission transitioned";
  properties: {
    from_session_id: string;
    to_session_id: string;
    from_mission_id: string;
    to_mission_id: string;
    from_stage_id: string;
  };
}

// ─── UI-capability extensions for Welcome Mission ─────────────────────────
export interface UiPointedAtSetting extends BaseEvent {
  event: "ui pointed_at_setting";
  properties: {
    session_id: string;
    setting_path: string;
  };
}

export interface UiDemoShown extends BaseEvent {
  event: "ui demo_shown";
  properties: {
    session_id: string;
    demo_id: string;
  };
}

// ─── Bulk Import Events (ADR-0401, Sortie A — parse_spreadsheet) ──────────────
// Dual-registered per L-0072: interface + runtime EVENT_ROUTING entry.
// Emitted by:
//   - packages/ai : bulk_import capability parse_spreadsheet tool, on successful
//     CSV parse. ONE emit per parse per ADR-0287.
// Routing: posthog (adoption analytics) + logger (debugging) + activity_trail
//   (audit — file parse is an auditable import action, workspace-scoped).
// No engine_event — Sortie A is read-only; no DB write = no workflow trigger.
export interface BulkImportBatchParsed extends BaseEvent {
  event: "bulk_import.batch_parsed";
  properties: {
    data: {
      workspace_id: string;
      profile_id: string;
      source_kind: "vaktliste" | "kjoreplan" | "mixed";
      sheet_count: number;
      row_count: number;
      excel_sha256: string;
      /** Fraction 0–1 of canonical fields auto-mapped from headers. */
      suggested_mapping_completeness: number;
    };
  };
}

// ─── Bootstrap Gate Events (ADR-0407, Phase 1) ──────────────────────────────
// bootstrap.gates_listed — activity_trail only (read, no mutation).
// bootstrap.gate_closed  — posthog + logger + activity_trail + engine_event.
// bootstrap.gate_skipped — posthog + logger + activity_trail + engine_event.
export interface BootstrapGatesListed extends BaseEvent {
  event: "bootstrap.gates_listed";
  properties: {
    entity: {
      entity_type: "workspace_bootstrap_gate";
      entity_id: string;
      entity_label?: string;
    };
    metadata: {
      open_gate_count: number;
    };
  };
}

export interface BootstrapGateClosed extends BaseEvent {
  event: "bootstrap.gate_closed";
  properties: {
    entity: {
      entity_type: "workspace_bootstrap_gate";
      entity_id: string;
      entity_label?: string;
    };
    metadata: {
      gate_slug: string;
      closed_via: string;
      gate_evaluation_id?: string;
    };
  };
}

export interface BootstrapGateSkipped extends BaseEvent {
  event: "bootstrap.gate_skipped";
  properties: {
    entity: {
      entity_type: "workspace_bootstrap_gate";
      entity_id: string;
      entity_label?: string;
    };
    metadata: {
      gate_slug: string;
      skip_reason: string;
      gate_evaluation_id?: string;
    };
  };
}

// ─── Bootstrap Setup Wizard View Event (axis-12, page-polish) ───────────────
// setup.wizard_viewed — posthog + logger + activity_trail.
//   posthog: funnel analytics (how many workspaces open the wizard vs complete it).
//   logger: debugging cold-start flow.
//   activity_trail: audit trace — owner opened workspace setup.
//   NO engine_event: viewing the wizard does not drive any workflow state transition.
// Call-site: DashboardSetupPage in apps/web/src/app/dashboard/setup/page.tsx
//   (once workspace_id + profileId resolved, gated by L-0177 nonEmpty).
export interface SetupWizardViewed extends BaseEvent {
  event: "setup.wizard_viewed";
  properties: {
    entity: {
      entity_type: "workspace";
      entity_id: string;
      entity_label: "Setup Wizard";
    };
    data: {
      /** Number of steps completed this session when the page loaded (0 on cold open). */
      steps_completed: number;
      /** Total steps in the wizard (currently 9). */
      total_steps: number;
    };
  };
}

// ─── Oppgaver Read-surface Events (P11 oppgaver-page) ───────────────────────
// Task board view + interaction events.
// No engine_event on any: read-path telemetry and UI state changes do NOT
// drive downstream workflow state-machine transitions.
// oppgaver.context_pinned: posthog + logger + activity_trail — pinning a
//   context is a user-intent signal worth auditing (manager chose focus point).
// All others: posthog + logger only — UI view/filter/focus events.

export interface OppgaverViewOpened extends BaseEvent {
  event: "oppgaver.view_opened";
  properties: {
    data: {
      date_iso: string;
      viewer_role: "owner" | "admin" | "manager";
    };
  };
}

export interface OppgaverViewModeChanged extends BaseEvent {
  event: "oppgaver.view_mode_changed";
  properties: {
    data: {
      from: "area" | "role" | "person";
      to: "area" | "role" | "person";
      triggered_by: "ui" | "tool";
    };
  };
}

export interface OppgaverAreaFilterChanged extends BaseEvent {
  event: "oppgaver.area_filter_changed";
  properties: {
    data: {
      active_area_count: number;
      triggered_by: "ui" | "tool";
    };
  };
}

export interface OppgaverDateChanged extends BaseEvent {
  event: "oppgaver.date_changed";
  properties: {
    data: {
      from_date: string;
      to_date: string;
      triggered_by: "ui" | "tool";
    };
  };
}

export interface OppgaverTaskFocused extends BaseEvent {
  event: "oppgaver.task_focused";
  properties: {
    data: {
      task_id: string;
      area_id: string | null;
    };
  };
}

export interface OppgaverContextPinned extends BaseEvent {
  event: "oppgaver.context_pinned";
  properties: {
    data: {
      date_iso: string;
      active_view: "area" | "role" | "person";
    };
  };
}

export interface OppgaverPulseNowClicked extends BaseEvent {
  event: "oppgaver.pulse_now_clicked";
  properties: {
    data: {
      /** Current time in absolute minutes (e.g. 875 for 14:35). */
      nowMinutes: number;
    };
  };
}

export interface OppgaverTemplateApplyClicked extends BaseEvent {
  event: "oppgaver.template_apply_clicked";
  properties: Record<string, never>;
}

/**
 * Fired when a manager drag-drops a task to a new time slot on the Gantt
 * (DnD re-timing, Wave 1b). workspace_id + actor_id come from BaseEvent.
 *
 * Destinations: posthog + activity_trail — a write-intent mutation (C4 via
 * gatedMutation in task capability) that produces a schedule deviation and
 * should be auditable alongside other manager task-mutation events.
 *
 * TODO emit-site added in Wave 1b by TA2 (DnD wiring) — this is a
 * controlled known gap closing within the same sortie (feat/dayplanner-dnd-and-views).
 * Not an L-0340 violation: registration and emit-site are intentionally split
 * across Wave 1a (Track A data layer) and Wave 1b (Track B DnD interaction).
 */
export interface OppgaverTaskReTimed extends BaseEvent {
  event: "oppgaver.task_re_timed";
  properties: {
    data: {
      task_id: string;
      /** Original scheduled_at — ISO 8601 */
      from_iso: string;
      /** New scheduled_at after DnD drop — ISO 8601 */
      to_iso: string;
      /** Assignee profile_id before re-timing (null if unassigned) */
      from_assignee: string | null;
      /** Assignee profile_id after re-timing (null if unassigned or unchanged) */
      to_assignee: string | null;
    };
  };
}

/**
 * oppgaver.location_filter_changed — manager switches the Område (location) filter
 * in LocationSwitcherPill. posthog + logger + activity_trail — filter changes are
 * a manager-intent signal worth auditing (same routing as oppgaver.context_pinned).
 */
export interface OppgaverLocationFilterChanged extends BaseEvent {
  event: "oppgaver.location_filter_changed";
  properties: {
    data: {
      /** Previous location_id or "all" */
      from_location: string;
      /** New location_id or "all" */
      to_location: string;
    };
  };
}

/**
 * oppgaver.close_day_clicked — manager taps the "Lukk dagen → AVV" CTA.
 * Placeholder stub; actual day-close flow is spec'd in a future sortie.
 * posthog + logger only — intent signal, no state-machine trigger yet.
 */
export interface OppgaverCloseDayClicked extends BaseEvent {
  event: "oppgaver.close_day_clicked";
  properties: {
    data: {
      /** ISO date of the day being closed */
      date_iso: string;
    };
  };
}

// ─── Oversikt (campaign/master-refactor — oversikt-v2 port) ──────────────────
// Manager daily cockpit. All events fire-and-forget (nav/view/intent, no DB write):
// destinations: posthog + logger.
// Exception noted inline: gap_fill_requested / dagsrapport_requested are honest
// intent stubs (hooks missing per PLAN.md).
export interface OversiktViewed extends BaseEvent {
  event: "oversikt.viewed";
  properties: { data: { date_iso: string } };
}
export interface OversiktBudgetEmptyStateShown extends BaseEvent {
  event: "oversikt.budget_empty_state_shown";
  properties: { data: { date_iso: string } };
}
export interface OversiktBriefWhyToggled extends BaseEvent {
  event: "oversikt.brief_why_toggled";
  properties: { data: { expanded: boolean } };
}
export interface OversiktBriefActionTaken extends BaseEvent {
  event: "oversikt.brief_action_taken";
  properties: { data: { action_type: string } };
}
export interface OversiktPulseTileClicked extends BaseEvent {
  event: "oversikt.pulse_tile_clicked";
  properties: { data: { tile_key: string } };
}
export interface OversiktActionQueueRowClicked extends BaseEvent {
  event: "oversikt.action_queue_row_clicked";
  properties: { data: { action_type: string } };
}
export interface OversiktActionCtaClicked extends BaseEvent {
  event: "oversikt.action_cta_clicked";
  properties: { data: { cta_key: string } };
}
export interface OversiktNavLinkClicked extends BaseEvent {
  event: "oversikt.nav_link_clicked";
  properties: { data: { source: string; target_route: string } };
}
export interface OversiktGapFillRequested extends BaseEvent {
  event: "oversikt.gap_fill_requested";
  properties: { data: { date_iso: string; gap_count: number } };
}
export interface OversiktReceiptNudgeSent extends BaseEvent {
  event: "oversikt.receipt_nudge_sent";
  properties: { data: { workspace_id: string } };
}
export interface OversiktDagsrapportRequested extends BaseEvent {
  event: "oversikt.dagsrapport_requested";
  properties: { data: { date_iso: string } };
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
  | ContractReviseOpened
  | ContractAwaitingSignatureViewed
  | CostOverviewViewed
  | BillingInvoicesViewed
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
  | HandbookChapterOpened
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
  | ChatMessageRead
  | ChatTyping
  | ChatMessageDelivered
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
  | ContractReviseOpened
  | ContractAwaitingSignatureViewed
  | CostOverviewViewed
  | BillingInvoicesViewed
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
  | ChannelViewed
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
  // ─── Engine Dispatch Action Invocation (ADR-0424) ──────────────────
  | EngineActionInvokedInvokeCapabilityTool
  | EngineDispatchBridgeInvoked
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
  | AnnouncementLinkFollowed
  | AnnouncementKindChanged
  | AnnouncementTierOverridden
  // ─── InlineConfirmCard HITL Gate Events (ADR-0398, Phase 1) ──────────────
  | InlineConfirmCardShown
  | InlineConfirmCardConfirmed
  | InlineConfirmCardCancelled
  | InlineConfirmCardEdited
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
  | DeviationViewed
  | SessionDutyLeaderUpdated
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
  | BotssonSessionCreated
  | BotssonSessionArchived
  | BotssonAuthorityFiltered
  | AttachmentRouted
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
  | GodmodeAdminAccess
  | GodmodeWorkspaceJoined
  | EmmaTaskScheduled
  | EmmaTaskCompleted
  | NotificationDeepLinkFollowed
  | NotificationMarkedRead
  | NotificationMarkedAllRead
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
  | ProfileActivated
  | ProfileDeactivated
  | ProfileReactivated
  | ProfileLoginCodeSent
  | ProfileTeamMemberAdded
  | ProfileTeamMemberRemoved
  | ProfileEmergencyContactUpdated
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
  | SessionTaskOverdue
  | TaskAddedManual
  | CommunicationBroadcastSent
  | AuthOtpSent
  | AuthOtpVerified
  | AuthOtpFailed
  | LoginCodeSent
  | AuthPasswordResetRequested
  | AuthPasswordResetCompleted
  | AuthBridgeRelayed
  | SecurityRateLimited
  | SecurityLockoutTriggered
  | SecuritySandboxBlocked
  | SecurityWorkspaceIdForgeryRejected
  | GateEvaluated
  | GateDenied
  | GatedMutationEvaluated
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
  | StaffEventCreated
  | PolicyCreated
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
  | InvoiceGenerationMissing
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
  | CompanyEhfSettingsUpdated
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
  // ─── Journey Authoring Wizard (ADR-0257) ─────────
  | JourneyAuthoringPhaseAdvanced
  | JourneyAuthoringJourneyPublished
  // ─── Availability (ADR-0200, Sortie 2) ───────────
  | AvailabilitySetOwn
  | AvailabilityCleared
  | AvailabilityQueried
  // ─── Tips (campaign/tips-handling Sortie 1) ──────
  | TipPoolCreated
  | TipDistributionCalculated
  | TipDistributionAdjusted
  | TipPoolApproved
  // ─── Tips settings toggle (Phase 4 — admin settings UI) ──
  | TipsWorkspaceSettingsToggled
  // ─── Payroll Capability (ADR-0242, Wave 3 B7) ────
  | PayrollUpdatePayrollProfile
  | PayrollSetPensionScheme
  | PayrollTaxCardQueried
  | PayrollSalaryQueried
  // ─── Payroll Engine Phase 1 (T4.3) ──────────────
  | PayrollPeriodCreated
  | PayrollPeriodLocked
  | PayrollPeriodApproved
  | PayrollDeviationAcknowledged
  | PayrollDeviationBlockedApproval
  | PayrollManualSupplementAdded
  | PayrollManualSupplementDeleted
  | PayrollOvertimeModeChanged
  | PayrollTimebankAccrued
  | PayrollTimebankWithdrawn
  | PayrollTimebankPayoutForced
  | PayrollTimebankBalanceAdjusted
  | PayrollSupplementRuleFired
  | PayrollSupplementRuleTestRun
  | PayrollRecalcTriggered
  | PayrollTariffFreezeDrift
  // ─── Payroll Engine Phase 2 (ADR-0292, T1.4) ────
  | PayrollLineOverrideProposed
  | PayrollLineOverrideApproved
  | PayrollLineOverrideRejected
  | PayrollLineOverridden
  | PayrollRecalcTriggeredBySupplement
  | PayrollRecalcTriggeredByTipDistribution
  // ─── Payroll Engine Phase 3 (CSV Export, T2.3) ────
  | PayrollCsvExported
  | PayrollCsvExportUnmasked
  | PayrollCsvExportFailed
  // ─── Payroll Engine Phase 4 (PDF Lønnsgrunnlag, ADR-0294) ────
  | PayrollLonnsgrunnlagGenerated
  | PayrollLonnsgrunnlagUrlGranted
  | PayrollLonnsgrunnlagGenerationFailed
  // ─── Payroll Engine — Feriepenger Basis (ADR-0295) ────
  | PayrollFeriepengerBasisComputed
  // ─── Payroll Engine Phase 5 (PII Reveal) ────
  | PayrollPersonalNumberRevealed
  | PayrollBankAccountRevealed
  // ─── Payroll Trekk-Samtykke (SMA-328, ADR-0311) ────
  | PayrollDeductionConsentReferenced
  | PayrollDeductionRejectedNoConsent
  // ─── Legal AML 14-15 (SMA-328, ADR-0311) ────
  | LegalAml1415Validated
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
  // ─── Contract Dispatch UX Pass (SMA-303 + SMA-305 + SMA-307) ─────────────
  | ContractPreviewEdited
  | ContractSendBlockedMissingFields
  | PayrollAdminFilledPii
  | ContractSendRetryAfterFill
  | ContractSendFailedServiceDown
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
  // ─── Lovsen (ADR-0256, P1.S0) ────────────────────
  | LovsenQueryReceived
  | LovsenQueryClassified
  | LovsenSkillInvoked
  | LovsenMcpFetch
  | LovsenMcpFetchCompleted
  | LovsenMcpFetchFailed
  | LovsenAnswerComposed
  | LovsenConfidenceDegraded
  | LovsenCitationStale
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
  | ProfileWelcomeWizardDismissed
  | ProfileWelcomeWizardResumed
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
  | AccountantSignedOut
  // ─── Billing M7 — Avstemming / Settlement (ADR-E, 2026-05-02) ─
  | SettlementRunInitiated
  | SettlementRunCompleted
  | SettlementRunFailed
  | SettlementPeriodLocked
  | SettlementPeriodClosed
  | SettlementArtifactDownloaded
  // ─── Calendar Redesign (feat/mobile-calendar-redesign, Phase 3a) ──
  | CalendarItemViewed
  | CalendarScopeChanged
  | CalendarFilterChanged
  | CalendarViewChanged
  | CalendarTabSwitched
  | CalendarDaySelected
  | CalendarHubViewed
  // ─── Business Intelligence Capability (ADR-0270) ─────────────────
  | BusinessIntelligenceFindHospitalityCalled
  | BusinessIntelligenceFindHospitalityCost
  | BusinessIntelligenceEnrichCalled
  | BusinessIntelligenceEnrichCost
  | BusinessIntelligenceGenerateCalled
  | BusinessIntelligenceGenerateCost
  | BusinessIntelligenceSearchBrregCalled
  | BusinessIntelligenceSearchBrregCost
  | BusinessIntelligenceLookupBrregCalled
  | BusinessIntelligenceLookupBrregCost
  | BusinessIntelligenceScrapeWebsiteCalled
  | BusinessIntelligenceScrapeWebsiteCost
  // ─── Welcome Mission V0 (ADR-0274) ────────────────────────────────
  | WelcomeStageAdvanced
  | WelcomeStageFailed
  | WelcomeMissionAbandoned
  | WelcomeSessionResumed
  | WelcomeSessionRestartedAfterWindow
  | WelcomeSpawnEvaluated
  | WelcomeEarlyExitViaTransition
  | InquiryNoted
  | InquiryClosed
  | MissionTransitioned
  | UiPointedAtSetting
  | UiDemoShown
  // ─── Booking (feat/mobile-addsheet-booking-stack, ADR-0267) ──
  | BookingCreated
  // ─── Onboarding capability (ADR-0282 Phase E T1.9) ──
  | OnboardingBusinessUpdated
  | OnboardingSeasonUpdated
  | OnboardingProcedureAdded
  | OnboardingScrapeCompleted
  // ─── Outreach Capability (ADR-0282, Audit 2026-05-06 H-03) ────────────────
  | OutreachSmsSent
  | OutreachCallInitiated
  // ─── Engine World (20260525000000, Audit 2026-05-06 H-01/M-04) ────────────
  | EngineWorldObservationWritten
  | EngineWorldStatusChanged
  // ─── Voice Runtime Quality (ADR-0282 R6 amendment 2026-05-10) ─────────────
  | VoiceFirstSpeechTs
  | VoiceTurnEndTs
  | VoiceUserRecut
  | VoiceSessionAbandonment
  // ─── Agent Memory (F-MEM-UNBLOCK-A3) ─
  | AgentMemorySummaryWritten
  | AgentMemoryAdded
  // ─── Agent Schedule Query (feat/schedule-admin-view 2026-05-11) ─────────
  | AgentScheduleWorkspaceQueried
  | AgentScheduleDateQueriedSelf
  // ─── Session-Task Defense (ADR-0298, Sortie 1) ──────────────
  | ShiftConfirmed
  | HoursConfirmed
  // ─── Task Capability Unified Events (ADR-0298, Sortie 3) ─────
  | TaskListMine
  | TaskCreated
  | TaskCompleted
  | TaskCancelled
  | TaskSessionTaskUpdated
  // ─── GDPR §13 Retention (ADR-0312, SMA-308) ──────────────────
  | ContractRetentionAnonymizedParagraf13
  // ─── WFM Foundation (ADR-0305 POS / ADR-0306 marketplace / ADR-0307+0309 scheduler) ─
  | PosAccountConnected
  | PosAccountDisconnected
  | PosSaleEventIngested
  | ShiftOfferPosted
  | ShiftOfferClaimed
  | ShiftOfferApproved
  | ShiftOfferExpired
  | ShiftOfferCancelled
  | SchedulerProposalProposed
  | SchedulerProposalAccepted
  | SchedulerProposalRejected
  | SchedulerDiagnoseRequested
  | SchedulerTemplateListed
  | SchedulerTemplateApplied
  // ─── Contracts Compliance Cluster (SMA-306/307/310/311, ADR-0310/0314/0315) ──────
  | ContractDispatchFailedSafe
  | ContractAml146ValidationFailed
  | ContractPdfGateEnforced
  | ContractPdfGateBypassed
  | GateContractSendDenied
  // ─── Contracts Compliance Debt Cleanup (Track A, SMA-328 follow-up) ─────────────
  | PayrollConsentDocumentCreated
  // ─── Dagslinjen QuickAdd UI telemetry (2026-05-15) ──────────────────────────
  | UiDagslinjenSlotQuickaddActionPicked
  | UiDagslinjenScopeFilterChanged
  // ─── Dagslinjen selection interaction telemetry (B1 sortie 2026-05-17) ───────
  | UiDagslinjenMarkerClicked
  | UiDagslinjenListRowClicked
  // ─── Dagslinjen ClusterMarker telemetry (Tidslinjen-redesign sortie) ────────
  | UiDagslinjenClusterExpanded
  // ─── DayControlPanel Tidslinje tab telemetry (feat/p10-tidslinje-tab, 2026-05-23) ─
  | TidslinjeTabOpened
  | TidslinjeFilterChanged
  // ─── Dagslinjen targeted note fanout (Track E, 2026-05-15) ─────────────────
  | CommScheduledNoteCreated
  | CommScheduledNoteDelivered
  | CommScheduledNoteDeleted
  // ─── Pipeline stage envelope (ADR-0340) — additive, does NOT replace shift_swap.* / shift_offer.* ─
  | PipelineStageProposed
  | PipelineStageConsented
  | PipelineStageApproved
  | PipelineStageRejected
  | PipelineStageCancelled
  | PipelineStageOverridden
  // ─── Timeline Templates (ADR-0334, T2 sortie 2026-05-16) ─────────────────
  | TimelineTemplateSaved
  | TimelineTemplateApplied
  | TimelineTemplateArchived
  | TimelineTemplateApplyFailed
  | TimelineTemplateListed
  // ─── Schedule Density (feat/schedule-card-density) ───────────────────────────
  | ScheduleDensityChanged
  // ─── HMS Read-surface (ui-shell-hms-cluster-polish-read) ─────────────────────
  | HmsUmbrellaViewed
  | HmsDriftViewed
  | HmsDocumentsOpened
  | HmsTrainingViewed
  // ─── My Training employee self-view (page-polish axis 12, 2026-05-26) ────────
  | MyTrainingViewed
  // ─── Notifications page view (page-polish axis 12, 2026-05-26) ───────────────
  | NotificationsPageViewed
  // ─── People Training (SM-2-followup-training 2026-05-19) ─────────────────────
  | PeopleTrainingViewed
  // ─── Cascade Delegation (ADR-0356, Sortie 3 2026-05-17) ─────────────────
  | CascadeWorkspaceUnionBindingCreated
  | CascadeSupplementRuleAdded
  // ─── Payroll Tariff Delegation (Phase 7f, ADR-0356, 2026-05-17) ──────────
  // Payroll-layer events — mirror the cascade-layer events above.
  // Both layers emit per ADR-0356 §"Audit trail symmetry".
  | PayrollWorkspaceTariffSetup
  | PayrollWorkspaceTariffChanged
  | PayrollSupplementOverrideAdded
  // ─── Payroll Tariff View Events (Phase 7g, 2026-05-17) ───────────────────
  // Read-path telemetry (PostHog + Logger only; no activity_trail — view events).
  | PayrollTariffViewLoaded
  | PayrollTariffViewLoadedMobile
  // ─── Day-Line Runtime Events (ADR-0367, BT0-FOUNDATION 2026-05-18) ─────────
  | DayLineCreated
  | DayLineOpeningChanged
  | DayLineClosingChanged
  | DayLineItemAdded
  | DayLineItemNotified
  | ShiftSessionBound
  | ShiftSessionClockedIn
  | ShiftSessionClockedOut
  | RoutineAttached
  | RoutineCreated
  | RoutineCreatedFromImage
  | RoutineGovernanceUnassigned
  | RoutineAssignedToLocation
  | ProcedureStepAdded
  | OrgDeptAreasUpdated
  | ShiftSessionItemLeakDetected
  | CelebrationAutoPublished
  | CelebrationSkippedWorkspaceDisabled
  | CelebrationSkippedAlreadyPublished
  // ─── Join Session Recovery (ADR-0358, 2026-05-18) ────────────────────────
  // Pre-auth events fired when an expired Supabase session is detected at /join.
  | JoinSessionExpiredRescued
  | JoinSessionExpiredAtSubmit
  // ─── Voice Bootstrap Snapshot (ADR-0297, feat/mobile-voice-bootstrap-pipe 2026-05-20) ──
  | VoiceBootstrapSnapshotSent
  | VoiceBootstrapSnapshotRefreshed
  | VoiceBootstrapSnapshotAssemblyFailed
  // ─── Voice Bootstrap Publish (ADR-0297, P3 mobile-voice-runtime-wire 2026-05-20) ──
  | VoiceBootstrapSnapshotPublished
  | VoiceBootstrapPublishFailed
  // ─── Voice Bootstrap RPC (P4 mobile-voice-runtime-wire 2026-05-20, L-0234) ──
  | VoiceBootstrapToolRegistered
  | VoiceBootstrapToolRegisterFailed
  | VoiceBootstrapRpcCompleted
  | VoiceBootstrapRpcFailed
  // ─── Mobile AI Surface Events (P2 UI scaffold, feat/mobile-mobile-voice-bootstrap-pipe 2026-05-20) ──
  | MobileFabLongPress
  | MobileAiPrefsChanged
  | MobileBotssonSheetOpened
  // ─── Mobile Chat Events (P5 mobile-voice-runtime-wire 2026-05-20) ──
  | MobileChatMessageSent
  | MobileChatResponseReceived
  | MobileChatError
  | MobileVoiceMicPermissionDenied
  | MobileVoiceDisconnectRecovered
  | MobileVoiceDisconnectFailed
  | MobileVoicePolicyFlipped
  | MobileRoutinePhotoExtracted
  // ─── Bulk Import Events (ADR-0401, Sortie A) ────────────────────────────
  | BulkImportBatchParsed
  // ─── Bootstrap Gate Events (ADR-0407, Phase 1) ───────────────────────────
  | BootstrapGatesListed
  | BootstrapGateClosed
  | BootstrapGateSkipped
  // ─── Bootstrap Setup Wizard View (axis-12) ───────────────────────────────
  | SetupWizardViewed
  // ─── Oppgaver Read-surface (P11 oppgaver-page) ──────────────────────────
  | OppgaverViewOpened
  | OppgaverViewModeChanged
  | OppgaverAreaFilterChanged
  | OppgaverDateChanged
  | OppgaverTaskFocused
  | OppgaverContextPinned
  | OppgaverPulseNowClicked
  | OppgaverTemplateApplyClicked
  // ─── Oppgaver Write-surface (P11 DnD re-timing, Wave 1b) ────────────────
  | OppgaverTaskReTimed
  // ─── Oppgaver Filter + CTA events (P11 TopBar D2) ────────────────────────
  | OppgaverLocationFilterChanged
  | OppgaverCloseDayClicked
  // ─── Oversikt (campaign/master-refactor — oversikt-v2 port) ──────────────
  | OversiktViewed
  | OversiktBudgetEmptyStateShown
  | OversiktBriefWhyToggled
  | OversiktBriefActionTaken
  | OversiktPulseTileClicked
  | OversiktActionQueueRowClicked
  | OversiktActionCtaClicked
  | OversiktNavLinkClicked
  | OversiktGapFillRequested
  | OversiktReceiptNudgeSent
  | OversiktDagsrapportRequested;

// ─── WFM Foundation Events (ADR-0305 POS / ADR-0306 marketplace / ADR-0307+0309 scheduler) ──────
//
// POS sync (3 events):
//   pos.account.connected / pos.account.disconnected — admin C4 acts.
//     4 destinations: admin action that unlocks D4 demand-input (engine_event for workflow reactions).
//   pos.sale_event.ingested — aggregated per sync run (NOT per row, per ADR-0134 cardinality).
//     posthog + logger + activity_trail. No engine_event (sync run is not a state-machine input).
//
// Shift marketplace (5 events):
//   shift_offer.posted / .claimed / .approved — C4 acts on schedule state.
//     4 destinations: approvals update D6 production state (engine_event for downstream reactions).
//   shift_offer.expired / .cancelled — lifecycle state transitions.
//     posthog + logger + activity_trail. No engine_event (passive expiry/cancel, no reaction needed).
//
// Scheduler bundle (3 events):
//   scheduler.proposal.proposed / .accepted / .rejected — one emit per logical bundle event.
//     Per ADR-0134: one emit per logical event, never per-shift loop.
//     Per ADR-0309: single-row bundle, atomic all-or-nothing accept V1.
//     4 destinations: accepted proposal triggers D6 shift-creation workflow (engine_event).

// ─── POS events ─────────────────────────────────────────────────────────────

export interface PosAccountConnected extends BaseEvent {
  event: "pos.account.connected";
  properties: {
    entity: EntityRef;
    data: {
      pos_account_id: string;
      vendor: string;
      external_account_id: string;
    };
  };
}

export interface PosAccountDisconnected extends BaseEvent {
  event: "pos.account.disconnected";
  properties: {
    entity: EntityRef;
    data: {
      pos_account_id: string;
      vendor: string;
      reason: "manual" | "auth_failed" | "suspended";
    };
  };
}

export interface PosSaleEventIngested extends BaseEvent {
  event: "pos.sale_event.ingested";
  properties: {
    entity: EntityRef; // entity = pos_account
    data: {
      pos_account_id: string;
      vendor: string;
      sync_run_id: string;
      row_count: number;
      new_row_count: number; // rows inserted (vs duplicates skipped)
      period_start: string; // ISO 8601 — since last_synced_at
      period_end: string; // ISO 8601 — now()
    };
  };
}

// ─── Shift marketplace events ────────────────────────────────────────────────

export interface ShiftOfferPosted extends BaseEvent {
  event: "shift_offer.posted";
  properties: {
    entity: EntityRef; // entity = schedule_shift_offer
    data: {
      schedule_shift_offer_id: string;
      shift_id: string;
      posted_by_profile_id: string;
      expires_at: string | null;
    };
  };
}

export interface ShiftOfferClaimed extends BaseEvent {
  event: "shift_offer.claimed";
  properties: {
    entity: EntityRef;
    data: {
      schedule_shift_offer_id: string;
      shift_id: string;
      claimed_by_profile_id: string;
      auto_approved: boolean; // true when workspace has auto_approve_claim config
    };
  };
}

export interface ShiftOfferApproved extends BaseEvent {
  event: "shift_offer.approved";
  properties: {
    entity: EntityRef;
    data: {
      schedule_shift_offer_id: string;
      shift_id: string;
      approved_by_profile_id: string;
      claimed_by_profile_id: string;
      gate_evaluation_id: string | null;
    };
  };
}

export interface ShiftOfferExpired extends BaseEvent {
  event: "shift_offer.expired";
  properties: {
    entity: EntityRef;
    data: {
      schedule_shift_offer_id: string;
      shift_id: string;
      expires_at: string;
    };
  };
}

export interface ShiftOfferCancelled extends BaseEvent {
  event: "shift_offer.cancelled";
  properties: {
    entity: EntityRef;
    data: {
      schedule_shift_offer_id: string;
      shift_id: string;
      cancelled_by_profile_id: string;
      cancel_reason: string | null;
      gate_evaluation_id: string | null;
    };
  };
}

// ─── Pipeline stage envelope events (ADR-0340) ───────────────────────────────
// Additive lifecycle telemetry for shift_swap_lifecycle + marketplace_lifecycle
// pipelines. These do NOT replace shift_swap.* or shift_offer.* events (ADR-0340
// §Preservation 1+2). pipeline_instance_id + gate_evaluation_id carry the
// ADR-0204 correlation chain across all stage transitions.

export interface PipelineStageProposed extends BaseEvent {
  event: "pipeline.stage_proposed";
  properties: {
    entity: EntityRef; // entity = schedule_shift being orchestrated
    data: {
      pipeline_instance_id: string; // engine_state.id
      blueprint_id: string; // "shift_swap_lifecycle" | "marketplace_lifecycle"
      stage_index: number; // 0-2
      action_type: string; // e.g. "shift_swap_lifecycle.stage_0_propose"
      gate_evaluation_id: string | null; // ADR-0204 correlation chain
      entity_id: string; // schedule_shift_id
      entity_type: "schedule_shift";
    };
  };
}

export interface PipelineStageConsented extends BaseEvent {
  event: "pipeline.stage_consented";
  properties: {
    entity: EntityRef;
    data: {
      pipeline_instance_id: string;
      blueprint_id: string;
      stage_index: number;
      action_type: string;
      gate_evaluation_id: string | null;
      entity_id: string;
      entity_type: "schedule_shift";
    };
  };
}

export interface PipelineStageApproved extends BaseEvent {
  event: "pipeline.stage_approved";
  properties: {
    entity: EntityRef;
    data: {
      pipeline_instance_id: string;
      blueprint_id: string;
      stage_index: number;
      action_type: string;
      gate_evaluation_id: string | null;
      entity_id: string;
      entity_type: "schedule_shift";
    };
  };
}

export interface PipelineStageRejected extends BaseEvent {
  event: "pipeline.stage_rejected";
  properties: {
    entity: EntityRef;
    data: {
      pipeline_instance_id: string;
      blueprint_id: string;
      stage_index: number;
      action_type: string;
      gate_evaluation_id: string | null;
      entity_id: string;
      entity_type: "schedule_shift";
      rejection_reason: string; // may be empty string when not provided
      rejected_by: string; // actor profile_id
    };
  };
}

export interface PipelineStageCancelled extends BaseEvent {
  event: "pipeline.stage_cancelled";
  properties: {
    entity: EntityRef;
    data: {
      pipeline_instance_id: string;
      blueprint_id: string;
      stage_index: number;
      action_type: string;
      gate_evaluation_id: string | null;
      entity_id: string;
      entity_type: "schedule_shift";
    };
  };
}

export interface PipelineStageOverridden extends BaseEvent {
  event: "pipeline.stage_overridden";
  properties: {
    entity: EntityRef;
    data: {
      pipeline_instance_id: string;
      blueprint_id: string;
      stage_index: number;
      action_type: string;
      gate_evaluation_id: string | null;
      entity_id: string;
      entity_type: "schedule_shift";
      override_reason: string; // admin justification, min 20 chars (ADR-0328)
      overridden_from_status: string; // status that was overridden
      overridden_by: string; // admin profile_id
    };
  };
}

// ─── Scheduler bundle events ─────────────────────────────────────────────────
// Per ADR-0309: one emit per logical bundle event. Never loop per proposed shift.
// proposed → accepted XOR rejected (never both).

export interface SchedulerProposalProposed extends BaseEvent {
  event: "scheduler.proposal.proposed";
  properties: {
    entity: EntityRef; // entity = change_proposal (kind='scheduler_bundle')
    data: {
      change_proposal_id: string;
      solver_version: string;
      solver_run_id: string;
      proposed_shift_count: number;
      gap_count: number;
      objective_score: number;
      gate_evaluation_id: string | null;
    };
  };
}

export interface SchedulerProposalAccepted extends BaseEvent {
  event: "scheduler.proposal.accepted";
  properties: {
    entity: EntityRef;
    data: {
      change_proposal_id: string;
      solver_run_id: string;
      accepted_by_profile_id: string;
      applied_shift_count: number;
      gate_evaluation_id: string | null;
      /**
       * ADR-0430 Rule 6b + MF-E: per-shift zone assignments for audit reconstruction.
       * Shape: Array<{shift_id: string; zone_ids: string[]}> — keyed per-shift
       * so ADR-0309 audit reconstruction can map zones to shifts without a
       * follow-up query against shift_zone.
       * Optional — absent when no proposed_shifts had zone_ids (pre-M2N proposals).
       * MUST NOT be flat zone_ids: string[] — that loses per-shift provenance.
       */
      zone_assignments?: Array<{
        shift_id: string;
        zone_ids: string[];
      }>;
    };
  };
}

export interface SchedulerProposalRejected extends BaseEvent {
  event: "scheduler.proposal.rejected";
  properties: {
    entity: EntityRef;
    data: {
      change_proposal_id: string;
      solver_run_id: string;
      rejected_by_profile_id: string;
      rejection_reason: string | null;
      gate_evaluation_id: string | null;
    };
  };
}

// ─── Scheduler Diagnose Event (feat/turnus-diagnose-and-template, Phase 1) ──────
// Read-only diagnostic tool for cascade prerequisite checking.
// One emit per diagnose_turnus_disabled tool call (ADR-0134).
//
// Routing rationale:
//   posthog — product analytics: how often are workspaces blocked from planning?
//   logger — stdout audit trail.
//   activity_trail — audit: which manager ran diagnose, what was missing.
//   engine_event EXCLUDED — read-only diagnose is not a workflow trigger.
//
// Per L-NEW (telemetry-without-emit-wiring): call-site in diagnose-tools.ts
// exists in the same commit as this registry entry.

export interface SchedulerDiagnoseRequested extends BaseEvent {
  event: "scheduler.diagnose.requested";
  properties: {
    target_week_iso: string;
    department_id: string | null;
    ready: boolean;
    missing_count: number;
    missing_dimensions: Array<"D1" | "D2" | "D3" | "D4" | "D5" | "D6">;
    channel: "chat" | "voice";
  };
}

// ─── Scheduler Template Events (feat/turnus-diagnose-and-template, Phase 1) ──────
// Template listing and application telemetry (ADR-0417).
//
// listed:  Read-only. manager sees available archived cycles.
//   posthog — product analytics: which workspaces use template listings.
//   logger + activity_trail — audit trail (manager saw these templates).
//   engine_event EXCLUDED — read-only, no D6 effect.
//
// applied: Write event. ONE change_proposal of kind='template_apply' created.
//   All 4 destinations — engine_event included because template-apply proposals
//   are workflow-triggering (manager review step, downstream D6 shift creation).
//
// Per L-NEW (telemetry-without-emit-wiring): call-sites in tools-template.ts
// exist in the same commit as this registry entry.

export interface SchedulerTemplateListed extends BaseEvent {
  event: "scheduler.template.listed";
  properties: {
    result_count: number;
    department_id: string | null;
    channel: "chat" | "voice";
  };
}

export interface SchedulerTemplateApplied extends BaseEvent {
  event: "scheduler.template.applied";
  properties: {
    source_cycle_id: string;
    target_cycle_id: string;
    department_id: string;
    proposed_count: number;
    change_proposal_id: string;
    channel: "chat" | "voice";
  };
}

// ─── Calendar Redesign Events (feat/mobile-calendar-redesign, Phase 3a) ──────
// Navigation/view telemetry for the mobile Calendar + Vaktliste tabs.
// Phase 3 (3c–3e) will call emit() against these — registered now per L-0094
// (phantom-emit prevention) and Phase 2 Condition 2 (ADR-0134 enforcement).
//
// Routing rationale:
//   item_viewed / scope_changed / filter_changed / view_changed / tab_switched /
//   day_selected — read-only navigation events.
//   → posthog (product analytics) + logger + activity_trail (audit trail for
//     scope/filter changes that affect what data the employee saw).
//   NO engine_event — none of these trigger D6 workflow steps.
//
// CREATE events (task, booking, deviation, etc.) are NOT registered here.
// They require AddSheet BFF-wrap audit in a separate sortie (Phase 3e is
// currently BLOCKED on ADR-0267 for booking-PII).

export interface CalendarItemViewed extends BaseEvent {
  event: "calendar item_viewed";
  properties: {
    entity_type: "calendar_item";
    entity_id: string;
    data: {
      item_type: "shift" | "task" | "booking" | "deviation" | "note";
      date: string; // YYYY-MM-DD
    };
  };
}

export interface CalendarScopeChanged extends BaseEvent {
  event: "calendar scope_changed";
  properties: {
    data: {
      from: "me" | "all" | "dept" | "person";
      to: "me" | "all" | "dept" | "person";
    };
  };
}

export interface CalendarFilterChanged extends BaseEvent {
  event: "calendar filter_changed";
  properties: {
    data: {
      from: "alt" | "oppgaver" | "vakter" | "bookinger" | "avvik";
      to: "alt" | "oppgaver" | "vakter" | "bookinger" | "avvik";
    };
  };
}

export interface CalendarViewChanged extends BaseEvent {
  event: "calendar view_changed";
  properties: {
    data: {
      from: "week" | "month" | "day";
      to: "week" | "month" | "day";
    };
  };
}

export interface CalendarTabSwitched extends BaseEvent {
  event: "calendar tab_switched";
  properties: {
    data: {
      from: "kalender" | "vakter";
      to: "kalender" | "vakter";
      trigger: "chip" | "tab_bar" | "programmatic";
    };
  };
}

export interface CalendarDaySelected extends BaseEvent {
  event: "calendar day_selected";
  properties: {
    entity_type: "date";
    entity_id: string; // YYYY-MM-DD
    data: {
      date: string; // YYYY-MM-DD
    };
  };
}

export interface CalendarHubViewed extends BaseEvent {
  event: "calendar.hub.viewed";
  properties: {
    entity: { entity_type: "workspace"; entity_id: string; entity_label: "Calendar Hub" };
    data: { initial_tab: string };
  };
}

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

export interface ScheduleDensityChanged extends BaseEvent {
  event: "schedule.density_changed";
  properties: {
    entity: EntityRef;
    data: { density: "cozy" | "default" | "compact" | "pulse"; source: "ui" | "voice" };
  };
}

// ─── Business Intelligence Capability Events (ADR-0270) ──────────────────────
// 6 called-events + 6 cost-events for the godmode-only scrapling toolkit.
// called-events: posthog + logger + activity_trail (audit trail for godmode ops)
// cost-events:   posthog + logger + engine_event (cost-tracking + alerts)

export interface BusinessIntelligenceFindHospitalityCalled extends BaseEvent {
  event: "business_intelligence.find_hospitality_businesses.called";
  properties: { data: { city: string; types: string[]; limit: number } };
}

export interface BusinessIntelligenceFindHospitalityCost extends BaseEvent {
  event: "business_intelligence.find_hospitality_businesses.cost";
  properties: { data: { city: string; result_count: number; estimated_cost_usd: number } };
}

export interface BusinessIntelligenceEnrichCalled extends BaseEvent {
  event: "business_intelligence.enrich_company_intelligence.called";
  properties: { data: { company_name: string; city: string | null } };
}

export interface BusinessIntelligenceEnrichCost extends BaseEvent {
  event: "business_intelligence.enrich_company_intelligence.cost";
  properties: { data: { company_name: string; sources_added: string[]; gaps_remaining: string[] } };
}

export interface BusinessIntelligenceGenerateCalled extends BaseEvent {
  event: "business_intelligence.generate_company_copy.called";
  properties: { data: { rewrite_field: string | null; rewrite_mode: string | null } };
}

export interface BusinessIntelligenceGenerateCost extends BaseEvent {
  event: "business_intelligence.generate_company_copy.cost";
  properties: { data: { rewrite_mode: string; rewrite_field: string } };
}

export interface BusinessIntelligenceSearchBrregCalled extends BaseEvent {
  event: "business_intelligence.search_brreg.called";
  properties: { data: { query: string; city: string | null } };
}

export interface BusinessIntelligenceSearchBrregCost extends BaseEvent {
  event: "business_intelligence.search_brreg.cost";
  properties: { data: { query: string; city: string | null } };
}

export interface BusinessIntelligenceLookupBrregCalled extends BaseEvent {
  event: "business_intelligence.lookup_brreg.called";
  properties: { data: { org_number: string } };
}

export interface BusinessIntelligenceLookupBrregCost extends BaseEvent {
  event: "business_intelligence.lookup_brreg.cost";
  properties: { data: { org_number: string } };
}

export interface BusinessIntelligenceScrapeWebsiteCalled extends BaseEvent {
  event: "business_intelligence.scrape_website.called";
  properties: { data: { url: string; mode: string } };
}

export interface BusinessIntelligenceScrapeWebsiteCost extends BaseEvent {
  event: "business_intelligence.scrape_website.cost";
  properties: { data: { url: string; mode: string } };
}

// ─── Booking (feat/mobile-addsheet-booking-stack, ADR-0267 + ADR-0099) ──────
// Dual-registered per L-0072: interface + runtime EVENT_ROUTING entry.
// entity_type "booking" maps to schedule_day_booking.schedule_day_booking_id.
// contact field is NOT included in properties (PII — never in telemetry payload).
// Four-destination: posthog/logger/activity_trail/engine_event.

export interface BookingCreated extends BaseEvent {
  event: "booking created";
  properties: {
    entity_type: "booking";
    entity_id: string;
    data: {
      shift_date: string;
      booking_time: string;
      guest_count: number;
      source: "manual_admin";
      channel: "chat" | "system";
      /** true if contact_person was supplied — PII not included in telemetry payload. */
      has_contact: boolean;
    };
  };
}

// ─── Onboarding Capability Events (ADR-0282 Phase E T1.9) ───────────────────
// 4 events for the onboarding capability tool mutations + scrape bridge.
// onboarding.business_updated: posthog + logger + activity_trail
// onboarding.season_updated:   posthog + logger + activity_trail + engine_event (D4 cascade trigger)
// onboarding.procedure_added:  posthog + logger + activity_trail
// onboarding.scrape_completed: posthog + logger (cost-cap pattern, mirrors business_intelligence events)

export interface OnboardingBusinessUpdated extends BaseEvent {
  event: "onboarding.business_updated";
  properties: { data: { fields_updated: string[] } };
}

export interface OnboardingSeasonUpdated extends BaseEvent {
  event: "onboarding.season_updated";
  properties: {
    data: {
      season_id: string;
      name: string;
      start_date: string;
      end_date: string;
      revenue_target_nok: number | null;
    };
  };
}

export interface OnboardingProcedureAdded extends BaseEvent {
  event: "onboarding.procedure_added";
  properties: {
    data: { count: number; titles: string[]; failed_count: number };
  };
}

export interface OnboardingScrapeCompleted extends BaseEvent {
  event: "onboarding.scrape_completed";
  properties: { data: { url: string; mode: string; phase: "called" | "completed" } };
}

// ─── Outreach Capability (ADR-0282, Audit 2026-05-06 H-03) ──────────────────
// Outbound SMS (Twilio REST) and voice call (LiveKit SIP → Twilio trunk).
// Phone number is NEVER included in telemetry properties (PII — ADR-0151/0077).
// profile_id is the target employee; actor_id (inherited from BaseEvent) is the triggering manager.
export interface OutreachSmsSent extends BaseEvent {
  event: "outreach sms_sent";
  properties: {
    entity: { entity_type: "profile"; entity_id: string };
    data: {
      channel: "chat" | "system";
      capability: "outreach";
    };
  };
}

export interface OutreachCallInitiated extends BaseEvent {
  event: "outreach call_initiated";
  properties: {
    entity: { entity_type: "profile"; entity_id: string };
    data: {
      channel: "chat" | "voice" | "system";
      capability: "outreach";
    };
  };
}

// ─── Engine World (20260525000000_engine_world.sql, Audit 2026-05-06 H-01/M-04) ──
// Written by heartbeat jobs and agent conductors. workspace_id nullable because
// platform-level rows (CI, infra, prod-DB) have workspace_id = NULL.
export interface EngineWorldObservationWritten extends BaseEvent {
  event: "engine_world observation_written";
  properties: {
    data: {
      surface_id: string;
      surface_type: string;
      status: "green" | "yellow" | "red" | "unknown" | "paused";
      observed_by: string;
    };
  };
}

export interface EngineWorldStatusChanged extends BaseEvent {
  event: "engine_world status_changed";
  properties: {
    data: {
      surface_id: string;
      surface_type: string;
      from_status: "green" | "yellow" | "red" | "unknown" | "paused" | null;
      to_status: "green" | "yellow" | "red" | "unknown" | "paused";
    };
  };
}

// ─── Payroll Engine Events (ADR-0057, Phase 1 — T4.3) ─────────────────────────
// Dual-registered per L-0072: interface + runtime EVENT_ROUTING entry.
// All payroll events are chat-only (ADR-0078 PII guard enforced at capability layer).
// period_locked → engine_event (downstream lock-step workflow triggers).
// overtime_mode_changed → engine_event (C4 governance audit).
// timebank_payout_forced → engine_event (triggers lønnsgrunnlag recalc).
// recalc_triggered → engine_event (orchestrator chain coordination).
// supplement_rule_fired + timebank_accrued → activity_trail only (high-frequency; floods PostHog).
// supplement_rule_test_run → posthog only (admin preview; no audit trail needed).
// period_created → engine_event (downstream period-lifecycle workflow triggers, mirrors period_locked).

export interface PayrollPeriodCreated extends BaseEvent {
  event: "payroll.period_created";
  properties: {
    entity: EntityRef; // entity_type: "payroll_period", entity_id: period.id
    data: {
      start_date: string;
      end_date: string;
    };
  };
}

export interface PayrollPeriodLocked extends BaseEvent {
  event: "payroll.period_locked";
  properties: {
    entity: EntityRef;
    data: {
      period_id: string;
      period_start: string;
      period_end: string;
      profiles_count: number;
      total_lines: number;
      /**
       * Distinct profile_ids affected by the lock. Required by ADR-0319
       * `notify_each_profile` subscriber to fan out N notification_outbox
       * rows. Source: `SELECT DISTINCT profile_id FROM payroll.calculation
       * WHERE period_id = $1`. BFF route at lock-period/route.ts:144 is the
       * canonical emit-site (capability-tool emit removed per L-0237).
       */
      affected_profile_ids: string[];
      locked_by_profile_id: string;
      gate_evaluation_id: string | null;
    };
  };
}

export interface PayrollPeriodApproved extends BaseEvent {
  event: "payroll.period_approved";
  properties: {
    entity: EntityRef;
    data: {
      period_id: string;
      period_start: string;
      period_end: string;
      profiles_count: number;
      total_lines: number;
      /**
       * Distinct profile_ids affected by the approval. Mirrors period_locked
       * shape so downstream subscribers (ADR-0319 notify_each_profile) can
       * fan out N notification_outbox rows on payroll approval.
       */
      affected_profile_ids: string[];
      approved_by_profile_id: string;
      gate_evaluation_id: string | null;
    };
  };
}

export interface PayrollDeviationAcknowledged extends BaseEvent {
  event: "payroll.deviation_acknowledged";
  properties: {
    entity: EntityRef;
    data: {
      deviation_id: string;
      period_id: string;
      check_code: string;
      severity: "error" | "warning";
      acknowledged_by_profile_id: string;
      gate_evaluation_id: string | null;
    };
  };
}

export interface PayrollDeviationBlockedApproval extends BaseEvent {
  event: "payroll.deviation_blocked_approval";
  properties: {
    entity: EntityRef;
    data: {
      period_id: string;
      blocking_deviation_count: number;
      check_codes: string[];
    };
  };
}

export interface PayrollManualSupplementAdded extends BaseEvent {
  event: "payroll.manual_supplement_added";
  properties: {
    entity: EntityRef;
    data: {
      supplement_id: string;
      period_id: string;
      target_profile_id: string;
      shift_id: string;
      salary_code: string | null;
      amount: number;
      gate_evaluation_id: string | null;
    };
  };
}

export interface PayrollManualSupplementDeleted extends BaseEvent {
  event: "payroll.manual_supplement_deleted";
  properties: {
    entity: EntityRef;
    data: {
      supplement_id: string;
      period_id: string;
      target_profile_id: string;
      shift_id: string;
      salary_code: string | null;
      amount: number;
      gate_evaluation_id: string | null;
    };
  };
}

export interface PayrollOvertimeModeChanged extends BaseEvent {
  event: "payroll.overtime_mode_changed";
  properties: {
    entity: EntityRef;
    data: {
      target_profile_id: string;
      from_mode: "paid_out" | "banked" | null;
      to_mode: "paid_out" | "banked";
      toil_agreement_signed: boolean;
      gate_evaluation_id: string | null;
    };
  };
}

export interface PayrollTimebankAccrued extends BaseEvent {
  event: "payroll.timebank_accrued";
  properties: {
    entity: EntityRef;
    data: {
      target_profile_id: string;
      period_id: string;
      account_type: string;
      value_amount: number;
      value_unit: "hours" | "nok";
    };
  };
}

export interface PayrollTimebankWithdrawn extends BaseEvent {
  event: "payroll.timebank_withdrawn";
  properties: {
    entity: EntityRef;
    data: {
      target_profile_id: string;
      account_type: string;
      value_amount: number;
      value_unit: "hours" | "nok";
      reason: string;
      gate_evaluation_id: string | null;
    };
  };
}

export interface PayrollTimebankPayoutForced extends BaseEvent {
  event: "payroll.timebank_payout_forced";
  properties: {
    entity: EntityRef;
    data: {
      target_profile_id: string;
      account_type: string;
      payout_amount: number;
      payout_unit: "hours" | "nok";
      gate_evaluation_id: string | null;
    };
  };
}

export interface PayrollTimebankBalanceAdjusted extends BaseEvent {
  event: "payroll.timebank_balance_adjusted";
  properties: {
    entity: EntityRef;
    data: {
      target_profile_id: string;
      account_type: string;
      delta_amount: number;
      delta_unit: "hours" | "nok";
      reason: string;
      gate_evaluation_id: string | null;
    };
  };
}

export interface PayrollSupplementRuleFired extends BaseEvent {
  event: "payroll.supplement_rule_fired";
  properties: {
    entity: EntityRef;
    data: {
      rule_id: string;
      supplement_type: string;
      amount_nok: number;
      shift_id: string;
      period_id: string;
      derivation_version: number;
    };
  };
}

export interface PayrollSupplementRuleTestRun extends BaseEvent {
  event: "payroll.supplement_rule_test_run";
  properties: {
    entity: EntityRef;
    data: {
      rule_id: string;
      test_shift_ids: string[];
      matched_count: number;
      total_amount_nok: number;
    };
  };
}

export interface PayrollRecalcTriggered extends BaseEvent {
  event: "payroll.recalc_triggered";
  properties: {
    entity: EntityRef;
    data: {
      period_id: string;
      deviations: number;
      errors: number;
      total_lines: number;
      calc_duration_ms: number;
      derivation_version: number | null;
    };
  };
}

export interface PayrollTariffFreezeDrift extends BaseEvent {
  event: "payroll.tariff_freeze_drift";
  properties: {
    entity: EntityRef;
    data: {
      period_id: string;
      shift_id: string;
      snapshot_law_version: string;
      current_law_version: string;
      drift_fields: string[];
    };
  };
}

// ─── Payroll Engine Phase 2 Events (ADR-0292, T1.4) ─────────────────────────
//
// Routing decisions:
//   line_override_proposed/approved/rejected/overridden → both posthog + activity_trail
//     (low-volume audit events; each represents a human decision in the approval chain)
//   recalc_triggered_by_supplement → activity_trail only
//     (high-frequency: every supplement insert/delete; floods PostHog in active periods)
//   recalc_triggered_by_tip_distribution → activity_trail only
//     (high-frequency: fires per-employee per pool at tip approval time)
//
// All six events route to "logger" for structured stdout visibility in stage-engine.

export interface PayrollLineOverrideProposed extends BaseEvent {
  event: "payroll.line_override_proposed";
  properties: {
    entity: EntityRef;
    data: {
      change_proposal_id: string;
      calculation_id: string;
      period_id: string;
      target_profile_id: string;
      original_amount_cents: number;
      proposed_amount_cents: number;
      // SMA-328: 'deduction' added for Aml. §14-15 tredje ledd trekk-samtykke.
      category:
        | "manual_adjustment"
        | "tariff_interpretation"
        | "shift_data_error"
        | "other"
        | "deduction";
      gate_evaluation_id: string | null;
    };
  };
}

export interface PayrollLineOverrideApproved extends BaseEvent {
  event: "payroll.line_override_approved";
  properties: {
    entity: EntityRef;
    data: {
      change_proposal_id: string;
      calculation_id: string;
      period_id: string;
      resolved_by_profile_id: string;
      gate_evaluation_id: string | null;
    };
  };
}

export interface PayrollLineOverrideRejected extends BaseEvent {
  event: "payroll.line_override_rejected";
  properties: {
    entity: EntityRef;
    data: {
      change_proposal_id: string;
      calculation_id: string;
      period_id: string;
      resolved_by_profile_id: string;
      rejection_reason: string | null;
      gate_evaluation_id: string | null;
    };
  };
}

export interface PayrollLineOverridden extends BaseEvent {
  event: "payroll.line_overridden";
  properties: {
    entity: EntityRef;
    data: {
      change_proposal_id: string;
      original_calculation_id: string;
      new_calculation_id: string;
      period_id: string;
      target_profile_id: string;
      original_amount_cents: number;
      new_amount_cents: number;
      derivation_version: number;
      supersession_event_id: string;
    };
  };
}

export interface PayrollRecalcTriggeredBySupplement extends BaseEvent {
  event: "payroll.recalc_triggered_by_supplement";
  properties: {
    entity: EntityRef;
    data: {
      period_id: string;
      supplement_id: string;
      op: "insert" | "delete";
    };
  };
}

export interface PayrollRecalcTriggeredByTipDistribution extends BaseEvent {
  event: "payroll.recalc_triggered_by_tip_distribution";
  properties: {
    entity: EntityRef;
    data: {
      payroll_period_id: string;
      profile_id: string;
      tip_distribution_id: string;
      tip_pool_id: string;
    };
  };
}

// ─── Payroll Engine Phase 3 Events (CSV Export, T2.3) ───────────────────────
//
// Routing decisions:
//   csv_exported → posthog + logger + activity_trail
//     Low-volume administrative action. PostHog for funnel analytics
//     (who exports, which variant, how often). activity_trail for Bokføringsloven §13.
//   csv_export_unmasked → posthog + logger + activity_trail
//     High-PII audit event: admin explicitly downloaded raw personnummer + bankkonto.
//     Same destinations as csv_exported but treated as security-sensitive — POST-export
//     forensics require activity_trail. No engine_event (no automated reaction needed).
//   csv_export_failed → logger + activity_trail
//     Error path. PostHog excluded (error noise distorts funnel analytics).
//     activity_trail captures the failure for support investigation.
//
// Entity: payroll_export_event (added to EntityType union above).

export interface PayrollCsvExported extends BaseEvent {
  event: "payroll.csv_exported";
  properties: {
    entity: EntityRef; // entity_type: "payroll_export_event", entity_id: export_event.id
    data: {
      export_event_id: string;
      period_id: string;
      variant: "aggregate" | "audit";
      masked: boolean;
      row_count: number;
    };
  };
}

export interface PayrollCsvExportUnmasked extends BaseEvent {
  event: "payroll.csv_export_unmasked";
  properties: {
    entity: EntityRef; // entity_type: "payroll_export_event", entity_id: export_event.id
    data: {
      export_event_id: string;
      period_id: string;
      variant: "aggregate" | "audit";
      row_count: number;
      // NOTE: No PII in the event payload itself — the event signals that PII was
      // included in the download. The actual data is in export_line.line_payload.
    };
  };
}

export interface PayrollCsvExportFailed extends BaseEvent {
  event: "payroll.csv_export_failed";
  properties: {
    entity: EntityRef; // entity_type: "payroll_export_event", entity_id: export_event.id if created
    data: {
      period_id: string;
      variant: "aggregate" | "audit";
      // Short error code for programmatic triage (not the full stack trace).
      // Examples: "period_not_locked", "gate_denied", "generator_error", "db_write_failed"
      error_code: string;
    };
  };
}

// ─── Payroll Engine Phase 4 (PDF Lønnsgrunnlag — ADR-0294) ───────────────────
//
// Three events mirror the Phase 3 CSV pattern (generated / unmasked / failed)
// but target PDF lønnsgrunnlag generation.
//
// Routing rationale:
//   lonnsgrunnlag_generated → posthog + logger + activity_trail
//     Primary export event. No engine_event (PDF generation is a terminal action,
//     not a workflow trigger). activity_trail for Bokføringsloven §13.
//   lonnsgrunnlag_url_granted → posthog + logger + activity_trail
//     High-PII audit event: a signed URL giving access to a lønnsgrunnlag PDF
//     has been issued. WHO got access (admin vs employee), for HOW LONG.
//     activity_trail required — this is the access-control audit row.
//   lonnsgrunnlag_generation_failed → logger + activity_trail
//     Error path. PostHog excluded (error noise distorts funnel analytics).
//
// Entity reuse: payroll_export_event (same entity_type as CSV Phase 3).
// The kind discriminator is in data.format ("pdf" vs "csv") so no new EntityType is needed.

export interface PayrollLonnsgrunnlagGenerated extends BaseEvent {
  event: "payroll.lonnsgrunnlag_generated";
  properties: {
    entity: EntityRef; // entity_type: "payroll_export_event", entity_id: export_event.id
    data: {
      export_event_id: string;
      period_id: string;
      profile_count: number;
      format: "pdf";
      masked: boolean;
    };
  };
}

export interface PayrollLonnsgrunnlagUrlGranted extends BaseEvent {
  event: "payroll.lonnsgrunnlag_url_granted";
  properties: {
    entity: EntityRef; // entity_type: "payroll_export_event", entity_id: export_event.id
    data: {
      export_event_id: string;
      profile_id: string; // The profile whose lønnsgrunnlag is being accessed
      expires_in_seconds: number;
      granted_to: "admin" | "employee";
      // NOTE: The signed URL itself is NOT included in the event payload (PII-adjacent).
      // The event records THAT access was granted, not the URL value.
    };
  };
}

export interface PayrollLonnsgrunnlagGenerationFailed extends BaseEvent {
  event: "payroll.lonnsgrunnlag_generation_failed";
  properties: {
    entity: EntityRef; // entity_type: "payroll_export_event", entity_id: export_event.id if created
    data: {
      period_id: string;
      // Short error code for programmatic triage.
      // Examples: "period_not_locked", "gate_denied", "render_error", "storage_upload_failed"
      error_code: string;
    };
  };
}

// ─── Payroll Engine — Feriepenger Basis Computed (ADR-0295) ───────────────────
//
// Emitted once per-employee per-period when computeFeriepengerBasis() is called
// at a BFF compute site (generate-pdf-bundle, generate-pdf-single, export-period).
// For loops over multiple profiles (PDF-bundle, export-period), one event per profile.
//
// Routing: logger + activity_trail only — no PostHog (high-frequency per-profile
// audit; would flood product analytics). No engine_event (not a workflow trigger).
//
// pct_applied: the actual holiday_allowance_pct used (12.00 default or per-employee override).
// base_pay_total: the basePayTotal passed to computeFeriepengerBasis().
// basis_amount: the computed basis (base_pay_total × pct_applied / 100), 2-decimal precision.

export interface PayrollFeriepengerBasisComputed extends BaseEvent {
  event: "payroll.feriepenger_basis_computed";
  properties: {
    entity: EntityRef; // entity_type: "payroll_period", entity_id: period_id
    data: {
      workspace_id: string;
      period_id: string;
      profile_id: string;
      basis_amount: number;
      pct_applied: number;
      base_pay_total: number;
      channel: "system";
    };
  };
}

// ─── Payroll Engine Phase 5 (PII Reveal) ─────────────────────────────────────
//
// Two events for the real-body PII reveal tools (`view_personal_number` and
// `view_bank_account`) that replace the Phase 0c presence-only stubs.
//
// Routing rationale (high-PII audit; PostHog excluded by design):
//   personal_number_revealed → logger + activity_trail + engine_event
//     ─ activity_trail: Bokføringsloven §13 + ADR-0077 audit-trail of WHO read
//       the fødselsnummer for WHICH employee, including cross-workspace attempts
//     ─ engine_event: feeds C4 governance + cross-workspace-attempt deviations
//       (an attempt-emit fires on workspace-mismatch even when read is denied)
//     ─ logger: structured stdout in stage-engine + BFF
//     ─ posthog EXCLUDED: high-PII access events do not belong in product
//       analytics funnels; routes through audit + governance only.
//   bank_account_revealed → same routing as personal_number_revealed.
//
// Entity: employment_contract (matches contract.pii.revealed precedent — the
// contract is the canonical envelope for an employee's PII). Entity_id is the
// target profile_id (not the contract row UUID) for the same reason
// contract.pii.revealed uses target_profile_id: the employer-employee relationship,
// not a specific contract version, is what the audit row is about.
//
// is_self semantics: true when ctx.profileId === target_profile_id (employee
// self-reveal on own (me)/my-contract surface). Drives different gate paths and
// downstream notification policy (no notify-self).
//
// gate_evaluation_id: nullable — set when the underlying callGateAction call
// returned a gate evaluation row; null on early-rejection paths
// (channel_forbidden, cross-workspace, profile not found) that short-circuit
// before the gate is hit.

export interface PayrollPersonalNumberRevealed extends BaseEvent {
  event: "payroll.personal_number_revealed";
  properties: {
    entity: EntityRef; // entity_type: "employment_contract", entity_id: target_profile_id
    data: {
      target_profile_id: string;
      is_self: boolean;
      gate_evaluation_id: string | null;
      // ADR-0077: every attempt emits; was_revealed=false on gate-denial and not-found
      // so the audit trail distinguishes "attempted but blocked" from "value sent to caller".
      was_revealed: boolean;
    };
  };
}

export interface PayrollBankAccountRevealed extends BaseEvent {
  event: "payroll.bank_account_revealed";
  properties: {
    entity: EntityRef; // entity_type: "employment_contract", entity_id: target_profile_id
    data: {
      target_profile_id: string;
      is_self: boolean;
      gate_evaluation_id: string | null;
      // ADR-0077: every attempt emits; was_revealed=false on gate-denial and not-found.
      was_revealed: boolean;
    };
  };
}

// ─── Payroll Trekk-Samtykke (SMA-328, ADR-0311) ───────────────────────────────
// Three events for AML §14-15 tredje ledd deduction consent validation flow.
// paragraph_ref: "Aml. §14-15 tredje ledd nr. 1-6" (immutable for audit).

// Fired by propose-line-override BFF on successful deduction proposal with valid consent.
// posthog: user funnel (manager created deduction); activity_trail: 5-year audit per Bokf.lov §13.
export interface PayrollDeductionConsentReferenced extends BaseEvent {
  event: "payroll.deduction_consent_referenced";
  properties: {
    entity: EntityRef; // entity_type: "change_proposal"
    data: {
      consent_document_id: string;
      change_proposal_id: string;
      profile_id: string;
      period_id: string;
      paragraph_ref: "Aml. §14-15 tredje ledd nr. 1-6";
    };
  };
}

// Fired by propose-line-override BFF when deduction is rejected due to missing consent.
// NOT posthog (blocked actions skip analytics funnel per plan §7).
// activity_trail: compliance trace — every blocked attempt must be auditable.
export interface PayrollDeductionRejectedNoConsent extends BaseEvent {
  event: "payroll.deduction_rejected_no_consent";
  properties: {
    data: {
      profile_id: string;
      period_id: string;
      paragraph: "Aml. §14-15";
      reason:
        | "missing_consent_document_id"
        | "consent_not_active"
        | "consent_expired"
        | "workspace_mismatch"
        | "consent_profile_mismatch";
    };
  };
}

// Fired by validateAml1415 capability tool (system channel only).
// posthog: compliance analytics; activity_trail: audit trail per lovsen validation chain.
export interface LegalAml1415Validated extends BaseEvent {
  event: "legal.aml_14_15.validated";
  properties: {
    data: {
      consent_document_id: string | null;
      profile_id: string;
      pass: boolean;
      status:
        | "passes"
        | "consent_missing"
        | "consent_expired"
        | "consent_type_mismatch"
        | "workspace_mismatch"
        | "skip";
      validator_version: string;
    };
  };
}

// Fired by POST /api/payroll/consent-documents when a court-order consent is created.
// posthog: consent creation analytics.
// activity_trail: compliance trace — every consent must be auditable.
// engine_event: enables downstream workflow triggers (e.g. trekk-configuration alerts).
// Dual-registered per L-0072: interface + runtime EVENT_ROUTING entry.
export interface PayrollConsentDocumentCreated extends BaseEvent {
  event: "payroll.consent_document.created";
  properties: {
    entity: EntityRef; // entity_type: "consent_document"
    data: {
      consent_document_id: string;
      employee_profile_id: string;
      consent_type: "court_order";
      court_order_reference: string;
      actor_role: string;
    };
  };
}

// ─── Dagslinjen QuickAdd — UI interaction telemetry (2026-05-15) ─────────────
//
// Emitted when manager picks an action from SlotQuickAddPopover on Dagslinjen.
// posthog: product analytics (funnel: click-slot → action → sheet open → submit).
// logger: debugging.
// No activity_trail (UI interaction only — write actions emit their own events).
// No engine_event (not a state-machine input).
export interface UiDagslinjenSlotQuickaddActionPicked extends BaseEvent {
  event: "ui.dagslinjen.slot_quickadd.action_picked";
  properties: {
    data: {
      /** Action the manager chose: booking | note | task | deviation | shift_start */
      action: "booking" | "note" | "task" | "deviation" | "shift_start";
      /** The time slot in HH:MM the manager clicked on the strip */
      time: string;
    };
  };
}

// Emitted when manager changes the Dagslinjen scope filter (avdeling / team / vakt / all).
// posthog: product analytics (filter adoption funnel).
// logger: debugging.
// No activity_trail (pure view filter — no write).
// No engine_event (not a state-machine input).
export interface UiDagslinjenScopeFilterChanged extends BaseEvent {
  event: "ui.dagslinjen.scope_filter_changed";
  properties: {
    data: {
      /** Encoded previous scope, e.g. "all" or "team:abc-123" */
      from: string;
      /** Encoded new scope, e.g. "department:def-456" */
      to: string;
    };
  };
}

// ─── Dagslinjen selection interaction telemetry (B1 sortie 2026-05-17) ────────
//
// ui.dagslinjen.marker_clicked
//   Emitted when a user clicks an event marker on the timeline strip.
//   posthog: product analytics (strip engagement funnel).
//   logger: debugging.
//   No activity_trail (UI interaction only — the underlying entity's own events handle audit).
//   No engine_event (not a state-machine input).
//
// ui.dagslinjen.list_row_clicked
//   Emitted when a user clicks an event row in the event list.
//   posthog: product analytics (list engagement vs strip engagement).
//   logger: debugging.
//   No activity_trail / engine_event (UI interaction only).

export interface UiDagslinjenMarkerClicked extends BaseEvent {
  event: "ui.dagslinjen.marker_clicked";
  properties: {
    data: {
      eventId: string;
      /** The type of the timeline event (booking, task, deviation, etc.) */
      eventTypeKind: string;
      departmentId: string;
      sessionId: string;
      /** Local HH:MM time of the event */
      time: string;
    };
  };
}

export interface UiDagslinjenListRowClicked extends BaseEvent {
  event: "ui.dagslinjen.list_row_clicked";
  properties: {
    data: {
      eventId: string;
      /** The type of the timeline event (booking, task, deviation, etc.) */
      eventTypeKind: string;
      departmentId: string;
      sessionId: string;
      /** Local HH:MM time of the event */
      time: string;
      /** Active filter value: "all" or a specific DayEventType */
      filterActive: string;
    };
  };
}

// ─── Dagslinjen ClusterMarker telemetry (ui-shell Tidslinjen-redesign sortie) ───
//
// Emitted when a cluster marker is expanded (popover opens).
// posthog: product analytics — how often dense timelines collapse.
// logger: debugging.
// No activity_trail (view interaction only, no write).
// No engine_event (not a state-machine input).
export interface UiDagslinjenClusterExpanded extends BaseEvent {
  event: "ui.dagslinjen.cluster_expanded";
  properties: {
    data: {
      /** HH:MM bucket start — which 15-min window was clustered. */
      bucketStart: string;
      /** Number of events collapsed into this cluster. */
      eventCount: number;
      /** Department context for the strip. */
      departmentId: string;
      /** Session context for the strip. */
      sessionId: string;
    };
  };
}

// ─── DayControlPanel Tidslinje tab telemetry (feat/p10-tidslinje-tab, 2026-05-23) ─
//
// tidslinje_tab_opened
//   Emitted when the manager activates the Tidslinje tab inside DayControlPanel.
//   posthog: product analytics (tab adoption funnel — how many sessions use Tidslinje).
//   logger: debugging.
//   activity_trail: navigation audit — opens are workspace-scoped and traceable
//     (differentiates from passive page loads; aligns with ADR-0358 read-path audit).
//   No engine_event: tab activation is a view event; no state-machine input.
//
// tidslinje_filter_changed
//   Emitted when the manager toggles a chip-bar filter (location or status).
//   posthog: product analytics (filter adoption — which filters see use).
//   logger: debugging.
//   No activity_trail: pure UI filter, no write; underlying shift/session events own audit.
//   No engine_event: filter state is ephemeral client state, not a state-machine input.

export interface TidslinjeTabOpened extends BaseEvent {
  event: "tidslinje_tab_opened";
  properties: {
    data: {
      workspace_id: string;
      profile_id: string;
      department_session_id: string;
      /** ISO 8601 date — which operational day the panel is showing. */
      date_iso: string;
    };
  };
}

export interface TidslinjeFilterChanged extends BaseEvent {
  event: "tidslinje_filter_changed";
  properties: {
    data: {
      workspace_id: string;
      profile_id: string;
      department_session_id: string;
      /** "location" | "status" */
      filter_type: string;
      /** The specific filter value toggled (e.g. location_id or status key). */
      filter_value: string;
      /** true = filter activated, false = filter deactivated. */
      active: boolean;
    };
  };
}

// ─── Dagslinjen targeted note fanout events (ADR-0331 / ADR-0333, Track E) ────
//
// comm.scheduled_note.created
//   Emitted by create-targeted-note-action on successful session_note INSERT.
//   activity_trail: audit — every note creation is traceable.
//   posthog: product analytics (adoption of targeted note feature).
//   logger: stdout observability.
//   No engine_event in Phase 1 — fanout is triggered by pg_cron, not engine state.
//
// comm.scheduled_note.delivered
//   Emitted by note-fanout-scheduler Edge Function (Track F) after successful fanout.
//   activity_trail: audit — delivery confirmation.
//   logger: stdout for scheduler observability.
//   No posthog — delivery is system-initiated, not user-initiated.
//   No engine_event — delivery is terminal state for Phase 1 note lifecycle.
//
// comm.scheduled_note.deleted
//   Emitted when a targeted note is soft-deleted (deleted_at set).
//   activity_trail: audit trail for deletions.
//   logger: stdout.
//   No posthog / engine_event — soft-delete is admin correction, not user funnel.

export interface CommScheduledNoteCreated extends BaseEvent {
  event: "comm.scheduled_note.created";
  properties: {
    entity: EntityRef;
    data: {
      note_id: string;
      audience_summary: {
        dept_count: number;
        team_count: number;
        shift_count: number;
        profile_count: number;
      };
      notify_at: string; // ISO 8601
      is_cross_dept: boolean;
    };
  };
}

export interface CommScheduledNoteDelivered extends BaseEvent {
  event: "comm.scheduled_note.delivered";
  properties: {
    data: {
      note_id: string;
      recipient_count: number;
      delivered_at: string; // ISO 8601
    };
  };
}

export interface CommScheduledNoteDeleted extends BaseEvent {
  event: "comm.scheduled_note.deleted";
  properties: {
    data: {
      note_id: string;
    };
  };
}

// ─── Timeline Templates (ADR-0334, T2 sortie 2026-05-16) ───────────────────
//
// timeline_template.saved
//   Emitted by save_template tool on successful INSERT into timeline_template.
//   posthog: adoption analytics (template-save funnel).
//   activity_trail: audit — every template creation traceable to a manager.
//   logger: stdout observability.
//   engine_event: downstream workflow reactions (e.g. notify team of new template).
//
// timeline_template.applied
//   Emitted by apply_template on successful exec callback (all inserts done).
//   posthog: adoption analytics (apply funnel — most valuable event).
//   activity_trail: audit — materialization is a D6 write event.
//   logger + engine_event: downstream workflow reactions.
//
// timeline_template.archived
//   Emitted by archive_template on successful UPDATE is_archived=true.
//   posthog + activity_trail + logger + engine_event: parity with other archive events.
//
// timeline_template.apply_failed
//   Emitted when exec callback throws inside apply_template.
//   posthog + activity_trail + logger: observability for failure diagnosis.
//   No engine_event — partial-apply failure should NOT trigger downstream reactions.
//
// timeline_template.listed
//   Debug-only read event. logger only — no audit trail (read-path, no mutation).

export interface TimelineTemplateSaved extends BaseEvent {
  event: "timeline_template.saved";
  properties: {
    data: {
      template_id: string;
      scope_type: string;
      item_count: number;
      name: string;
    };
  };
}

export interface TimelineTemplateApplied extends BaseEvent {
  event: "timeline_template.applied";
  properties: {
    data: {
      template_id: string;
      target_date: string;
      materialized_count_by_kind: Record<string, number>;
      freeform_skipped: number;
    };
  };
}

export interface TimelineTemplateArchived extends BaseEvent {
  event: "timeline_template.archived";
  properties: {
    data: {
      template_id: string;
    };
  };
}

export interface TimelineTemplateApplyFailed extends BaseEvent {
  event: "timeline_template.apply_failed";
  properties: {
    data: {
      template_id: string;
      target_date: string;
      error_code: string;
      error_message: string;
    };
  };
}

export interface TimelineTemplateListed extends BaseEvent {
  event: "timeline_template.listed";
  properties: {
    data: {
      count: number;
      scope_type: string;
    };
  };
}

// ─── Cascade Delegation Events (ADR-0356, Sortie 3 2026-05-17) ──────────────
//
// Two delegation tools emit here (bind_workspace_union + add_supplement_rule).
// Both route to all four destinations:
//   posthog: capability adoption tracking (which workspaces complete tariff setup).
//   logger: stdout observability in stage-engine.
//   activity_trail: compliance audit — cross-namespace writes must be fully traceable.
//     Auditors query WHERE delegated_via IS NOT NULL (ADR-0356 §"Audit trail symmetry").
//   engine_event: downstream workflow trigger — workspace_union_binding_created
//     triggers tariff-awareness reactions (calc engine, snapshot-freshness surface ADR-0354).
//
// cascade.supplement_rule_added: engine_event=false because supplement rule
// creation does not trigger a state-machine reaction by itself — the calc engine
// picks up new rules on next period recalc (high-frequency poll, not event-driven).

export interface CascadeWorkspaceUnionBindingCreated extends BaseEvent {
  event: "cascade.workspace_union_binding_created";
  properties: {
    entity: { entity_type: "workspace"; entity_id: string };
    data: {
      workspace_union_binding_id: string;
      workspace_id: string;
      union_id: string;
      law_version: string;
      amendment_classifier: string;
      /**
       * Which capability initiated this cross-namespace write.
       * Load-bearing per ADR-0356 §"Audit trail symmetry".
       * Auditors pair actor_capability + delegated_via to trace full provenance.
       */
      actor_capability: string;
      /** Load-bearing per ADR-0356 §"Audit trail symmetry". */
      delegated_via: string;
      actor_id: string;
    };
  };
}

export interface CascadeSupplementRuleAdded extends BaseEvent {
  event: "cascade.supplement_rule_added";
  properties: {
    entity: { entity_type: "workspace"; entity_id: string };
    data: {
      supplement_rule_id: string;
      workspace_id: string;
      supplement_type: string;
      rate_value: number;
      paragraf_ref: string | null;
      /**
       * Which capability initiated this cross-namespace write.
       * Load-bearing per ADR-0356 §"Audit trail symmetry".
       * Auditors pair actor_capability + delegated_via to trace full provenance.
       */
      actor_capability: string;
      /** Load-bearing per ADR-0356 §"Audit trail symmetry". */
      delegated_via: string;
      actor_id: string;
    };
  };
}

// ─── Payroll Tariff Delegation Events (Phase 7f, ADR-0356, 2026-05-17) ───────
//
// Three payroll-layer events that mirror the cascade-layer events above.
// These represent the PAYROLL side of the audit chain — the cascade side
// already has cascade.workspace_union_binding_created + cascade.supplement_rule_added.
//
// ADR-0356 §"Audit trail symmetry": BOTH layers emit.
//   Payroll emit: actor_capability='payroll', delegated_via='cascade'
//   Cascade emit: actor_capability=input.caller_capability, delegated_via='cascade'
//
// Routing rationale:
//   payroll.workspace_tariff_setup: 4 destinations — tariff binding is a significant
//     workspace configuration change that drives engine_event reactions (calc engine
//     tariff-awareness, ADR-0354 snapshot-freshness) AND needs compliance audit trail.
//   payroll.workspace_tariff_changed: 4 destinations — same rationale as setup;
//     tariff switch is a workspace lifecycle event with downstream state-machine reactions.
//   payroll.supplement_override_added: 3 destinations (no engine_event) — mirrors
//     cascade.supplement_rule_added reasoning: calc engine polls on next recalc,
//     not event-driven.

export interface PayrollWorkspaceTariffSetup extends BaseEvent {
  event: "payroll.workspace_tariff_setup";
  properties: {
    entity: { entity_type: "workspace_union_binding"; entity_id: string };
    data: {
      workspace_union_binding_id: string;
      workspace_id: string;
      union_id: string;
      law_version: string;
      effective_from: string;
      amendment_classifier: string;
      /**
       * Which capability initiated this cross-namespace write.
       * Load-bearing per ADR-0356 §"Audit trail symmetry".
       * Always 'payroll' for this event — identifies the PAYROLL LAYER of the chain.
       */
      actor_capability: string;
      /**
       * Which capability performed the actual DB write (the delegate).
       * Always 'cascade' for this event.
       * Load-bearing per ADR-0356 §"Audit trail symmetry".
       */
      delegated_via: string;
      actor_id: string;
    };
  };
}

export interface PayrollWorkspaceTariffChanged extends BaseEvent {
  event: "payroll.workspace_tariff_changed";
  properties: {
    entity: { entity_type: "workspace_union_binding"; entity_id: string };
    data: {
      old_workspace_union_binding_id: string;
      new_workspace_union_binding_id: string;
      workspace_id: string;
      new_union_id: string;
      new_law_version: string;
      effective_from: string;
      /** Semantic classifier: 'TARIFF_REVISION' (same union, new version) or 'UNION_CHANGE' (different union). */
      amendment_classifier: string;
      reason: string | null;
      /**
       * Always 'payroll' for this event.
       * Load-bearing per ADR-0356 §"Audit trail symmetry".
       */
      actor_capability: string;
      /**
       * Always 'cascade' for this event.
       * Load-bearing per ADR-0356 §"Audit trail symmetry".
       */
      delegated_via: string;
      actor_id: string;
    };
  };
}

export interface PayrollSupplementOverrideAdded extends BaseEvent {
  event: "payroll.supplement_override_added";
  properties: {
    entity: { entity_type: "supplement_rule"; entity_id: string };
    data: {
      supplement_rule_id: string;
      workspace_id: string;
      supplement_type: string;
      rate_value: number;
      rate_type: string;
      paragraf_ref: string | null;
      /**
       * Always 'payroll' for this event.
       * Load-bearing per ADR-0356 §"Audit trail symmetry".
       */
      actor_capability: string;
      /**
       * Always 'cascade' for this event.
       * Load-bearing per ADR-0356 §"Audit trail symmetry".
       */
      delegated_via: string;
      actor_id: string;
    };
  };
}

// ─── Payroll Tariff View Events (Phase 7g, 2026-05-17) ─────────────────────
// Read-path telemetry. No activity_trail (view event, no mutation).
// PostHog + Logger only — analytics on how often the tariff page / screen is viewed.

export interface PayrollTariffViewLoaded extends BaseEvent {
  event: "payroll.tariff_view_loaded";
  properties: {
    data: {
      route: string; // "/dashboard/payroll/tariff" or variant
      is_bound: boolean; // whether the workspace has an active tariff binding at load time
      viewed_at: string; // ISO 8601 timestamp
    };
  };
}

export interface PayrollTariffViewLoadedMobile extends BaseEvent {
  event: "payroll.tariff_view_loaded_mobile";
  properties: {
    data: {
      route: string; // "(me)/tariff" screen identifier
      is_bound: boolean; // whether the workspace has an active tariff binding at load time
      viewed_at: string; // ISO 8601 timestamp
    };
  };
}

// ─── Day-Line Runtime Events (ADR-0367, BT0-FOUNDATION 2026-05-18) ───────────
//
// 11 events covering: day_line lifecycle, shift_session clock-in/out, item
// distribution, routine attachment, org department-area updates, and the
// leak-detection sentinel.
//
// Routing rationale (category: "scheduling"):
//   day_line.created / day_line_item.added / shift_session.clocked_in|out /
//   routine.attached: 4 destinations — D6 production mutations with engine_event
//     reactions (guardian triggers, workflow state-machine inputs).
//   day_line.opening_changed / day_line.closing_changed / shift_session.bound:
//     3 destinations — operational adjustments; no downstream state-machine reaction.
//   day_line_item.notified: 4 destinations — notification confirmed; engine_event
//     needed for session acknowledgement workflow.
//   org.dept_areas_updated: 3 destinations — org-structure change (posthog + logger
//     + activity_trail). No engine_event: area edits do not drive state-machine.
//   shift_session.item_leak_detected: 3 destinations (alert + audit, no engine_event).

export interface DayLineCreated extends BaseEvent {
  event: "day_line.created";
  properties: {
    entity: { entity_type: "day_line"; entity_id: string };
    data: {
      day_line_id: string;
      department_session_id: string;
      location_id: string;
      department_id: string;
      workspace_id: string;
      planned_open: string;
      planned_close: string;
    };
  };
}

export interface DayLineOpeningChanged extends BaseEvent {
  event: "day_line.opening_changed";
  properties: {
    entity: { entity_type: "day_line"; entity_id: string };
    data: {
      day_line_id: string;
      old: string;
      new: string;
    };
  };
}

export interface DayLineClosingChanged extends BaseEvent {
  event: "day_line.closing_changed";
  properties: {
    entity: { entity_type: "day_line"; entity_id: string };
    data: {
      day_line_id: string;
      old: string;
      new: string;
    };
  };
}

export interface DayLineItemAdded extends BaseEvent {
  event: "day_line_item.added";
  properties: {
    entity: { entity_type: "day_line"; entity_id: string };
    data: {
      day_line_id: string;
      item_type: "task" | "routine";
      delegated_to_id: string;
      /**
       * Which capability initiated this write.
       * Load-bearing per ADR-0356 §"Audit trail symmetry".
       */
      actor_capability?: string;
      /** Load-bearing per ADR-0356 §"Audit trail symmetry". */
      delegated_via?: string;
    };
  };
}

export interface DayLineItemNotified extends BaseEvent {
  event: "day_line_item.notified";
  properties: {
    entity: { entity_type: "session_task"; entity_id: string };
    data: {
      item_id: string;
      shift_session_id: string;
      employee_id: string;
      day_line_id: string;
    };
  };
}

export interface ShiftSessionBound extends BaseEvent {
  event: "shift_session.bound";
  properties: {
    entity: { entity_type: "shift_session"; entity_id: string };
    data: {
      shift_session_id: string;
      day_line_ids: string[];
    };
  };
}

export interface ShiftSessionClockedIn extends BaseEvent {
  event: "shift_session.clocked_in";
  properties: {
    entity: { entity_type: "shift_session"; entity_id: string };
    data: {
      shift_session_id: string;
      clocked_in_at: string;
    };
  };
}

export interface ShiftSessionClockedOut extends BaseEvent {
  event: "shift_session.clocked_out";
  properties: {
    entity: { entity_type: "shift_session"; entity_id: string };
    data: {
      shift_session_id: string;
      clocked_out_at: string;
    };
  };
}

export interface RoutineAttached extends BaseEvent {
  event: "routine.attached";
  properties: {
    entity: { entity_type: "day_line"; entity_id: string };
    data: {
      day_line_id: string;
      template_id?: string;
      items_applied: number;
      /**
       * Which capability initiated this write.
       * Load-bearing per ADR-0356 §"Audit trail symmetry".
       */
      actor_capability?: string;
      /** Load-bearing per ADR-0356 §"Audit trail symmetry". */
      delegated_via?: string;
    };
  };
}

// ─── Procedure Engine Phase 1 Events (procedure-engine-phase1, 2026-05-22) ───
//
// routine.created: 4 destinations — admin C4 act creating a routine template.
//   engine_event: downstream workflows may react to a new routine being registered.
// routine.assigned_to_location: 4 destinations — scoping act (manager+, C4 confirm).
//   engine_event: session_hook wiring is a workflow-driving mutation.
// procedure_step.added: 3 destinations — content authoring by admin/manager.
//   No engine_event: step additions are authoring acts, not workflow state inputs.

export interface RoutineCreated extends BaseEvent {
  event: "routine.created";
  properties: {
    entity: { entity_type: "routine"; entity_id: string };
    data: {
      routine_id: string;
      name: string;
      procedure_id: string;
      protocol_id: string;
      trigger_type: string;
      executor_type: string;
    };
  };
}

export interface RoutineCreatedFromImage extends BaseEvent {
  event: "routine.created_from_image";
  properties: {
    entity: { entity_type: "routine"; entity_id: string };
    data: {
      routine_id: string;
      procedure_id: string;
      location_id: string;
      governance_status: "unassigned" | "attached";
      step_count: number;
      source_reference: string;
    };
  };
}

export interface RoutineGovernanceUnassigned extends BaseEvent {
  event: "routine.governance_unassigned";
  properties: {
    entity: { entity_type: "routine"; entity_id: string };
    data: { routine_id: string; source_reference: string };
  };
}

export interface RoutineAssignedToLocation extends BaseEvent {
  event: "routine.assigned_to_location";
  properties: {
    entity: { entity_type: "routine"; entity_id: string };
    data: {
      routine_id: string;
      location_id: string;
      team_ids: string[];
      /** Number of session_hook rows upserted. */
      hooks_upserted: number;
    };
  };
}

export interface ProcedureStepAdded extends BaseEvent {
  event: "procedure_step.added";
  properties: {
    entity: { entity_type: "procedure"; entity_id: string };
    data: {
      step_id: string;
      procedure_id: string;
      title: string;
      step_order: number;
      is_required: boolean;
      /** routine_id that initiated the step addition, if delegated via routine.add_step */
      source_routine_id?: string;
    };
  };
}

export interface OrgDeptAreasUpdated extends BaseEvent {
  event: "org.dept_areas_updated";
  properties: {
    entity: { entity_type: "department"; entity_id: string };
    data: {
      department_id: string;
      location_id: string;
      action: "add" | "remove";
    };
  };
}

export interface ShiftSessionItemLeakDetected extends BaseEvent {
  event: "shift_session.item_leak_detected";
  properties: {
    entity: { entity_type: "session_task"; entity_id: string };
    data: {
      offending_day_line_id: string;
      shift_session_id: string;
    };
  };
}

// ─── Join Session Recovery Events (ADR-0358, feat/join-expired-session-rescue, 2026-05-18) ──
//
// Pre-auth /join surface events. workspace_id is null (no workspace exists yet at
// this point in the signup flow). actor_id is "anonymous" (user identity not yet
// resolved — Supabase session is absent by definition when these fire).
//
// Routing rationale:
//   join.session_expired_rescued: posthog + logger only. Load-time detection event;
//     no workspace or actor for activity_trail; analytics-only (conversion funnel).
//   join.session_expired_at_submit: posthog + logger only. Submit-time detection;
//     same pre-auth rationale. No engine_event: no workflow state machine to advance.

export interface JoinSessionExpiredRescued extends BaseEvent {
  event: "join.session_expired_rescued";
  properties: {
    data: {
      /** Whether a valid (in-TTL) wizard envelope was found in localStorage. */
      has_envelope: boolean;
      /**
       * How old the envelope was when the redirect fired (hours, one decimal).
       * Null when the age could not be computed (parse failure).
       */
      envelope_age_hours: number | null;
    };
  };
}

export interface JoinSessionExpiredAtSubmit extends BaseEvent {
  event: "join.session_expired_at_submit";
  properties: {
    data: {
      /** The wizard step index that triggered onComplete (6 = Step 6 Summary). */
      wizard_step: number;
    };
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
  // Added 2026-06-10 (audit-fsc04-day-control-server-actions, F-SC-04-13).
  // Fired by updateDepartmentSessionDutyLeaderAction when a duty leader is
  // reassigned. engine_event included so attribution + control plane can
  // consume the handover signal.
  "session duty_leader_updated": {
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
  // ─── Session-Task Defense (ADR-0298, Sortie 1) ──────────────
  "shift confirmed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },
  "hours confirmed": {
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
  // Interaction: user navigates to a handbook chapter via sidebar click.
  // Read-path: posthog (content engagement) + logger + activity_trail. No engine_event.
  "handbook chapter_opened": {
    destinations: ["posthog", "logger", "activity_trail"],
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
  "chat message_read": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "channels",
  },
  "chat typing": {
    destinations: ["logger"],
    category: "channels",
  },
  "chat message_delivered": {
    destinations: ["logger", "activity_trail"],
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
  "contracts.revise.opened": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  "contracts.awaiting_signature.viewed": {
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
  // channel.viewed — PostHog + Logger only: read-only surface entry, no downstream workflow.
  "channel.viewed": {
    destinations: ["posthog", "logger"],
    category: "channels",
  },
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
    destinations: ["posthog", "logger", "activity_trail"],
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
    destinations: ["posthog", "logger", "activity_trail"],
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

  // Announcement V2 events (Track F — spec §12, ADR-0358)
  "announcement.link_followed": {
    destinations: ["posthog", "activity_trail"], // skip logger: volume concern (§12.2)
    category: "channels",
  },
  "announcement.kind_changed": {
    destinations: ["posthog"], // composer analytics only (§12.3)
    category: "channels",
  },
  "announcement.tier_overridden": {
    destinations: ["posthog", "activity_trail"], // §12.4
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
  // Interaction: manager opens deviation detail drawer.
  // Read-path: posthog (engagement) + logger + activity_trail. No engine_event.
  "deviation viewed": {
    destinations: ["posthog", "logger", "activity_trail"],
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
  "botsson.session.created": {
    destinations: ["logger", "activity_trail"],
    category: "agent",
  },
  "botsson.session.archived": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "botsson.authority_filtered": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },

  // attachment.routed: MIME-type deterministic capability dispatch fired.
  // Emitted by: stage-engine agent-router.ts BEFORE intent-classifier.
  // When a spreadsheet attachment (.xlsx/.xls/.csv) is present, the resolver
  // short-circuits LLM classification and forces bulk_import capability.
  // Routing decision only — no user action, no audit trail needed.
  // Destinations: posthog (adoption analytics) + logger (debugging).
  "attachment.routed": {
    destinations: ["posthog", "logger"],
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

  // Voice runtime quality observability (ADR-0282 R6 amendment 2026-05-10).
  // OBSERVATIONAL only — no activity_trail (no audit need) and no engine_event
  // (no workflow trigger). PostHog + logger for Phase F1 data-driven tuning.
  "voice.first_speech_ts_ms": {
    destinations: ["posthog", "logger"],
    category: "agent",
  },
  "voice.turn_end_ts_ms": {
    destinations: ["posthog", "logger"],
    category: "agent",
  },
  "voice.user_recut": {
    destinations: ["posthog", "logger"],
    category: "agent",
  },
  "voice.session_abandonment": {
    destinations: ["posthog", "logger"],
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
  "godmode.admin_access": {
    // Per ADR-0410: every godmode admin route visit MUST land in activity_trail.
    destinations: ["logger", "activity_trail"],
    category: "security",
  },
  "godmode.workspace_joined": {
    // Per ADR-0410: godmode workspace auto-join — audit mandatory.
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

  // Notification read mutations — agent-callable via Botsson harness tools (ADR-0134).
  // activity_trail: mutation audit (who marked what as read, for support triage).
  // posthog + logger: engagement analytics + operational stdout.
  "notification.marked_read": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "navigation",
  },
  "notification.marked_all_read": {
    destinations: ["posthog", "logger", "activity_trail"],
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
  "profile activated": {
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
  "profile team_member added": {
    destinations: ["logger", "activity_trail"],
    category: "org_structure",
  },
  "profile team_member removed": {
    destinations: ["logger", "activity_trail"],
    category: "org_structure",
  },
  "profile emergency_contact updated": {
    destinations: ["logger", "activity_trail"],
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
  "session_task.overdue": {
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
  // emit sites: apps/web/src/app/m/{auth/callback,invite/callback,invite/[token],update-password,confirm-email}/page.tsx
  // Pre-auth visitor event — no actor_id yet. Skip activity_trail (ADR-0134 NOT NULL invariant).
  "auth bridge_relayed": {
    destinations: ["posthog", "logger"],
    category: "auth",
  },
  // ─── Security ─────────────────────────────────
  "security rate_limited": { destinations: ["logger", "activity_trail"], category: "security" },
  "security lockout_triggered": {
    destinations: ["logger", "activity_trail"],
    category: "security",
  },
  "security sandbox_blocked": { destinations: ["logger", "activity_trail"], category: "security" },
  // ADR-0151 Invariant I4 — body workspace_id forgery rejection at /api/wizard/start.
  "security.workspace_id_forgery_rejected": {
    destinations: ["logger", "activity_trail"],
    category: "security",
  },
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

  // ─── People / Staff Events ────────────────────────────────────
  // Entity creates route to all three mutation destinations so engine_event can
  // trigger follow-up journeys and activity_trail has a full audit record.
  "staff_event created": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },

  // ─── Governance / Training MVP — Phase 0 (ADR-0101..0106) ────
  "policy created": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "training",
  },
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
  // Watchdog: cron-detected missing billing run. Logger + billing_activity_log
  // only — the audit stream IS the alert. No engine_event (no invoice to spawn
  // a lifecycle process from). feat/billing-cron-correctness R1.
  "invoice generation_missing": {
    destinations: ["logger", "billing_activity_log"],
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

  // EHF-innstillinger er company-scoped (workspace_id null).
  // posthog: adopsjonskurve for EHF-aktivering.
  // logger: drift-synlighet.
  // activity_trail utelatt: provider har early-return på workspace_id === null — company-scoped events faller gjennom; audit dekkes av posthog + logger.
  "company.ehf_settings_updated": {
    destinations: ["posthog", "logger"],
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

  // ─── Journey Authoring Wizard (ADR-0257) ─────
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

  // ─── Tips (campaign/tips-handling Sortie 1, spec 2026-04-28) ─────────────────
  // tip_pool created + tip_distribution adjusted + tip_pool approved: full 4-destination fanout.
  // tip_distribution calculated: 2 destinations only (logger + engine_event) — high-volume,
  // one row per employee per pool; posthog/activity_trail would add noise without signal.
  "tip_pool created": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "tips",
  },
  "tip_distribution calculated": {
    destinations: ["logger", "engine_event"],
    category: "tips",
  },
  "tip_distribution adjusted": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "tips",
  },
  "tip_pool approved": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "tips",
  },

  // ─── Tips settings toggle (Phase 4 — admin settings UI) ─────────────────────
  // posthog: feature-adoption tracking (which workspaces enable tips).
  // logger: standard operational log.
  // activity_trail: admin audit — who toggled and when.
  // engine_event excluded: feature flag change has no downstream state-machine trigger.
  "tips_workspace_settings toggled": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "tips",
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

  // ─── Payroll Engine Phase 1 (ADR-0057, T4.3) ─────────────────────────────
  "payroll.period_created": {
    // period_created → engine_event: downstream period-lifecycle workflow
    // triggers mirror period_locked routing (low-frequency, human-initiated).
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "payroll",
  },
  "payroll.period_locked": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "payroll",
  },
  "payroll.period_approved": {
    // period_approved → engine_event: mirrors period_locked routing.
    // Downstream subscribers (ADR-0319 notify_each_profile fan-out, payslip
    // generation orchestration) react to approval terminal-event.
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "payroll",
  },
  "payroll.deviation_acknowledged": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "payroll",
  },
  "payroll.deviation_blocked_approval": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "payroll",
  },
  "payroll.manual_supplement_added": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "payroll",
  },
  "payroll.manual_supplement_deleted": {
    // Same routing as _added sibling: low-frequency audit event, human-initiated.
    // Emitted by delete_manual_supplement capability tool (T2.x). Journey
    // JOURNEY-payroll-phase-2-manager-deletes-manual-supplement.md line 57.
    destinations: ["posthog", "logger", "activity_trail"],
    category: "payroll",
  },
  "payroll.overtime_mode_changed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "payroll",
  },
  "payroll.timebank_accrued": {
    // High-frequency — activity_trail only (floods PostHog per spec §9)
    destinations: ["activity_trail"],
    category: "payroll",
  },
  "payroll.timebank_withdrawn": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "payroll",
  },
  "payroll.timebank_payout_forced": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "payroll",
  },
  "payroll.timebank_balance_adjusted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "payroll",
  },
  "payroll.supplement_rule_fired": {
    // High-frequency — activity_trail only (floods PostHog per spec §9)
    destinations: ["activity_trail"],
    category: "payroll",
  },
  "payroll.supplement_rule_test_run": {
    // Admin preview — posthog only (no audit trail needed)
    destinations: ["posthog"],
    category: "payroll",
  },
  "payroll.recalc_triggered": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "payroll",
  },
  "payroll.tariff_freeze_drift": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "payroll",
  },

  // ─── Payroll Engine Phase 2 (ADR-0292, T1.4) ─────────────────────────────
  // line_override_proposed/approved/rejected/overridden: low-volume audit events
  // in the manager → admin approval chain → posthog + activity_trail.
  // recalc_triggered_by_supplement + recalc_triggered_by_tip_distribution:
  // high-frequency (fires per supplement insert/delete and per tip employee
  // at pool approval time) → activity_trail only to avoid PostHog flooding.
  // All six events include logger for structured stdout in stage-engine.
  "payroll.line_override_proposed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "payroll",
  },
  "payroll.line_override_approved": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "payroll",
  },
  "payroll.line_override_rejected": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "payroll",
  },
  "payroll.line_overridden": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "payroll",
  },
  "payroll.recalc_triggered_by_supplement": {
    // High-frequency — activity_trail only (floods PostHog per spec §9 pattern)
    destinations: ["logger", "activity_trail"],
    category: "payroll",
  },
  "payroll.recalc_triggered_by_tip_distribution": {
    // High-frequency — activity_trail only (floods PostHog per spec §9 pattern)
    destinations: ["logger", "activity_trail"],
    category: "payroll",
  },

  // ─── Payroll Engine Phase 3 (CSV Export, T2.3) ─────────────────────────────
  // csv_exported: low-volume admin action → posthog + activity_trail for audit.
  //   logger for structured stdout (stage-engine visibility).
  //   No engine_event — no automated downstream reaction to a CSV download.
  // csv_export_unmasked: security-sensitive — raw PII downloaded.
  //   Same 3 destinations as csv_exported; treated as a security-audit row.
  //   PostHog included so security team can query "unmasked exports per workspace".
  // csv_export_failed: error path → logger + activity_trail for investigation.
  //   PostHog excluded (error noise distorts funnel analytics).
  "payroll.csv_exported": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "payroll",
  },
  "payroll.csv_export_unmasked": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "payroll",
  },
  "payroll.csv_export_failed": {
    destinations: ["logger", "activity_trail"],
    category: "payroll",
  },

  // ─── Payroll Phase 4 — PDF Lønnsgrunnlag (ADR-0294) ──
  // lonnsgrunnlag_generated: primary export event → posthog + logger + activity_trail
  //   (Bokføringsloven §13: every generation logged). No engine_event — terminal action.
  // lonnsgrunnlag_url_granted: high-PII access audit → posthog + logger + activity_trail
  //   Records WHO got signed-URL access, for HOW LONG. No engine_event.
  // lonnsgrunnlag_generation_failed: error path → logger + activity_trail only.
  //   PostHog excluded (error noise distorts export funnel analytics).
  "payroll.lonnsgrunnlag_generated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "payroll",
  },
  "payroll.lonnsgrunnlag_url_granted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "payroll",
  },
  "payroll.lonnsgrunnlag_generation_failed": {
    destinations: ["logger", "activity_trail"],
    category: "payroll",
  },
  // ─── Payroll — Feriepenger Basis (ADR-0295) ────────────
  // Emitted per-employee per-period at BFF compute sites.
  // logger + activity_trail only — high-frequency per-profile audit; PostHog excluded.
  "payroll.feriepenger_basis_computed": {
    destinations: ["logger", "activity_trail"],
    category: "payroll",
  },

  // ─── Payroll Phase 5 — PII Reveal ─────────────────────
  // personal_number_revealed + bank_account_revealed: high-PII reveal-audit events.
  //   Routed to logger + activity_trail + engine_event. PostHog INTENTIONALLY
  //   excluded (high-PII access events do not belong in product analytics
  //   funnels per ADR-0077). engine_event included so cross-workspace attempts
  //   (ADR-0151 forgery defence) can fan out C4 governance deviations.
  "payroll.personal_number_revealed": {
    destinations: ["logger", "activity_trail", "engine_event"],
    category: "payroll",
  },
  "payroll.bank_account_revealed": {
    destinations: ["logger", "activity_trail", "engine_event"],
    category: "payroll",
  },

  // ─── Payroll Trekk-Samtykke (SMA-328, ADR-0311) ─────────────────────────────
  // deduction_consent_referenced: posthog (funnel analytics) + activity_trail (Bokf.lov §13 audit).
  // deduction_rejected_no_consent: activity_trail + logger ONLY — blocked actions skip posthog.
  // legal.aml_14_15.validated: posthog (compliance analytics) + activity_trail.
  "payroll.deduction_consent_referenced": {
    destinations: ["posthog", "activity_trail", "logger"],
    category: "payroll",
  },
  "payroll.deduction_rejected_no_consent": {
    destinations: ["activity_trail", "logger"],
    category: "payroll",
  },
  "legal.aml_14_15.validated": {
    destinations: ["posthog", "activity_trail"],
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

  // ─── Lovsen — Norwegian Labor-Law Advisor (ADR-0256, P1.S0) ─────
  // All 9 events: posthog + logger + activity_trail.
  // engine_event excluded in P1.S0 — added in P1.S4 when the Botsson
  // industry_intelligence.lovsen_query capability lands (ADR-0259).
  "lovsen.query.received": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "lovsen",
  },
  "lovsen.query.classified": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "lovsen",
  },
  "lovsen.skill.invoked": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "lovsen",
  },
  "lovsen.mcp.fetch": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "lovsen",
  },
  "lovsen.mcp.fetch.completed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "lovsen",
  },
  "lovsen.mcp.fetch.failed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "lovsen",
  },
  "lovsen.answer.composed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "lovsen",
  },
  "lovsen.confidence.degraded": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "lovsen",
  },
  "lovsen.citation.stale": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "lovsen",
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
  // ─── Schedule Density (feat/schedule-card-density) ───────────────────────
  "schedule.density_changed": {
    destinations: ["posthog", "activity_trail"],
    category: "scheduling",
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
  // dismissed: posthog (funnel exit) + logger + activity_trail (audit — who
  //   dismissed and at which step). No engine_event (only _completed triggers
  //   downstream flows). Emit sites land in T11 (dismissWelcomeWizard Server Action).
  "profile welcome_wizard_dismissed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "onboarding",
  },
  // resumed: posthog (re-engagement funnel) + logger + activity_trail (audit).
  //   No engine_event. Emit sites land in T11 (resumeWelcomeWizard Server Action).
  "profile welcome_wizard_resumed": {
    destinations: ["posthog", "logger", "activity_trail"],
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

  // ─── Billing M7 — Avstemming / Settlement (ADR-E, 2026-05-02) ──────────
  // run_initiated: posthog (Erik funnel) + activity_trail (audit).
  //   No billing_activity_log — initiated fires before the run row exists.
  // run_completed: posthog + activity_trail + billing_activity_log (MVA-compliance).
  // run_failed: logger + activity_trail + billing_activity_log (ops visibility + audit).
  //   No posthog — failure is not a product-funnel metric.
  // period_locked: posthog + activity_trail + billing_activity_log (state transition).
  //   workspace_id is non-null here (per-workspace lock event).
  // period_closed: full 4-destination fanout — engine_event for downstream triggers.
  //   Post-MVP; registered now so the registry is complete.
  // artifact_downloaded: posthog + activity_trail (analytics + access audit per GDPR).
  "settlement run_initiated": {
    destinations: ["posthog", "activity_trail"],
    category: "billing",
  },
  "settlement run_completed": {
    destinations: ["posthog", "activity_trail", "billing_activity_log"],
    category: "billing",
  },
  "settlement run_failed": {
    destinations: ["logger", "activity_trail", "billing_activity_log"],
    category: "billing",
  },
  "settlement period_locked": {
    destinations: ["posthog", "activity_trail", "billing_activity_log"],
    category: "billing",
  },
  "settlement period_closed": {
    destinations: ["posthog", "activity_trail", "billing_activity_log", "engine_event"],
    category: "billing",
  },
  "settlement artifact_downloaded": {
    destinations: ["posthog", "activity_trail"],
    category: "billing",
  },

  // ─── Calendar Redesign (feat/mobile-calendar-redesign, Phase 3a) ──────────
  // Read-only navigation events — no engine_event (no D6 workflow trigger).
  // posthog: product analytics (feature adoption, filter preference).
  // logger: dev visibility. No activity_trail — pure nav events, no data-access audit.
  // Registered pre-implementation per L-0094 phantom-emit prevention and
  // Phase 2 steward Condition 2 (ADR-0134 enforcement).
  // category fixed to "navigation" (EventCategory union) — was "mobile_calendar" (invalid).
  "calendar item_viewed": {
    destinations: ["posthog", "logger"],
    category: "navigation",
  },
  "calendar scope_changed": {
    destinations: ["posthog", "logger"],
    category: "navigation",
  },
  "calendar filter_changed": {
    destinations: ["posthog", "logger"],
    category: "navigation",
  },
  "calendar view_changed": {
    destinations: ["posthog", "logger"],
    category: "navigation",
  },
  "calendar tab_switched": {
    destinations: ["posthog", "logger"],
    category: "navigation",
  },
  "calendar day_selected": {
    destinations: ["posthog", "logger"],
    category: "navigation",
  },
  "calendar.hub.viewed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },

  // ─── Business Intelligence Capability (ADR-0270) ─────────────────────────
  // called-events: posthog + logger + activity_trail (godmode audit trail).
  // cost-events:   posthog + logger + engine_event (cost monitoring + alerts).
  "business_intelligence.find_hospitality_businesses.called": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "enrichment",
  },
  "business_intelligence.find_hospitality_businesses.cost": {
    destinations: ["posthog", "logger", "engine_event"],
    category: "enrichment",
  },
  "business_intelligence.enrich_company_intelligence.called": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "enrichment",
  },
  "business_intelligence.enrich_company_intelligence.cost": {
    destinations: ["posthog", "logger", "engine_event"],
    category: "enrichment",
  },
  "business_intelligence.generate_company_copy.called": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "enrichment",
  },
  "business_intelligence.generate_company_copy.cost": {
    destinations: ["posthog", "logger", "engine_event"],
    category: "enrichment",
  },
  "business_intelligence.search_brreg.called": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "enrichment",
  },
  "business_intelligence.search_brreg.cost": {
    destinations: ["posthog", "logger"],
    category: "enrichment",
  },
  "business_intelligence.lookup_brreg.called": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "enrichment",
  },
  "business_intelligence.lookup_brreg.cost": {
    destinations: ["posthog", "logger"],
    category: "enrichment",
  },
  "business_intelligence.scrape_website.called": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "enrichment",
  },
  "business_intelligence.scrape_website.cost": {
    destinations: ["posthog", "logger"],
    category: "enrichment",
  },

  // ─── Welcome Mission V0 (ADR-0274 — B5-fix per L-0046 space-form) ──────────
  // engine_event = sync workflow brain (cascade trigger). activity_trail+posthog = audit fanout via outbox.
  "welcome stage_advanced": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "welcome",
  },
  "welcome stage_failed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "welcome",
  },
  "welcome mission_abandoned": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "welcome",
  },
  "welcome session_resumed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "welcome",
  },
  "welcome session_restarted_after_window": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "welcome",
  },
  "welcome spawn_evaluated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "welcome",
  },
  "welcome early_exit_via_transition": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "welcome",
  },

  // ─── Inquiry (cross-session open threads) ────────────────────────────
  "inquiry noted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "inquiry",
  },
  "inquiry closed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "inquiry",
  },

  // ─── Mission-capability transition tool ──────────────────────────────
  "mission transitioned": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "agent",
  },

  // ─── UI-capability extensions for Welcome Mission ────────────────────
  "ui pointed_at_setting": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "navigation",
  },
  "ui demo_shown": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "navigation",
  },

  // ─── Booking (feat/mobile-addsheet-booking-stack, ADR-0267 + ADR-0099) ─────
  "booking created": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },

  // ─── Onboarding Capability (ADR-0282 Phase E T1.9) ──────────────────────────
  // business_updated: audit trail for workspace metadata mutations.
  // season_updated: D4 surface → engine_event enables future cascade-trigger wiring.
  // procedure_added: audit trail for governance content creation.
  // scrape_completed: posthog + logger only (cost-cap, no mutation to audit).
  "onboarding.business_updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "onboarding",
  },
  "onboarding.season_updated": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "onboarding",
  },
  "onboarding.procedure_added": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "onboarding",
  },
  "onboarding.scrape_completed": {
    destinations: ["posthog", "logger"],
    category: "onboarding",
  },

  // ─── Agent Schedule Query Events (feat/schedule-admin-view 2026-05-11) ──────
  // Read-only schedule queries emitted by the schedule capability tools.
  // posthog + logger for analytics; activity_trail for access audit (schedule
  // data contains employee PII via display_name / shift context).
  // No engine_event — read-only query, no state-machine trigger.
  "agent.schedule.workspace_queried": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "agent.schedule.date_queried_self": {
    destinations: ["posthog", "logger"],
    category: "agent",
  },

  // ─── Outreach Capability (ADR-0282 — Audit 2026-05-06 finding H-03) ──────────
  // send_sms + call_employee are outbound mutations to employees — all four
  // destinations mandatory per ADR-0004. engine_event allows downstream
  // workflows to react to outreach (e.g. follow-up reminder, delivery receipt).
  // activity_trail provides the operator audit trail for compliance.
  "outreach sms_sent": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "communication",
  },
  "outreach call_initiated": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "communication",
  },

  // ─── Engine World (20260525000000_engine_world.sql — Audit 2026-05-06 H-01/M-04) ──
  // engine_world rows are written by heartbeat jobs and agent conductors.
  // observation_written: every new/updated observation → 4 destinations so
  //   engine_event can trigger alerts when a surface goes red/yellow.
  // status_changed: status transition (green→red etc.) → 4 destinations;
  //   activity_trail for audit, engine_event for incident workflows.
  "engine_world observation_written": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "system",
  },
  "engine_world status_changed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "system",
  },

  // ─── Engine Dispatch Action Invocation (ADR-0424) ──────────────────────────
  // Emitted by the invoke_capability_tool handler after tool execute() returns.
  // 4 destinations: posthog (action analytics) + logger (stdout observability
  // in engine-dispatch) + activity_trail (per-step C4 governance audit trail) +
  // engine_event (monitoring rules can react to tool_status=denied/error).
  // Never emitted inside a tool body — always at the dispatcher handler level,
  // after gate_action passes and tool execute() completes (success or throws).
  "engine.action.invoked.invoke_capability_tool": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "system",
  },

  // ─── Engine Dispatch Bridge Transport (ADR-0424 §Telemetry split) ─────────────
  // Emitted by engine-dispatch EF after fetch() to stage-engine returns.
  // EF-layer transport fact distinct from Node-side execution event above.
  // 3 destinations only — NOT engine_event (Node side already writes engine_event
  // per §Telemetry split; duplicating would produce two rows per invocation).
  "engine.dispatch.bridge_invoked": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "system",
  },

  // ─── Composition Orchestrator (ADR-0204 SS-5 — Audit 2026-05-06 M-02) ────────
  // gate_evaluated fires each time gatedMutation() resolves a composition
  // decision (both allow and deny paths). Routing: posthog + logger +
  // activity_trail (gate decisions are auditable); engine_event excluded
  // because a gate decision itself is not a state-machine input — it is
  // diagnostic metadata. Aligns with how other audit-only events route
  // (e.g. contract.pii.revealed routes all 4; gate evaluation is lower-stakes).
  gate_evaluated: {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },

  // ─── Contract Dispatch UX Pass (SMA-303 + SMA-305 + SMA-307) ────────────────
  "contract.preview.edited": {
    destinations: ["posthog", "logger"],
    category: "contracts",
  },
  "contract.send_blocked.missing_fields": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  // 4 destinations: compliance event triggers downstream onboarding reactions (ADR-0004)
  "payroll.admin_filled_pii": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "contracts",
  },
  "contract.send_retry_after_fill": {
    destinations: ["posthog", "logger"],
    category: "contracts",
  },
  // No engine_event — infra failure is not a workflow trigger
  "contract.send_failed.service_down": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },

  // ─── Contracts Compliance Cluster (SMA-306/307/310/311, ADR-0308-0310) ──────
  // dispatch_failed_safe: aliases send_failed.service_down for clarity. Same routing.
  "contract.dispatch_failed_safe": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  // validation_failed: diagnostic paired with legal.aml_14_6.validated for non-pass.
  // activity_trail: 5yr audit per Bokf.lov §13 (contract compliance evidence).
  "contract.aml_14_6.validation_failed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  // pdf_gate.enforced: server confirmed pdf_preview_viewed_at persisted.
  // posthog + logger only — success path, not a high-signal audit event.
  "contract.pdf_gate.enforced": {
    destinations: ["posthog", "logger"],
    category: "contracts",
  },
  // pdf_gate.bypassed_attempt: attack signal — scripted bypass without viewing PDF.
  // activity_trail: high-signal audit for security review.
  "contract.pdf_gate.bypassed_attempt": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },
  // gate.contract_send_denied: C4 gateAction denied — authority enforcement audit.
  // activity_trail: audit trail for governance review.
  "gate.contract_send_denied": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "contracts",
  },

  // ─── Agent Memory (F-MEM-UNBLOCK-A3 — Phase A3 items 3+4) ───────────────────
  // Summary written at session-end (expire or abandon). audit + analytics.
  // No engine_event — memory summary does not trigger D6 workflow steps.
  "agent.memory.summary_written": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  // SE02-03 closure (audit 2026-05-15). Direct memory add from /api/emma/memory POST.
  // Same routing as summary_written — audit + analytics, no workflow trigger.
  "agent.memory.added": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },

  // ─── Task Capability Unified Events (ADR-0298, Sortie 3) ────────────────────
  // Replaces per-source events (session_task.created, personal.task_created, etc.).
  // 30-day aliases kept in parallel; these are the canonical unified events.
  // engine_event on "task created" + "task completed": downstream workflows can
  // react to task lifecycle transitions (e.g. shift checkout gate).

  // task.list_mine: read-path observability. posthog + logger only — no audit trail
  // (reads don't produce audit rows), no engine_event (no D6 workflow trigger on reads).
  // Emitted by consumer (BFF / UI hook), NOT by listMine.execute or the RPC.
  // ADR-0317 + ADR-0298 R4.
  "task.list_mine": {
    destinations: ["posthog", "logger"],
    category: "operations",
  },

  "task created": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },
  "task completed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
  },
  "task cancelled": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },

  // task.session_task_updated: partial update of session_task (DnD re-timing).
  // Emitted only on successful write (gate-allow + row-found + update-ok).
  // engine_event: assignee changes may trigger downstream notifications.
  "task.session_task_updated": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "operations",
  },

  // ─── GDPR §13 Retention Events (ADR-0312, SMA-308) ──────────────────────────
  // Emitted via inline INSERT INTO activity_trail in anonymize_contract RPC body
  // (SECURITY DEFINER pattern — auth.uid() is NULL in pg_cron context).
  // Do NOT route through @smartout/telemetry from SQL.
  // These registry entries are for TypeScript-side consumers and governance dashboard.
  //
  // contract.retention_anonymized_§13:
  //   Fired when a contract row is anonymized by anonymize_contract(dry_run=false).
  //   Two variants distinguished by paragraph_ref in payload:
  //     paragraph_ref='Bokf.lov §13' → terminated/expired (5yr regnskapsårets slutt clock)
  //     paragraph_ref='GDPR Art. 17' → declined (3yr from declined_at clock)
  //   posthog: compliance analytics (anonymization volume, cutoff distribution).
  //   activity_trail: immutable audit of PII wipe event (who/what/when).
  //   logger: operational stdout for monitoring.
  //
  "contract.retention_anonymized_§13": {
    destinations: ["posthog", "activity_trail", "logger"],
    category: "contracts",
  },

  // ─── WFM Foundation — POS sync (ADR-0305) ────────────────────────────────────
  // connected/disconnected: admin C4 acts that unlock/lock D4 demand-input.
  //   4 destinations: engine_event for downstream workflow reactions (e.g. auto-trigger
  //   first sync run, alert when auth_failed). activity_trail for admin audit.
  // sale_event.ingested: aggregated per sync run (NOT per row — ADR-0134 cardinality).
  //   posthog + logger + activity_trail. No engine_event (cron sync is not a state trigger).
  "pos.account.connected": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "pos",
  },
  "pos.account.disconnected": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "pos",
  },
  "pos.sale_event.ingested": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "pos",
  },

  // ─── WFM Foundation — Shift marketplace (ADR-0306) ───────────────────────────
  // posted/claimed/approved: C4 acts on D6 schedule state.
  //   4 destinations: engine_event triggers push-notification fanout (post) + approves
  //   D6 shift assignment (approve). activity_trail for C4 audit.
  // expired/cancelled: passive lifecycle transitions.
  //   posthog + logger + activity_trail. No engine_event (no downstream reaction needed V1).
  "shift_offer.posted": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "shift_marketplace",
  },
  "shift_offer.claimed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "shift_marketplace",
  },
  "shift_offer.approved": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "shift_marketplace",
  },
  "shift_offer.expired": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "shift_marketplace",
  },
  "shift_offer.cancelled": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "shift_marketplace",
  },

  // ─── WFM Foundation — Scheduler bundle (ADR-0307 amended / ADR-0309) ─────────
  // One emit per logical bundle event — NEVER per-shift loop (ADR-0134).
  // proposed: solver run written as change_proposal (kind='scheduler_bundle').
  //   4 destinations: engine_event for downstream plan-review workflow (notify manager).
  // accepted: manager accepted → all proposed_shifts[] applied atomically.
  //   4 destinations: engine_event triggers D6 shift-creation applier.
  // rejected: manager rejected → no shifts applied.
  //   posthog + logger + activity_trail. No engine_event (no D6 effect).
  "scheduler.proposal.proposed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduler",
  },
  "scheduler.proposal.accepted": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduler",
  },
  "scheduler.proposal.rejected": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduler",
  },
  // diagnose_turnus_disabled read-only emit (feat/turnus-diagnose-and-template Phase 1).
  // No engine_event — read-only diagnose does not trigger any workflow.
  // Call-site: diagnose-tools.ts (same commit per L-NEW anti-phantom-emit rule).
  "scheduler.diagnose.requested": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduler",
  },
  // template listing + apply emits (feat/turnus-diagnose-and-template Phase 1, ADR-0417).
  // listed: read-only — no engine_event.
  // applied: write event — engine_event included (proposal creation triggers review workflow).
  // Call-sites: tools-template.ts (same commit per L-NEW anti-phantom-emit rule).
  "scheduler.template.listed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduler",
  },
  "scheduler.template.applied": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduler",
  },

  // ─── Contracts Compliance Debt Cleanup — consent_document.created ───────────────
  // Court-order direct-insert path (no DocuSeal). All 4 destinations:
  //   posthog: consent creation analytics.
  //   activity_trail: compliance audit — every court-order insertion must be traceable.
  //   logger: stdout for observability.
  //   engine_event: downstream workflow trigger (trekk configuration / deviation monitoring).
  "payroll.consent_document.created": {
    destinations: ["posthog", "activity_trail", "logger", "engine_event"],
    category: "payroll",
  },

  // ─── Dagslinjen QuickAdd UI telemetry (2026-05-15) ───────────────────────────
  // UI interaction only — posthog + logger. No activity_trail (not a write event).
  // Write actions (booking created, task created, etc.) emit their own existing events.
  "ui.dagslinjen.slot_quickadd.action_picked": {
    destinations: ["posthog", "logger"],
    category: "navigation",
  },

  // Scope filter change — view-only filter; no write, no engine_event.
  "ui.dagslinjen.scope_filter_changed": {
    destinations: ["posthog", "logger"],
    category: "navigation",
  },

  // ─── Dagslinjen selection interaction telemetry (B1 sortie 2026-05-17) ───────
  // UI interaction only — posthog + logger. No activity_trail (not a write event).
  // Underlying entities emit their own events when state mutates.
  "ui.dagslinjen.marker_clicked": {
    destinations: ["posthog", "logger"],
    category: "navigation",
  },

  "ui.dagslinjen.list_row_clicked": {
    destinations: ["posthog", "logger"],
    category: "navigation",
  },

  // ClusterMarker expanded — user tapped a collapsed bucket on DayTimelineStrip.
  // posthog: dense-timeline adoption funnel. logger: debug. No audit trail (view only).
  "ui.dagslinjen.cluster_expanded": {
    destinations: ["posthog", "logger"],
    category: "navigation",
  },

  // ─── DayControlPanel Tidslinje tab telemetry (feat/p10-tidslinje-tab, 2026-05-23) ─
  // tidslinje_tab_opened: posthog + logger + activity_trail — tab activation with
  //   workspace audit (read-path audit per ADR-0358). No engine_event (view event).
  // tidslinje_filter_changed: posthog + logger only — ephemeral UI filter state;
  //   no write = no activity_trail. No engine_event (not a state-machine input).
  tidslinje_tab_opened: {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "navigation",
  },
  tidslinje_filter_changed: {
    destinations: ["posthog", "logger"],
    category: "navigation",
  },

  // ─── Dagslinjen targeted note fanout (ADR-0331 / ADR-0333, Track E) ─────────
  // created: manager writes a note → posthog (adoption) + audit + logger.
  // delivered: scheduler fires fanout → audit + logger (system event, not user funnel).
  // deleted: soft-delete → audit + logger.
  "comm.scheduled_note.created": {
    destinations: ["activity_trail", "posthog", "logger"],
    category: "communication",
  },
  "comm.scheduled_note.delivered": {
    destinations: ["activity_trail", "logger"],
    category: "communication",
  },
  "comm.scheduled_note.deleted": {
    destinations: ["activity_trail", "logger"],
    category: "communication",
  },

  // ─── Pipeline stage envelope (ADR-0340) ─────────────────────────────────────
  // Additive lifecycle telemetry — does NOT replace shift_swap.* / shift_offer.*
  // (ADR-0340 §Preservation 1+2).
  //
  // proposed/consented/approved/cancelled: standard pipeline advancement.
  //   4 destinations: posthog (funnel analytics) + logger + activity_trail (C4 audit
  //   chain, ADR-0204 correlation_id linkage) + engine_event (downstream reaction e.g.
  //   trigger notification, unlock next stage wait).
  //
  // rejected: pipeline reaches failed terminal state.
  //   posthog + logger + activity_trail. No engine_event (no downstream D6 effect).
  //
  // overridden: admin C4 override (T5). All 4 destinations — override is a governance
  //   event that must trigger downstream reset + notification fanout.
  "pipeline.stage_proposed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "pipeline.stage_consented": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "pipeline.stage_approved": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "pipeline.stage_rejected": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "pipeline.stage_cancelled": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "pipeline.stage_overridden": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },

  // ─── Timeline Templates (ADR-0334, T2 sortie 2026-05-16) ───────────────────
  // saved: 4 destinations — posthog (adoption), logger (observability),
  //   activity_trail (audit: template creation must be traceable), engine_event (workflow).
  // applied: 4 destinations — most valuable analytics event (apply funnel) + full audit.
  // archived: 4 destinations — parity with other lifecycle-archive events.
  // apply_failed: 3 destinations — posthog + logger + activity_trail.
  //   No engine_event: partial-apply failure must NOT trigger downstream D6 reactions.
  // listed: logger only — read-path debug, no audit trail required.
  "timeline_template.saved": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "timeline_template.applied": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "timeline_template.archived": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "timeline_template.apply_failed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "timeline_template.listed": {
    destinations: ["logger"],
    category: "scheduling",
  },
  "cost.overview.viewed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "cost",
  },
  "billing.invoices.viewed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "billing",
  },

  // ─── HMS Read-surface (ui-shell-hms-cluster-polish-read) ─────────────────
  // Read-side views: posthog (adoption funnel) + logger (observability) +
  // activity_trail (manager engagement audit). No engine_event — reads do
  // NOT trigger downstream workflow reactions.
  "hms.umbrella.viewed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "hms",
  },
  "hms.drift.viewed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "hms",
  },
  "hms.documents.opened": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "hms",
  },
  "hms.training.viewed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "hms",
  },
  // people.training.viewed: 3 destinations (posthog + logger + activity_trail).
  // No engine_event — read-side view does not trigger downstream workflow steps.
  "people.training.viewed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "people",
  },
  // my.training.viewed: employee self-service funnel entry.
  // activity_trail excluded — read-only view, no actor-driven mutation.
  "my.training.viewed": {
    destinations: ["posthog", "logger"],
    category: "training",
  },
  // notifications.page_viewed: full-page varsler view (distinct from bell-overlay peek).
  // posthog: adoption funnel (do users who open the page act on it?).
  // logger: observability.
  // activity_trail excluded — read-only view, no mutation.
  "notifications.page_viewed": {
    destinations: ["posthog", "logger"],
    category: "communication",
  },

  // ─── Cascade Delegation (ADR-0356, Sortie 3 2026-05-17) ────────────────────
  // workspace_union_binding_created: 4 destinations.
  //   posthog: adoption tracking (which workspaces complete tariff binding setup).
  //   logger: operational stdout.
  //   activity_trail: compliance audit — cross-namespace delegation writes must
  //     be queryable via delegated_via IS NOT NULL (ADR-0356 §"Audit trail symmetry").
  //   engine_event: triggers tariff-awareness reactions downstream (calc engine,
  //     snapshot-freshness surface per ADR-0354).
  // supplement_rule_added: 3 destinations (no engine_event).
  //   Supplement rules are picked up by the calc engine on next period recalc —
  //   not event-driven. engine_event excluded to avoid false state-machine triggers.
  "cascade.workspace_union_binding_created": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "cascade",
  },
  "cascade.supplement_rule_added": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "cascade",
  },

  // ─── Payroll Tariff Delegation (Phase 7f, ADR-0356, 2026-05-17) ────────────
  // Payroll-layer events — pair with cascade-layer events above for full audit chain.
  // Both layers required per ADR-0356 §"Audit trail symmetry".
  //   payroll.workspace_tariff_setup: 4 destinations — tariff binding is a workspace
  //     lifecycle change with engine_event reactions (calc engine + ADR-0354 snapshot-freshness).
  //   payroll.workspace_tariff_changed: 4 destinations — same rationale as setup;
  //     tariff switch triggers downstream state-machine reactions.
  //   payroll.supplement_override_added: 3 destinations (no engine_event) — mirrors
  //     cascade.supplement_rule_added: calc engine polls on next recalc (not event-driven).
  "payroll.workspace_tariff_setup": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "payroll",
  },
  "payroll.workspace_tariff_changed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "payroll",
  },
  "payroll.supplement_override_added": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "payroll",
  },

  // ─── Payroll Tariff View Events (Phase 7g, 2026-05-17) ─────────────────────
  // Read-path telemetry — posthog + logger only.
  // No activity_trail: view events are not mutations; no compliance audit required.
  // No engine_event: page views do not drive workflow state-machine transitions.
  "payroll.tariff_view_loaded": {
    destinations: ["posthog", "logger"],
    category: "payroll",
  },
  "payroll.tariff_view_loaded_mobile": {
    destinations: ["posthog", "logger"],
    category: "payroll",
  },

  // ─── Day-Line Runtime Events (ADR-0367, BT0-FOUNDATION 2026-05-18) ───────────
  // day_line.created: 4 destinations — D6 production mutation; engine_event triggers
  //   guardian + workflow state-machine reactions.
  // day_line.opening_changed / closing_changed: 3 destinations — operational adjustment;
  //   no state-machine reaction (day_line hours change does not drive workflow transitions).
  // day_line_item.added: 4 destinations — item distribution is a D6 mutation;
  //   engine_event required for session acknowledgement workflow.
  // day_line_item.notified: 4 destinations — notification confirmation drives
  //   acknowledgement workflow state-machine.
  // shift_session.bound: 3 destinations — binding confirmed; no downstream engine_event.
  // shift_session.clocked_in / clocked_out: 4 destinations — payroll-relevant lifecycle
  //   events that drive engine_event reactions (settlement, timebank).
  // routine.attached: 4 destinations — routine attachment is a D6 mutation with
  //   workflow reactions (task materialization).
  // org.dept_areas_updated: 3 destinations — org-structure change (audit + analytics);
  //   no engine_event (area edits do not drive state-machine transitions).
  // shift_session.item_leak_detected: 3 destinations — sentinel/alert; no engine_event.
  "day_line.created": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "day_line.opening_changed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "day_line.closing_changed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "day_line_item.added": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "day_line_item.notified": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "shift_session.bound": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "shift_session.clocked_in": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "shift_session.clocked_out": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "routine.attached": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  // routine.created: 4 destinations — admin C4 act; engine_event for workflow reactions.
  "routine.created": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "routine.created_from_image": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "routine.governance_unassigned": {
    destinations: ["logger", "activity_trail"],
    category: "scheduling",
  },
  // routine.assigned_to_location: 4 destinations — scoping + hook-wiring act.
  "routine.assigned_to_location": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  // procedure_step.added: 3 destinations — authoring act, no state-machine reaction.
  "procedure_step.added": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "org.dept_areas_updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "org_structure",
  },
  "shift_session.item_leak_detected": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },

  // ─── Birthday celebration auto-publish (ADR-0372, 2026-05-18) ──────────────
  // celebration.auto_published: 3 destinations — posthog (adoption analytics),
  //   activity_trail (audit trail for every auto-celebration), logger (stdout).
  //   No engine_event: birthday publish is terminal, no state-machine reaction needed.
  //   channel.message.sent is ALSO emitted per celebration (dual emit per Q8).
  "celebration.auto_published": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "communication",
  },

  // celebration.skipped_workspace_disabled / celebration.skipped_already_published:
  //   activity_trail only — audit trail for idempotency skips and opt-out enforcement.
  //   No posthog: skips are not product-funnel events. No engine_event: no action needed.
  "celebration.skipped_workspace_disabled": {
    destinations: ["activity_trail", "logger"],
    category: "communication",
  },
  "celebration.skipped_already_published": {
    destinations: ["activity_trail", "logger"],
    category: "communication",
  },

  // ─── Join Session Recovery (ADR-0358, 2026-05-18) ────────────────────────
  // Pre-auth events — posthog + logger only.
  // No activity_trail: no workspace or actor identity resolved (pre-auth surface).
  // No engine_event: load-time / submit-time detection; no workflow to advance.
  "join.session_expired_rescued": {
    destinations: ["posthog", "logger"],
    category: "onboarding",
  },
  "join.session_expired_at_submit": {
    destinations: ["posthog", "logger"],
    category: "onboarding",
  },

  // ─── Voice Bootstrap Snapshot (ADR-0297, feat/mobile-voice-bootstrap-pipe 2026-05-20) ──
  // snapshot_sent + snapshot_refreshed: posthog (funnel analytics) + logger + activity_trail
  //   (data-transfer audit). No engine_event — informational, not workflow-driving.
  // snapshot_assembly_failed: posthog + logger + activity_trail (error audit).
  //   No engine_event — not a state-machine input.
  "voice.bootstrap.snapshot_sent": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "voice.bootstrap.snapshot_refreshed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "voice.bootstrap.snapshot_assembly_failed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },

  // ─── Voice Bootstrap Publish (ADR-0297, P3 mobile-voice-runtime-wire 2026-05-20) ──
  // snapshot_published: posthog (mobile bootstrap funnel adoption) + logger + activity_trail
  //   (data-channel publish is a data-transfer event that must be auditable).
  //   No engine_event — informational, not workflow-driving.
  // publish_failed: posthog + logger + activity_trail (error audit for degraded sessions).
  //   No engine_event — not a state-machine input.
  "voice.bootstrap.snapshot_published": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "voice.bootstrap.publish_failed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },

  // ─── Voice Bootstrap RPC (P4 mobile-voice-runtime-wire 2026-05-20, L-0234) ──
  // tool_registered: posthog (adoption funnel) + logger + activity_trail (pipe-live audit).
  // tool_register_failed: posthog + logger + activity_trail (error audit).
  // rpc_completed: posthog (latency funnel) + logger + activity_trail (AI-action audit).
  // rpc_failed: posthog + logger + activity_trail (error audit).
  // None route to engine_event — tool-call round-trips are not workflow state inputs.
  "voice.bootstrap.tool_registered": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "voice.bootstrap.tool_register_failed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "voice.bootstrap.rpc_completed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "voice.bootstrap.rpc_failed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },

  // ─── Mobile AI Surface Events (P2 UI scaffold, feat/mobile-mobile-voice-bootstrap-pipe 2026-05-20) ──
  // fab.long_press: posthog (UX discovery funnel) + logger. No activity_trail — tap events
  //   are not auditable actions, they're interaction signals. No engine_event — not workflow.
  // ai_prefs.changed: posthog (feature adoption) + logger + activity_trail (preference-change
  //   audit). No engine_event — preferences are not workflow-driving.
  // botsson_sheet.opened: posthog (session-start funnel) + logger. No activity_trail — sheet
  //   open is a UI event, not a data-mutation. No engine_event — informational.
  "mobile.fab.long_press": {
    destinations: ["posthog", "logger"],
    category: "agent",
  },
  "mobile.ai_prefs.changed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "mobile.botsson_sheet.opened": {
    destinations: ["posthog", "logger"],
    category: "agent",
  },

  // ─── Mobile Chat Events (P5 mobile-voice-runtime-wire 2026-05-20) ──
  // message_sent: posthog (funnel) + logger + activity_trail (send-audit).
  // response_received: posthog (latency funnel) + logger + activity_trail (AI-action audit).
  // error: posthog + logger + activity_trail (error audit for degraded sessions).
  "mobile.chat.message_sent": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "mobile.chat.response_received": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "mobile.chat.error": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },

  // ─── Mobile Voice UX Events (P6 mobile-voice-runtime-wire 2026-05-20) ──
  // mic_permission_denied: posthog (denial funnel) + logger + activity_trail (security-surface audit).
  // disconnect_recovered: posthog (reliability KPI) + logger. Transient — no activity_trail.
  // disconnect_failed: posthog (reliability KPI) + logger + activity_trail (degraded-session audit).
  // policy_flipped: posthog (governance signal) + logger + activity_trail (workspace policy audit).
  "mobile.voice.mic_permission_denied": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "mobile.voice.disconnect_recovered": {
    destinations: ["posthog", "logger"],
    category: "agent",
  },
  "mobile.voice.disconnect_failed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "mobile.voice.policy_flipped": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "mobile.routine.photo_extracted": {
    destinations: ["posthog", "logger"],
    category: "scheduling",
  },

  // ─── Bulk Import Events (ADR-0401, Sortie A) ────────────────────────────
  // bulk_import.batch_parsed: ONE emit per successful CSV parse (ADR-0287).
  // posthog (import-funnel analytics) + logger (debugging) + activity_trail
  // (workspace-scoped audit for import actions). No engine_event — Sortie A
  // is read-only; no DB write = no workflow state transition.
  "bulk_import.batch_parsed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "bulk_import",
  },

  // ─── Bootstrap Gate Events (ADR-0407, Phase 1) ───────────────────────────
  // bootstrap.gates_listed: read-only audit (activity_trail only — no PostHog/engine_event
  // for list reads per convention). Call-site: listBootstrapGates tool body.
  //
  // bootstrap.gate_closed: full 4-destination routing.
  //   posthog (setup-funnel analytics — track which gates get closed and when),
  //   logger (debugging), activity_trail (workspace audit of setup actions),
  //   engine_event (workflow trigger — coordinator phase 2 reads this to advance
  //   next-gate suggestion).
  // Call-site: closeBootstrapGate tool body (one emit per close).
  //
  // bootstrap.gate_skipped: full 4-destination routing (same rationale).
  //   skip_reason logged to activity_trail for audit compliance.
  // Call-site: skipBootstrapGate tool body (one emit per skip).
  "bootstrap.gates_listed": {
    destinations: ["activity_trail"],
    category: "agent",
  },
  "bootstrap.gate_closed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "agent",
  },
  "bootstrap.gate_skipped": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "agent",
  },

  // ─── Bootstrap Setup Wizard View (axis-12, page-polish) ──────────────────
  // setup.wizard_viewed: 3 destinations — view-emit only, no mutation.
  //   posthog: funnel analytics.
  //   logger: debugging.
  //   activity_trail: audit (owner opened setup).
  //   NO engine_event: view is not a workflow trigger.
  "setup.wizard_viewed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "navigation",
  },

  // ─── InlineConfirmCard HITL Gate Events (ADR-0398, Phase 1) ──────────────
  // All 4 events route to posthog + logger + activity_trail.
  // engine_event EXCLUDED — these are UI telemetry for the HITL gate, NOT
  // workflow triggers. Pattern: channel.message.sent (same 3 destinations).
  // Call-sites: shown + confirmed → T3 (publish-announcement.ts, parallel).
  //             cancelled + edited → T4 (inline-confirm-card-tool.ts, deferred).
  "inline_confirm_card.shown": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "inline_confirm_card.confirmed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "inline_confirm_card.cancelled": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },
  "inline_confirm_card.edited": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "agent",
  },

  // ─── Oppgaver Read-surface (P11 oppgaver-page) ──────────────────────────────
  // View + interaction events for the task board (/dashboard/oppgaver).
  // No engine_event on any: read-path telemetry and UI state transitions do NOT
  // drive downstream workflow state-machine steps.
  // oppgaver.context_pinned: 3 destinations (posthog + logger + activity_trail) —
  //   context pinning is a user-intent signal that represents a deliberate manager
  //   focus choice; worth auditing alongside other manager-readiness surface events.
  //   Mirrors hms.umbrella.viewed / people.training.viewed routing rationale.
  // All others: posthog + logger only — UI view/filter/focus events without
  //   data-mutation or compliance-audit requirements.
  "oppgaver.view_opened": {
    destinations: ["posthog", "logger"],
    category: "oppgaver",
  },
  "oppgaver.view_mode_changed": {
    destinations: ["posthog", "logger"],
    category: "oppgaver",
  },
  "oppgaver.area_filter_changed": {
    destinations: ["posthog", "logger"],
    category: "oppgaver",
  },
  "oppgaver.date_changed": {
    destinations: ["posthog", "logger"],
    category: "oppgaver",
  },
  "oppgaver.task_focused": {
    destinations: ["posthog", "logger"],
    category: "oppgaver",
  },
  "oppgaver.context_pinned": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "oppgaver",
  },
  // oppgaver.task_re_timed: posthog + activity_trail — DnD re-timing is a
  // write-intent mutation (C4 gated) that produces a schedule deviation and
  // must be auditable alongside other manager task-mutation events (no logger
  // since activity_trail already provides the audit record).
  // TODO emit-site added in Wave 1b by TA2 (DnD wiring) — controlled known gap.
  "oppgaver.task_re_timed": {
    destinations: ["posthog", "activity_trail"],
    category: "oppgaver",
  },
  // oppgaver.pulse_now_clicked: posthog + logger — toolbar UI interaction.
  // No write-mutation, no compliance-audit requirement. Mirrors date_changed routing.
  "oppgaver.pulse_now_clicked": {
    destinations: ["posthog", "logger"],
    category: "oppgaver",
  },
  // oppgaver.template_apply_clicked: posthog + logger — toolbar UI interaction.
  // Opens ApplyTemplateModal (no write committed at click-time; modal owns its own mutation).
  "oppgaver.template_apply_clicked": {
    destinations: ["posthog", "logger"],
    category: "oppgaver",
  },
  // oppgaver.location_filter_changed: posthog + logger + activity_trail — manager
  // intent signal (same routing as oppgaver.context_pinned). No engine_event.
  "oppgaver.location_filter_changed": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "oppgaver",
  },
  // oppgaver.close_day_clicked: posthog + logger — intent stub only, no audit
  // requirement until the day-close flow is spec'd (future sortie).
  "oppgaver.close_day_clicked": {
    destinations: ["posthog", "logger"],
    category: "oppgaver",
  },
  // ─── Oversikt (campaign/master-refactor — oversikt-v2 port) ──────────────
  // All events: posthog + logger (nav/view/intent — no DB write).
  "oversikt.viewed": { destinations: ["posthog", "logger"], category: "navigation" },
  "oversikt.budget_empty_state_shown": {
    destinations: ["posthog", "logger"],
    category: "navigation",
  },
  "oversikt.brief_why_toggled": { destinations: ["posthog", "logger"], category: "navigation" },
  "oversikt.brief_action_taken": { destinations: ["posthog", "logger"], category: "navigation" },
  "oversikt.pulse_tile_clicked": { destinations: ["posthog", "logger"], category: "navigation" },
  "oversikt.action_queue_row_clicked": {
    destinations: ["posthog", "logger"],
    category: "navigation",
  },
  "oversikt.action_cta_clicked": { destinations: ["posthog", "logger"], category: "navigation" },
  "oversikt.nav_link_clicked": { destinations: ["posthog", "logger"], category: "navigation" },
  "oversikt.gap_fill_requested": { destinations: ["posthog", "logger"], category: "scheduling" },
  "oversikt.receipt_nudge_sent": {
    destinations: ["posthog", "logger"],
    category: "communication",
  },
  "oversikt.dagsrapport_requested": {
    destinations: ["posthog", "logger"],
    category: "operations",
  },
};
