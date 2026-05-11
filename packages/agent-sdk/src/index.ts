// Types
export type {
  AgentStatus,
  AgentConfig,
  AgentSession,
  AgentChannel,
  TranscriptEntry,
  DebugEntry,
  DebugEntryType,
  ClientTool,
  ClientToolKit,
  ClientToolDefinition,
  ClientToolParameter,
  ClientToolImplementation,
  VoiceProvider,
  VoiceSession,
  VoiceSessionEvent,
  VoiceSessionEventHandler,
} from "./types";

// Hooks
export { useAgent } from "./hooks/useAgent";
export { useAgentChat } from "./hooks/useAgentChat";
export type { AgentChatConfig, AgentChatSession } from "./hooks/useAgentChat";

// Providers
export { createLiveKitProvider } from "./providers/livekit";

// Tools
export { buildToolKit, createToolRegistry } from "./tools/registry";
export type { ToolRegistry } from "./tools/registry";
export { createOnboardingTools } from "./tools/onboarding";
export type { OnboardingActions } from "./tools/onboarding";
export { createDashboardTools } from "./tools/dashboard";
export type { DashboardActions } from "./tools/dashboard";

// Context
export { buildSessionRequest } from "./context/session-context";
export type { SessionIdentity } from "./context/session-context";

// Components
export { AgentAvatar } from "./components/AgentAvatar";
export type { AgentAvatarProps } from "./components/AgentAvatar";
export { AgentChatPanel } from "./components/AgentChatPanel";
export type { AgentChatPanelProps } from "./components/AgentChatPanel";
