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
