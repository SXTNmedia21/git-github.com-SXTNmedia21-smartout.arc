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

// Onboarding agent
export { runOnboardingAgent, extractOnboardingIntelligence } from "./agents/onboarding";
export type { AgentInput, AgentResult, ModelMessage } from "./agents/onboarding";
export { runDocsAgent } from "./agents/docs";
export type { DocsKnowledgeDoc, DocsAgentInput, DocsAgentResult } from "./agents/docs";

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
