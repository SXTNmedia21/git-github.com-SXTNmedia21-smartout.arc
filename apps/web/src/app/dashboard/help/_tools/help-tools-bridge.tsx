"use client";

/**
 * help-tools-bridge.tsx — harness tool registration for /dashboard/help
 *
 * Thin-shell registration: the help route declares ownership of the "help"
 * harness scope without registering phantom tools.
 *
 * L-0287 documented thin-shell: empty tools array intentional — registration
 * declares route ownership without phantom tools. Actual Botsson tool bridges
 * (voice fallback, tour, takeover) live in:
 *   apps/web/src/app/Botsson/_components/help-voice-tools-bridge.tsx
 *   apps/web/src/app/Botsson/_components/help-tour-tools-bridge.tsx
 *   apps/web/src/app/Botsson/_components/help-takeover-tools-bridge.tsx
 *
 * ADR-0238: /dashboard/help owns_chat_surface=true (per site-map.json).
 * BotssonShell defers to the page-embedded chat hero (Tier 1 BotssonChatHero).
 * This bridge does NOT duplicate that registration — scope guard only.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";

export function HelpToolsBridge() {
  // L-0287 documented thin-shell: empty tools array intentional, registration
  // declares route ownership without phantom tools.
  useRegisterTools("help", []);
  return null;
}
