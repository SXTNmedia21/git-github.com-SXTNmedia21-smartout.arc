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

// Agents — import via subpath: @smartout/ai/agents/onboarding, @smartout/ai/agents/docs, @smartout/ai/agents/contract
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
