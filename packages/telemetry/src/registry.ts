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
  | "contract";

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
  | "task_completed";

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

  "page viewed": { destinations: ["posthog"], category: "navigation" },
  "button clicked": { destinations: ["posthog"], category: "navigation" },
};
