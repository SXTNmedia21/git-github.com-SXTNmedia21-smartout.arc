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
