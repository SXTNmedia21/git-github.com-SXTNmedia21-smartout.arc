// ─── Base Event Shape ───────────────────────────
export interface BaseEvent {
  workspace_id: string | null;
  actor_id: string; // profile_id representing who performed the action
  timestamp?: string; // ISO 8601; auto-populated if omitted
  correlation_id?: string; // Trace IDs
}

// ─── Routing Metadata ───────────────────────────
export type EventDestination = "posthog" | "logger" | "activity_trail" | "engine_event";

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
  | "navigation";

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
  | "authority_config";

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
  | "auto_filled";

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
  | AuthorityConfigUpdated
  | OnboardingGuideUpdated
  | IndustryPackageLoaded
  | PageViewed
  | ButtonClicked;

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
    destinations: ["posthog", "logger", "activity_trail"],
    category: "operations",
  },
  "day_factors updated": {
    destinations: ["posthog", "logger", "activity_trail"],
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

  "page viewed": { destinations: ["posthog"], category: "navigation" },
  "button clicked": { destinations: ["posthog"], category: "navigation" },
};
