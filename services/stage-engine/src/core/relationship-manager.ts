import { supabaseAdmin } from "../lib/supabase.js";

export type Relationship = {
  familiarityScore: number;
  trustScore: number;
  sentimentScore: number;
  relationshipScore: number;
  totalConversations: number;
  lastInteraction: string | null;
};

/**
 * Loads or creates the relationship between agent and profile.
 */
export async function loadRelationship(
  workspaceId: string,
  profileId: string,
): Promise<Relationship> {
  // First get agent_profile for this workspace
  const { data: agentProfile } = await supabaseAdmin
    .from("agent_profile")
    .select("id")
    .eq("workspace_id", workspaceId)
    .single();

  if (!agentProfile) {
    return {
      familiarityScore: 0,
      trustScore: 0,
      sentimentScore: 0.5,
      relationshipScore: 0,
      totalConversations: 0,
      lastInteraction: null,
    };
  }

  const { data: rel } = await supabaseAdmin
    .from("agent_relationship")
    .select("*")
    .eq("agent_profile_id", agentProfile.id)
    .eq("profile_id", profileId)
    .single();

  if (!rel) {
    // Auto-create relationship on first interaction
    await supabaseAdmin
      .from("agent_relationship")
      .insert({
        workspace_id: workspaceId,
        agent_profile_id: agentProfile.id,
        profile_id: profileId,
      })
      .select()
      .single();

    return {
      familiarityScore: 0,
      trustScore: 0,
      sentimentScore: 0.5,
      relationshipScore: 0,
      totalConversations: 0,
      lastInteraction: null,
    };
  }

  return {
    familiarityScore: Number(rel.familiarity_score),
    trustScore: Number(rel.trust_score),
    sentimentScore: Number(rel.sentiment_score),
    relationshipScore: Number(rel.relationship_score),
    totalConversations: rel.total_conversations,
    lastInteraction: rel.last_interaction_at,
  };
}

/**
 * Updates relationship after a session ends.
 * Increments conversation count, updates familiarity, and recomputes composite.
 */
export async function updateRelationshipAfterSession(
  workspaceId: string,
  profileId: string,
  sessionMinutes: number,
  sentiment: "positive" | "neutral" | "negative",
): Promise<void> {
  const { data: agentProfile } = await supabaseAdmin
    .from("agent_profile")
    .select("id")
    .eq("workspace_id", workspaceId)
    .single();

  if (!agentProfile) return;

  const { data: rel } = await supabaseAdmin
    .from("agent_relationship")
    .select("*")
    .eq("agent_profile_id", agentProfile.id)
    .eq("profile_id", profileId)
    .single();

  if (!rel) return;

  const newConversations = rel.total_conversations + 1;
  const newMinutes = Number(rel.total_minutes) + sessionMinutes;

  // Familiarity: logarithmic growth, caps at 1.0
  const familiarity = Math.min(1.0, Math.log10(newConversations + 1) / Math.log10(50));

  // Sentiment update
  const posCount = rel.positive_count + (sentiment === "positive" ? 1 : 0);
  const neuCount = rel.neutral_count + (sentiment === "neutral" ? 1 : 0);
  const negCount = rel.negative_count + (sentiment === "negative" ? 1 : 0);
  const total = posCount + neuCount + negCount;
  const sentimentScore = total > 0 ? (posCount + neuCount * 0.5) / total : 0.5;

  // Composite: 0.3 familiarity + 0.4 trust + 0.3 sentiment
  const composite = 0.3 * familiarity + 0.4 * Number(rel.trust_score) + 0.3 * sentimentScore;

  await supabaseAdmin
    .from("agent_relationship")
    .update({
      total_conversations: newConversations,
      total_minutes: newMinutes,
      last_interaction_at: new Date().toISOString(),
      familiarity_score: familiarity,
      positive_count: posCount,
      neutral_count: neuCount,
      negative_count: negCount,
      sentiment_score: sentimentScore,
      relationship_score: Math.min(1.0, composite),
      updated_at: new Date().toISOString(),
    })
    .eq("id", rel.id);
}
