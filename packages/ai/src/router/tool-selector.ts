// packages/ai/src/router/tool-selector.ts
import type { SmartoutTool } from "../types.js";
import type {
  AgentToolContext,
  AuthorityLevel,
  CapabilityDefinition,
  CapabilityName,
} from "../capabilities/types.js";
import { getCapability, getAllCapabilities } from "../capabilities/registry.js";
import type { IntentResult } from "./intent-classifier.js";

export type AuthorityConfig = Record<string, AuthorityLevel>;

function getToolsForAuthority(
  capability: CapabilityDefinition,
  level: AuthorityLevel,
): ReadonlyArray<SmartoutTool<AgentToolContext>> {
  switch (level) {
    case "disabled":
      return [];
    case "read_only":
      return capability.readOnlyTools;
    case "suggest":
      return [...capability.readOnlyTools, ...(capability.suggestTools ?? [])];
    case "confirm":
    case "autonomous":
      return capability.tools;
  }
}

export function selectTools(
  intent: IntentResult,
  authorityConfig: AuthorityConfig,
): ReadonlyArray<SmartoutTool<AgentToolContext>> {
  const defaultLevel: AuthorityLevel = "read_only";

  if (intent.confidence >= 0.7 && intent.capability !== "general") {
    const capability = getCapability(intent.capability as CapabilityName);
    // Intentional fall-through (documented 2026-04-07, ADR-0073 audit):
    // The classifier enum (`intentSchema` in intent-classifier.ts) emits
    // four labels — `knowledge`, `training`, `memory`, `payroll` — that
    // have no registered capability in `capabilities/registry.ts`. When
    // the model picks one of these, we return [] tools and the agent
    // answers in natural language without tool access. This is INTENT,
    // not a bug:
    //   - knowledge → policy/FAQ lookup, answered from system prompt context
    //   - training  → readiness/protocol questions, answered narratively
    //   - memory    → "do you remember..." conversational recall
    //   - payroll   → salary questions, deliberately tool-less for now
    //                  (no payroll tools exist; would need write access)
    // To convert any of these into a tool-backed capability, register it
    // in `capabilities/registry.ts` and add a `<name>/index.ts` export.
    // See ADR-0073 audit addendum for the council decision rationale.
    if (!capability) return [];

    const level = authorityConfig[capability.name] ?? defaultLevel;
    return getToolsForAuthority(capability, level);
  }

  const allTools: SmartoutTool<AgentToolContext>[] = [];
  for (const capability of getAllCapabilities()) {
    const level = authorityConfig[capability.name] ?? defaultLevel;
    const tools = getToolsForAuthority(capability, level);
    allTools.push(...tools);
  }
  return allTools;
}
