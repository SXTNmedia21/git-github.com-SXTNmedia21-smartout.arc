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
  | "channels";

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
  | "website_spokesperson";

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
  | "generated";

// ─── Auth Module Events ─────────────────────────
export interface AuthSignedUp extends BaseEvent {
  event: "auth signed_up";
  properties: { method: "email" | "google" | "invite_link" };
}

export interface AuthSignedIn extends BaseEvent {
  event: "auth signed_in";
  properties: { method: "email" | "google" };
}

export interface AuthSignedOut extends BaseEvent {
  event: "auth signed_out";
  properties: Record<string, never>;
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
    data: { recipient_email: string };
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
      step_id: string;
      step_index: number;
    };
  };
}

export interface WizardCompleted extends BaseEvent {
  event: "wizard completed";
  properties: {
    data: {
      workspace_id: string;
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
  | ShiftPublished
  | SessionOpened
  | SessionPendingSignoff
  | SessionClosed
  | SessionHookFired
  | SessionTaskCompleted
  | InvitationAccepted
  | ProtocolAssigned
  | ProtocolStepCompleted
  | ProtocolTestSubmitted
  | ProtocolConfirmationSigned
  | ProtocolCompleted
  | ReconciliationSubmitted
  | ReconciliationAdminAction
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
  | HandbookChapterSaved
  | CommunicationSent
  | CommunicationCancelled
  | CommunicationFailed
  | WizardStepCompleted
  | WizardCompleted
  | SeasonCreated
  | SeasonBudgetUpdated
  | DayFactorsUpdated
  | HourFactorsUpdated
  | OperatingHoursUpdated
  | KpiTargetUpdated
  | WorkspaceBudgetUpdated
  | AbsenceCreated
  | AbsenceDeleted
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
  | DayInfoCreated
  | DayInfoUpdated
  | DayInfoDeleted
  | GuardianSignalAcknowledged
  | GuardianSignalDismissed
  | LeaderPulseAnswered
  | LeaderPulseDismissed
  | ConversationCreated
  | MessageSent
  | PayrollSettingsUpdated
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
  | IndustryPackageLoaded
  | HolidayCalendarCreated
  | HolidayCalendarUpdated
  | HolidayCalendarDeleted
  | HolidayEntryCreated
  | HolidayEntryDeleted
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
  | WebsiteSpokespersonTaskOverdue;

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
    destinations: ["posthog", "logger", "engine_event"],
    category: "onboarding",
  },
  "wizard completed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "onboarding",
  },

  "season created": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "operations",
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

  "payroll_settings updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
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
  "holiday_entry deleted": {
    destinations: ["posthog", "logger", "activity_trail"],
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
};
