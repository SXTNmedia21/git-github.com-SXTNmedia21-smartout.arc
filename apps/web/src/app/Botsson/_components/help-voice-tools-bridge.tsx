"use client";

// ============================================
// help-voice-tools-bridge.tsx
// Registers the help module's voice fallback tool with Botsson's dynamic registry.
// Why: when the user asks a KB/handbook question via voice (Runtime B / Ultravox),
// Emma has no capability to answer — this bridge registers kb_query_voice_fallback
// so Emma redirects the user to chat instead of returning an empty answer.
// ============================================

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useHelpVoiceFallbackKit } from "@/app/dashboard/help/_hooks/useHelpVoiceFallback";

export function HelpVoiceToolsBridge() {
  const kit = useHelpVoiceFallbackKit();
  useRegisterTools("help", kit);
  return null;
}
