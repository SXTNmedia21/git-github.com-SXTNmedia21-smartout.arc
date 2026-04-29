// @smartout/botsson-sdk — LiveKit-native agent harness for Mr. Botsson.
//
// Primary export: useBotsson() hook — fuses LiveKit voice + Smartout chat.
// Secondary exports: lower-level primitives for custom compositions.
//
// NOTE: This package requires an active Next.js BFF context (cookie auth).
// For mobile (React Native), route through /api/emma/chat with Bearer auth
// per ADR-0132. Mobile LiveKit voice is not yet wired (Phase C1 / ADR-0135).

// ── Headline hook ──────────────────────────────────────────────────────────
export { useBotsson } from "./hooks/useBotsson";
export type { BotssonSession } from "./hooks/useBotsson";

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  BotssonAgentConfig,
  BotssonStatus,
  BotssonMode,
  BotssonActivityEvent,
  ActivityConnected,
  ActivityToolCall,
  ActivityToolResponse,
  ActivityIntent,
  ChatTurn,
  ChatReply,
  ChatIntent,
  LiveKitTokenResponse,
} from "./types";

// ── Chat client (framework-agnostic) ──────────────────────────────────────
export { createChatClient, chatClient } from "./clients/chat";
export type { AskSmartoutParams, ChatClientConfig } from "./clients/chat";

// ── LiveKit voice session (advanced / custom compositions) ─────────────────
export { LiveKitVoiceSession } from "./providers/livekit-voice";
export type { LiveKitVoiceSessionEvents } from "./providers/livekit-voice";

// ── Token helper ───────────────────────────────────────────────────────────
export { mintLiveKitToken } from "./context/token";
export type { TokenRequestParams } from "./context/token";
