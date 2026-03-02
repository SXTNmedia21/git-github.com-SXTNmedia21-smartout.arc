// ============================================
// agent-router.ts
// Core routing logic for agent mode conversations.
// Loads context, classifies intent, selects tools, builds prompt,
// and runs the LLM to generate a response.
// Connected to: @smartout/ai (intent-classifier, tool-selector, mr-botsson, vercel-ai)
// Connected to: src/core/authority.ts (workspace authority config)
// Connected to: src/core/memory-manager.ts (conversation memory)
// ============================================

import { generateText, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { classifyIntent } from "@smartout/ai/router/intent-classifier";
import { selectTools } from "@smartout/ai/router/tool-selector";
import { buildBotssonPrompt } from "@smartout/ai/prompts/mr-botsson";
import { toVercelTools } from "@smartout/ai/adapters/vercel-ai";
import { loadAuthorityConfig } from "./authority.js";
import { loadRecentMemories } from "./memory-manager.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { config } from "../config.js";
import type { AgentChatResponse, ConversationTurn } from "../types/agent.js";

const openrouter = createOpenRouter({
  apiKey: config.OPENROUTER_API_KEY,
});

type AgentRouterInput = {
  message: string;
  sessionId: string;
  workspaceId: string;
  profileId: string;
  userId?: string;
  conversationHistory: ConversationTurn[];
};

/**
 * Routes an agent message through the full pipeline:
 * 1. Load profile context, memories, and authority config in parallel
 * 2. Classify intent
 * 3. Select tools based on intent + authority
 * 4. Build Mr. Botsson system prompt
 * 5. Run LLM with tools
 * 6. Return response
 */
export async function routeAgentMessage(input: AgentRouterInput): Promise<AgentChatResponse> {
  const { message, sessionId, workspaceId, profileId, userId, conversationHistory } = input;

  // Step 1: Load context, memories, and authority in parallel
  const [profileContext, memories, authorityConfig] = await Promise.all([
    loadProfileContext(workspaceId, profileId),
    loadRecentMemories(workspaceId, profileId),
    loadAuthorityConfig(workspaceId),
  ]);

  // Step 2: Classify intent
  const contextSummary = buildContextSummary(profileContext);
  const intent = await classifyIntent(message, contextSummary);

  // Step 3: Select tools based on intent + authority
  const selectedTools = selectTools(intent, authorityConfig);

  // Step 4: Build system prompt
  const systemPrompt = buildBotssonPrompt({
    workspaceName: profileContext.workspaceName,
    employeeName: profileContext.employeeName,
    employeeRole: profileContext.role,
    departmentName: profileContext.departmentName,
    teamName: profileContext.teamName,
    teamLeader: profileContext.teamLeader,
    status: profileContext.status,
    readinessScore: profileContext.readinessScore,
    recentMemories: memories.map((m) => m.content),
    toolDescriptions: selectedTools.map((t) => `${t.name}: ${t.description}`),
    language: "no",
  });

  // Build conversation messages for the LLM
  const messages = conversationHistory.map((turn) => ({
    role: turn.role as "user" | "assistant",
    content: turn.content,
  }));
  messages.push({ role: "user", content: message });

  // Step 5: Run LLM with tools
  const toolContext = {
    workspaceId,
    profileId,
    userId,
    sessionId,
    supabaseAdmin,
  };

  const vercelTools = toVercelTools(selectedTools, toolContext);

  const result = await generateText({
    model: openrouter("anthropic/claude-sonnet-4"),
    system: systemPrompt,
    messages,
    tools: vercelTools,
    stopWhen: stepCountIs(5),
  });

  // Step 6: Return response
  return {
    session_id: sessionId,
    response: result.text,
    intent: {
      capability: intent.capability,
      confidence: intent.confidence,
    },
  };
}

// -- Internal helpers --

type ProfileContext = {
  workspaceName: string;
  employeeName: string;
  role: string;
  departmentName: string;
  teamName: string;
  teamLeader: string;
  status: string;
  readinessScore: number | null;
};

/**
 * Loads profile context for the agent prompt.
 * Fetches workspace, profile, department, and team data.
 */
async function loadProfileContext(workspaceId: string, profileId: string): Promise<ProfileContext> {
  const defaults: ProfileContext = {
    workspaceName: "Ukjent arbeidsplass",
    employeeName: "Ansatt",
    role: "ansatt",
    departmentName: "Ukjent avdeling",
    teamName: "Ukjent team",
    teamLeader: "Ukjent",
    status: "active",
    readinessScore: null,
  };

  // Load workspace
  const { data: workspace } = await supabaseAdmin
    .from("workspace")
    .select("name")
    .eq("workspace_id", workspaceId)
    .single();

  if (workspace) {
    defaults.workspaceName = workspace.name;
  }

  // Load profile with department and team
  const { data: profile } = await supabaseAdmin
    .from("profile")
    .select("first_name, last_name, role, status, department_id, team_id")
    .eq("profile_id", profileId)
    .single();

  if (!profile) return defaults;

  defaults.employeeName = `${profile.first_name} ${profile.last_name}`.trim() || "Ansatt";
  defaults.role = profile.role ?? "ansatt";
  defaults.status = profile.status ?? "active";

  // Load department
  if (profile.department_id) {
    const { data: dept } = await supabaseAdmin
      .from("department")
      .select("name")
      .eq("department_id", profile.department_id)
      .single();

    if (dept) {
      defaults.departmentName = dept.name;
    }
  }

  // Load team + leader
  if (profile.team_id) {
    const { data: team } = await supabaseAdmin
      .from("team")
      .select("name, leader_profile_id")
      .eq("team_id", profile.team_id)
      .single();

    if (team) {
      defaults.teamName = team.name;

      if (team.leader_profile_id) {
        const { data: leader } = await supabaseAdmin
          .from("profile")
          .select("first_name, last_name")
          .eq("profile_id", team.leader_profile_id)
          .single();

        if (leader) {
          defaults.teamLeader = `${leader.first_name} ${leader.last_name}`.trim();
        }
      }
    }
  }

  return defaults;
}

/**
 * Builds a short context string for the intent classifier.
 */
function buildContextSummary(ctx: ProfileContext): string {
  return `${ctx.employeeName}, ${ctx.role} i ${ctx.departmentName}, team ${ctx.teamName}. Status: ${ctx.status}.`;
}
