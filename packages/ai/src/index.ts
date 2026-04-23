// packages/ai/src/index.ts

// Core type system
export type { SmartoutTool } from "./types";
export { defineTool } from "./types";

// Cross-tool helpers. Added Phase 3.4 of Billing Engine Fase 1 — any
// billing-tool or cross-tenant helper that needs workspace → company
// resolution uses this.
export { resolveCompanyId } from "./lib/resolveCompanyId";

// Session memory
export { SessionContext } from "./session-context";

// Onboarding schemas
export { OnboardingIntelligenceSchema } from "./schemas/onboarding";
export type { OnboardingIntelligence } from "./schemas/onboarding";

// Onboarding tools
export { ONBOARDING_TOOLS } from "./tools/onboarding";

// Contract tools
export { CONTRACT_TOOLS } from "./tools/contract";
export type { EditorAction, ContractEditorState, ContractToolContext } from "./tools/contract";

// Report tools
export { REPORT_TOOLS } from "./tools/report";
export type { ReportConfig, ReportToolContext } from "./tools/report";

// Intelligence tools
export { INTELLIGENCE_TOOLS } from "./tools/intelligence";
export type { IntelligenceToolContext } from "./tools/intelligence";

// Journey tools
export { JOURNEY_TOOLS } from "./tools/journey";
export type { JourneyToolContext } from "./tools/journey";

// Schedule tools (Ultravox client tool definitions)
export {
  SCHEDULE_TOOL_DEFINITIONS,
  SCHEDULE_READ_TOOLS,
  SCHEDULE_WRITE_TOOLS,
  SCHEDULE_NAV_TOOLS,
  SCHEDULE_TOOL_NAMES,
} from "./tools/schedule";
export type { ScheduleClientToolDefinition } from "./tools/schedule";

// Season tools — canonical surface is seasonCapability (see capabilities/season).
// Barrel retained for backward compatibility with non-agent consumers.
export { SEASON_TOOLS } from "./tools/season";
// Season agent capability (ADR-0201 — M3.2)
export { seasonCapability } from "./capabilities/season";

// Doc retrieval tools (RAG)
export { DOC_TOOLS, searchPlatformDocs, getDocByPath } from "./tools/docs";
export type { DocToolContext } from "./tools/docs";

// Workspace doc retrieval tools (RAG)
export { WORKSPACE_DOC_TOOLS, searchWorkspaceDocs } from "./tools/workspace-docs";
export type { WorkspaceDocToolContext } from "./tools/workspace-docs";

// Embedding
export { getQueryEmbedding } from "./embedding";

// Journey output generators
export {
  generateE2ETest,
  generateOnboardingDoc,
  generateLinearSpec,
  generateBotssonScript,
} from "./generators";

// Agents — import via subpath: @smartout/ai/agents/onboarding, @smartout/ai/agents/docs, @smartout/ai/agents/contract, @smartout/ai/agents/reports
// (not re-exported from barrel to avoid pulling heavy deps into unrelated routes)

// Missions (Ultravox agent configurations)
export {
  MISSIONS,
  getMission,
  listMissions,
  getMissionIds,
  startMissionCall,
  MissionIdSchema,
  SEASON_LIFECYCLE_MISSION_ID,
} from "./missions";
export type { MissionId, AgentMission, StartCallOptions, CallResult } from "./missions";
