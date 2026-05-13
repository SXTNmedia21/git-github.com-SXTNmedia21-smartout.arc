import type {
  Personality,
  ResolvedPosture,
  PostureAdaptFlags,
  ProfileRole,
} from "../capabilities/types.js";

export type AgentProfileData = {
  id: string;
  displayName: string;
  greeting: string;
  language: "no" | "en" | "sv";
  defaultVoice: string;
  voiceSpeed: number;
  voiceTemperature: number;
  voiceStability: number;
  personality: Personality;
  adaptFlags: PostureAdaptFlags;
};

export type RelationshipData = {
  familiarityScore: number;
  trustScore: number;
  sentimentScore: number;
  relationshipScore: number;
  totalConversations: number;
  lastInteraction: string | null;
};

/**
 * Summary shape for a single personal_task row fetched during context collection.
 * ADR-0298 R7: active tasks are injected into the system prompt as <active_tasks>.
 */
export type PersonalTaskSummary = {
  id: string;
  title: string;
  due_at: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open";
};

export type AgentContext = {
  // Who
  profile: {
    id: string;
    name: string;
    role: ProfileRole;
    department: string | null;
    team: string | null;
    status: string;
    preferredLanguage: string;
  };

  // When
  currentTime: string;
  dayOfWeek: string;
  activeShift: {
    start: string;
    end: string;
    role: string;
    department: string;
  } | null;

  // Relationship
  relationship: RelationshipData;

  // Memory
  relevantMemories: {
    content: string;
    type: string;
    scope: string;
    importance: number;
  }[];

  // Agent identity
  agentProfile: AgentProfileData;

  // Resolved posture
  resolvedPosture: ResolvedPosture;

  // Prior onboarding data (from completed Lise sessions)
  priorOnboarding?: {
    collected_data: Record<string, unknown>;
    completed_at: string;
    created_at: string;
  };

  // ADR-0298 R7: open personal tasks fetched at context-collection time.
  // Always present (empty array when none). Injected as <active_tasks> in system prompt.
  personalTasks: PersonalTaskSummary[];
};
