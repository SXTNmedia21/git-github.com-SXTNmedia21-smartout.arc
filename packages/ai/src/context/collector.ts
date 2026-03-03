import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthorityLevel, Situation, ProfileRole } from "../capabilities/types.js";
import { resolvePosture } from "../prompts/posture.js";
import type { AgentContext, AgentProfileData, RelationshipData } from "./types.js";

const DEFAULT_PERSONALITY = {
  formality: 0.5,
  assertiveness: 0.5,
  warmth: 0.7,
  humor: 0.2,
  verbosity: 0.4,
};

const DEFAULT_AGENT_PROFILE: AgentProfileData = {
  id: "",
  displayName: "Mr. Botsson",
  greeting: "Hei! Hva kan jeg hjelpe deg med?",
  language: "no",
  defaultVoice: "mark",
  voiceSpeed: 1.0,
  voiceTemperature: 0.3,
  voiceStability: 0.7,
  personality: DEFAULT_PERSONALITY,
  adaptFlags: { role: true, situation: true, authority: true },
};

const DEFAULT_RELATIONSHIP: RelationshipData = {
  familiarityScore: 0,
  trustScore: 0,
  sentimentScore: 0.5,
  relationshipScore: 0,
  totalConversations: 0,
  lastInteraction: null,
};

export async function collectContext(params: {
  workspaceId: string;
  profileId: string;
  situation: Situation;
  authority: AuthorityLevel;
  supabaseAdmin: SupabaseClient;
}): Promise<AgentContext> {
  const { workspaceId, profileId, situation, authority, supabaseAdmin: sb } = params;

  // Fetch all data in parallel
  const [profileRow, agentProfileRow, relationshipRow, memories, activeShiftRow] =
    await Promise.all([
      sb
        .from("profile")
        .select(
          "id, display_name, role, status, preferred_language, department:department_id(name), team:team_id(name)",
        )
        .eq("id", profileId)
        .single()
        .then((r) => r.data),
      sb
        .from("agent_profile")
        .select("*")
        .eq("workspace_id", workspaceId)
        .single()
        .then((r) => r.data),
      sb
        .from("agent_relationship")
        .select("*")
        .eq("profile_id", profileId)
        .eq("workspace_id", workspaceId)
        .single()
        .then((r) => r.data),
      sb
        .from("engine_memory")
        .select("content, memory_type, scope, importance")
        .eq("workspace_id", workspaceId)
        .or(`profile_id.eq.${profileId},scope.neq.personal`)
        .or("expires_at.is.null,expires_at.gt.now()")
        .order("importance", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10)
        .then((r) => r.data ?? []),
      sb
        .from("schedule_shift")
        .select("start_time, end_time, role, department:department_id(name)")
        .eq("employee_id", profileId)
        .eq("status", "active")
        .limit(1)
        .single()
        .then((r) => r.data),
    ]);

  // Build agent profile
  const agentProfile: AgentProfileData = agentProfileRow
    ? {
        id: agentProfileRow.id,
        displayName: agentProfileRow.display_name,
        greeting: agentProfileRow.greeting,
        language: agentProfileRow.language as "no" | "en" | "sv",
        defaultVoice: agentProfileRow.default_voice,
        voiceSpeed: Number(agentProfileRow.voice_speed),
        voiceTemperature: Number(agentProfileRow.voice_temperature),
        voiceStability: Number(agentProfileRow.voice_stability),
        personality: {
          formality: Number(agentProfileRow.formality),
          assertiveness: Number(agentProfileRow.assertiveness),
          warmth: Number(agentProfileRow.warmth),
          humor: Number(agentProfileRow.humor),
          verbosity: Number(agentProfileRow.verbosity),
        },
        adaptFlags: {
          role: agentProfileRow.adapt_to_role,
          situation: agentProfileRow.adapt_to_situation,
          authority: agentProfileRow.adapt_to_authority,
        },
      }
    : DEFAULT_AGENT_PROFILE;

  // Build relationship
  const relationship: RelationshipData = relationshipRow
    ? {
        familiarityScore: Number(relationshipRow.familiarity_score),
        trustScore: Number(relationshipRow.trust_score),
        sentimentScore: Number(relationshipRow.sentiment_score),
        relationshipScore: Number(relationshipRow.relationship_score),
        totalConversations: relationshipRow.total_conversations,
        lastInteraction: relationshipRow.last_interaction_at,
      }
    : DEFAULT_RELATIONSHIP;

  // Build profile context
  const role = (profileRow?.role ?? "employee") as ProfileRole;
  const profile = {
    id: profileId,
    name: profileRow?.display_name ?? "Ansatt",
    role,
    department: (profileRow?.department as unknown as { name: string } | null)?.name ?? null,
    team: (profileRow?.team as unknown as { name: string } | null)?.name ?? null,
    status: profileRow?.status ?? "active",
    preferredLanguage: profileRow?.preferred_language ?? "no",
  };

  // Resolve posture
  const resolvedPosture = resolvePosture(
    agentProfile.personality,
    role,
    situation,
    authority,
    relationship.relationshipScore,
    agentProfile.adaptFlags,
  );

  // Time context
  const now = new Date();
  const days = ["sondag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lordag"];
  const dayOfWeek = days[now.getDay()] ?? "ukjent";
  const timeStr = `${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  return {
    profile,
    currentTime: timeStr,
    dayOfWeek,
    activeShift: activeShiftRow
      ? {
          start: activeShiftRow.start_time,
          end: activeShiftRow.end_time,
          role: activeShiftRow.role ?? "",
          department: (activeShiftRow.department as unknown as { name: string } | null)?.name ?? "",
        }
      : null,
    relationship,
    relevantMemories: memories.map((m) => ({
      content: m.content,
      type: m.memory_type,
      scope: m.scope,
      importance: Number(m.importance),
    })),
    agentProfile,
    resolvedPosture,
  };
}
