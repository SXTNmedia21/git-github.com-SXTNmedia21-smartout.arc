// ─── Base Event Shape ───────────────────────────
export interface BaseEvent {
  workspace_id: string | null;
  actor_id: string; // profile_id representing who performed the action
  timestamp?: string; // ISO 8601; auto-populated if omitted
  correlation_id?: string; // Trace IDs
}

// ─── Routing Metadata ───────────────────────────
export type EventDestination =
  | "posthog"
  | "logger"
  | "activity_trail"
  | "engine_event"
  | "notifications";

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
  | "enrichment";

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
  | "contract"
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
  | "operating_hours"
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
  | "engine_state";

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
  | "sandbox_blocked";

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

export interface PositionAuthorityChanged extends BaseEvent {
  event: "position updated";
  properties: {
    entity: EntityRef;
    changes: { authority_level: { before: string | null; after: string } };
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
export interface ShiftCreated extends BaseEvent {
  event: "shift created";
  properties: {
    entity: EntityRef;
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
    entity: EntityRef;
    changes: Record<string, { before: unknown; after: unknown }>;
  };
}

export interface ShiftDeleted extends BaseEvent {
  event: "shift deleted";
  properties: {
    entity: EntityRef;
    data: {
      assigned_to: string;
      date: string;
      start_time: string;
      end_time: string;
    };
  };
}

// ─── Journey 03 (Sjekke vakter) — PoC events ────
// These events use a FLAT properties shape (entity_type/entity_id at the top
// level) — NOT the nested EntityRef pattern used by ShiftCreated/Updated/Deleted.
// This is intentional and required by the Event Engine: engine-dispatch reads
// `payload.entity_id` directly from the top of the payload to enforce the
// engine_state unique-active dedupe (one journey instance per profile+process).
// engine-event.ts builds payload as `{ ...event.properties }`, so the entity
// keys MUST be flat in `properties`. See spec C2 + Task 0 finding 0.9.
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

// ─── Scheduling: Batch Publish ──────────────────
export interface ShiftPublished extends BaseEvent {
  event: "shift published";
  properties: {
    entity: EntityRef;
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
    entity: EntityRef;
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
    entity: EntityRef;
    data: {
      shift_id: string;
      time_entry_id: string;
      punch_time: string;
      is_adhoc: boolean;
      gps_verified: boolean;
      gps_distance_meters: number | null;
    };
  };
}

export interface ShiftPunchedOut extends BaseEvent {
  event: "shift punched_out";
  properties: {
    entity: EntityRef;
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
    entity: EntityRef;
    data: { shift_id: string; time_entry_id: string };
  };
}

export interface ShiftBreakEnded extends BaseEvent {
  event: "shift break_ended";
  properties: {
    entity: EntityRef;
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
    entity: EntityRef;
    data: { shift_id: string; supplement_rule_id: string; amount: number };
  };
}

export interface ShiftSupplementReviewed extends BaseEvent {
  event: "shift supplement_reviewed";
  properties: {
    entity: EntityRef;
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
    entity: EntityRef;
    data: { shift_id: string; note_id: string };
  };
}

export interface ShiftAdhocCreated extends BaseEvent {
  event: "shift adhoc_created";
  properties: {
    entity: EntityRef;
    data: { shift_id: string; department_id: string; requires_approval: boolean };
  };
}

export interface ShiftAdhocApproved extends BaseEvent {
  event: "shift adhoc_approved";
  properties: {
    entity: EntityRef;
    data: { shift_id: string; approved_by: string };
  };
}

export interface ShiftCallInitiated extends BaseEvent {
  event: "shift call_initiated";
  properties: {
    entity: EntityRef;
    data: { shift_id: string; department_id: string; leaders_on_duty: number };
  };
}

// ─── Scheduling: Lateness Detection ─────────────
export interface ShiftLateDetected extends BaseEvent {
  event: "shift late_detected";
  properties: {
    entity: EntityRef;
    data: { minutes_late: number; threshold: number };
  };
}

export interface ShiftNoShowEscalated extends BaseEvent {
  event: "shift no_show_escalated";
  properties: {
    entity: EntityRef;
    data: { minutes_late: number };
  };
}

// ─── Operations: Session Lifecycle ──────────────
export interface SessionOpened extends BaseEvent {
  event: "session opened";
  properties: {
    data: {
      department_id: string;
      date: string;
    };
  };
}

export interface SessionPendingSignoff extends BaseEvent {
  event: "session pending_signoff";
  properties: {
    data: {
      department_id: string;
      date: string;
    };
  };
}

export interface SessionClosed extends BaseEvent {
  event: "session closed";
  properties: {
    data: {
      department_id: string;
      date: string;
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

export interface SessionTaskCompleted extends BaseEvent {
  event: "session task_completed";
  properties: {
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

export interface ReconciliationAdminAction extends BaseEvent {
  event: "reconciliation admin_action";
  properties: {
    data: {
      reconciliation_id: string;
      action: "approved" | "rejected";
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
    data: { name: string; status: string };
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
    data: { status: "active" };
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
    entity: EntityRef;
    data: { shift_id: string; status: "approved" | "disputed" };
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

export interface ShiftsPublished extends BaseEvent {
  event: "shifts published";
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
    entity: EntityRef;
    data: { role: string; start_time: string; end_time: string };
  };
}

export interface ShiftAssigned extends BaseEvent {
  event: "shift assigned";
  properties: {
    entity: EntityRef;
    data: { employee_id: string };
  };
}

export interface ShiftUnassigned extends BaseEvent {
  event: "shift unassigned";
  properties: {
    entity: EntityRef;
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

// ─── Shift Swap Events ──────────────────────────
// Shift swap workflow: request → accept/reject → approve/reject → execute
// All swap state lives in engine_state.context JSONB (ADR-0067)

export interface ShiftSwapRequested extends BaseEvent {
  event: "shift swap_requested";
  properties: {
    entity: EntityRef;
    data: {
      swap_id: string;
      requester_shift_id: string;
      target_shift_id: string;
      target_profile_id: string;
    };
  };
}

export interface ShiftSwapAccepted extends BaseEvent {
  event: "shift swap_accepted";
  properties: {
    entity: EntityRef;
    data: { swap_id: string };
  };
}

export interface ShiftSwapRejected extends BaseEvent {
  event: "shift swap_rejected";
  properties: {
    entity: EntityRef;
    data: { swap_id: string; rejected_by: string };
  };
}

export interface ShiftSwapApproved extends BaseEvent {
  event: "shift swap_approved";
  properties: {
    entity: EntityRef;
    data: { swap_id: string };
  };
}

export interface ShiftSwapExecuted extends BaseEvent {
  event: "shift swap_executed";
  properties: {
    entity: EntityRef;
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
  event: "shift swap_cancelled";
  properties: {
    entity: EntityRef;
    data: { swap_id: string };
  };
}

// ─── The Single Truth Union ─────────────────────
// Add every feature's events here. If it isn't here, it can't be emitted.
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
  | SessionOpened
  | SessionPendingSignoff
  | SessionClosed
  | SessionHookFired
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
  | ReconciliationAdminAction
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
  | SeasonArchived
  | SeasonUpdated
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
  | TemplateLoaded
  | TemplateApplied
  | ShiftsPublished
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
  | PositionAuthorityChanged
  | LegalFunctionAssigned
  | ProfileAccessGranted
  | ProfileAccessRevoked
  | ProfileRoleUpdated
  | ProfileDepartmentUpdated
  | ProfileStatusUpdated
  | ProfileDeactivated
  | ProfileReactivated
  | InvitationCancelled
  | InvitationResent
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
  | CommunicationBroadcastSent
  | AuthOtpSent
  | AuthOtpVerified
  | AuthOtpFailed
  | AuthLoggedIn
  | SecurityRateLimited
  | SecurityLockoutTriggered
  | SecuritySandboxBlocked
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
  | ShiftSwapCancelled;

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
  "session hook_fired": {
    destinations: ["logger", "engine_event"],
    category: "operations",
  },
  "session task_completed": {
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
  "reconciliation admin_action": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
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
    destinations: ["posthog", "logger", "activity_trail", "notifications"],
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
  "season activated": {
    destinations: ["posthog", "logger", "activity_trail"],
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
  "template loaded": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "template applied": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "shifts published": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
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
    destinations: ["posthog", "activity_trail", "engine_event", "notifications"],
    category: "system",
  },
  "website spokesperson_approved": {
    destinations: ["posthog", "activity_trail", "engine_event", "notifications"],
    category: "system",
  },
  "website spokesperson_declined": {
    destinations: ["posthog", "activity_trail", "engine_event", "notifications"],
    category: "system",
  },
  "website spokesperson_content_submitted": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "system",
  },
  "website spokesperson_task_overdue": {
    destinations: ["activity_trail", "engine_event", "notifications"],
    category: "system",
  },
  "website spokesperson_revoked": {
    destinations: ["posthog", "activity_trail", "engine_event", "notifications"],
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
  "communication.broadcast_sent": {
    destinations: ["activity_trail", "posthog"],
    category: "communication",
  },
  // ─── Auth OTP ─────────────────────────────────
  "auth otp_sent": { destinations: ["posthog", "logger"], category: "auth" },
  "auth otp_verified": { destinations: ["posthog", "logger"], category: "auth" },
  "auth otp_failed": { destinations: ["posthog", "logger"], category: "auth" },
  "auth logged_in": { destinations: ["posthog", "logger"], category: "auth" },
  // ─── Security ─────────────────────────────────
  "security rate_limited": { destinations: ["logger", "activity_trail"], category: "security" },
  "security lockout_triggered": {
    destinations: ["logger", "activity_trail"],
    category: "security",
  },
  "security sandbox_blocked": { destinations: ["logger", "activity_trail"], category: "security" },
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
  "shift swap_requested": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "shift swap_accepted": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "shift swap_rejected": {
    destinations: ["posthog", "activity_trail"],
    category: "scheduling",
  },
  "shift swap_approved": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "shift swap_executed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "shift swap_cancelled": {
    destinations: ["posthog", "activity_trail"],
    category: "scheduling",
  },
};
