"use client";

// ============================================
// useHelpVoiceFallback.ts
// Registers a voice fallback tool for KB queries on the Help page.
// Why: Ultravox (Runtime B) has no capability registry binding for `kb_query`,
// so voice cannot answer handbook/policy/procedure questions. This tool intercepts
// the intent and instructs the agent to redirect the user to chat instead.
// ============================================

import { useMemo } from "react";
import type { ClientToolKit, ClientToolDefinition, ClientToolImplementation } from "@smartout/agent-sdk";

/* ━━━ Tool definition ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const kbQueryFallbackDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "kb_query_voice_fallback",
    description:
      "Call this tool when the user asks about handbook content, policies, procedures, " +
      "rules, routines, or any knowledge base question via voice. " +
      "This capability is only available in chat — voice cannot answer KB queries. " +
      "After calling this tool, speak the returned message verbatim.",
    dynamicParameters: [],
    client: {},
  },
};

/* ━━━ Tool implementation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const kbQueryFallbackImpl: ClientToolImplementation = () => {
  return (
    "Det spørsmålet svarer jeg på i chat — vil du bytte over? " +
    "Klikk på Botsson-orben nederst til høyre."
  );
};

/* ━━━ Stable empty kit — avoids new object per render ━━ */

const HELP_VOICE_KIT: ClientToolKit = {
  definitions: [kbQueryFallbackDef],
  implementations: {
    kb_query_voice_fallback: kbQueryFallbackImpl,
  },
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Returns the help module's voice tool kit for registration.
 * Kit is module-level stable — useMemo ensures no re-registration on re-render.
 */
export function useHelpVoiceFallbackKit(): ClientToolKit {
  // Kit is defined at module scope (no closures over changing values),
  // so useMemo with [] always returns the same reference.
  return useMemo(() => HELP_VOICE_KIT, []);
}
