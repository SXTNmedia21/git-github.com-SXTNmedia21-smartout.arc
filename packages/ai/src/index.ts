// packages/ai/src/index.ts

// Core type system
export type { SmartoutTool } from "./types";
export { defineTool } from "./types";

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

// Doc retrieval tools (RAG)
export { DOC_TOOLS, searchPlatformDocs, getDocByPath } from "./tools/docs";
export type { DocToolContext } from "./tools/docs";

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
} from "./missions";
export type { MissionId, AgentMission, StartCallOptions, CallResult } from "./missions";
