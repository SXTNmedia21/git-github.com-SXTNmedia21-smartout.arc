// packages/ai/src/router/tool-selector.ts
import type { SmartoutTool } from "../types.js";
import type {
  AgentToolContext,
  AuthorityLevel,
  CapabilityDefinition,
  CapabilityName,
  SessionChannel,
} from "../capabilities/types.js";
import { getCapability, getAllCapabilities } from "../capabilities/registry.js";
import type { IntentResult } from "./intent-classifier.js";

export type AuthorityConfig = Record<string, AuthorityLevel>;

/**
 * Tier a single tool belongs to within its capability definition. Determined
 * by which array of the CapabilityDefinition the tool is listed in.
 *
 * The old `getToolsForAuthority(capability, level)` returned an authority-
 * level-filtered SET of tools for the whole capability — correct only when
 * every tool shared one level. ADR-0195 replaced that with per-tool tier
 * resolution so a capability like `journey` (3× suggest + 1× autonomous)
 * surfaces each tool at its own seeded level.
 */
type ToolTier = "read_only" | "suggest" | "full";

function toolTier(
  capability: CapabilityDefinition,
  tool: SmartoutTool<AgentToolContext>,
): ToolTier {
  const id = (tool as unknown as { name: string }).name;
  if (capability.readOnlyTools.some((t) => (t as unknown as { name: string }).name === id)) {
    return "read_only";
  }
  if (capability.suggestTools?.some((t) => (t as unknown as { name: string }).name === id)) {
    return "suggest";
  }
  return "full";
}

/**
 * Does `level` unlock `tier`?
 *
 *   read_only   → read_only tier only
 *   suggest     → read_only + suggest tier
 *   confirm     → all tiers
 *   autonomous  → all tiers
 *   disabled    → nothing
 */
function tierUnlocked(level: AuthorityLevel, tier: ToolTier): boolean {
  if (level === "disabled") return false;
  if (level === "read_only") return tier === "read_only";
  if (level === "suggest") return tier === "read_only" || tier === "suggest";
  return true; // confirm | autonomous
}

/**
 * Per-tool authority resolution (ADR-0195 / L-0122).
 *
 * Lookup order for each tool:
 *   1. `authorityConfig[tool.capability]` — dotted key (e.g. "journey.run_guided").
 *      This is the ADR-0195 restored path. A capability family like `journey`
 *      seeds 4 per-tool rows with distinct levels; the loader (ADR-0195 fix)
 *      preserves every row under its full key, so the tool-selector can honour
 *      the seeded level PER TOOL instead of collapsing to a single base-key.
 *   2. `authorityConfig[capability.name]` — legacy short key (e.g. "schedule").
 *      For capabilities that still have a single authority level for the whole
 *      group, this is the existing behaviour.
 *   3. `"read_only"` — fail-closed default (ADR-0176).
 *
 * Each tool is then visible iff its tier is unlocked by its resolved level.
 */
function selectToolsForCapability(
  capability: CapabilityDefinition,
  authorityConfig: AuthorityConfig,
  defaultLevel: AuthorityLevel,
): ReadonlyArray<SmartoutTool<AgentToolContext>> {
  const groupLevel: AuthorityLevel = authorityConfig[capability.name] ?? defaultLevel;
  const output: SmartoutTool<AgentToolContext>[] = [];

  for (const tool of capability.tools) {
    const perToolKey = tool.capability;
    const level: AuthorityLevel =
      (perToolKey ? authorityConfig[perToolKey] : undefined) ?? groupLevel;
    const tier = toolTier(capability, tool);
    if (tierUnlocked(level, tier)) {
      output.push(tool);
    }
  }

  return output;
}

export function selectTools(
  intent: IntentResult,
  authorityConfig: AuthorityConfig,
  channel?: SessionChannel,
): ReadonlyArray<SmartoutTool<AgentToolContext>> {
  const defaultLevel: AuthorityLevel = "read_only";

  if (intent.confidence >= 0.7 && intent.capability !== "general") {
    const capability = getCapability(intent.capability as CapabilityName);
    // Intentional fall-through (documented 2026-04-07, ADR-0073 audit):
    // The classifier enum (`intentSchema` in intent-classifier.ts) emits
    // three labels — `knowledge`, `training`, `payroll` — that have no
    // registered capability in `capabilities/registry.ts`. When the model
    // picks one of these, we return [] tools and the agent answers in
    // natural language without tool access. This is INTENT, not a bug:
    //   - knowledge → policy/FAQ lookup, answered from system prompt context
    //   - training  → readiness/protocol questions, answered narratively
    //   - payroll   → salary questions, deliberately tool-less for now
    //                  (no payroll tools exist; would need write access)
    // To convert any of these into a tool-backed capability, register it
    // in `capabilities/registry.ts` and add a `<name>/index.ts` export.
    // See ADR-0073 audit addendum for the council decision rationale.
    //
    // `memory` is now a real capability as of Phase A3 (2026-04-22) —
    // `save_memory` tool, chat-only, gated via gate_action. Retrieval is
    // still handled by the prompt-builder (context/collector.ts), not by
    // tools, so "do you remember…" conversational recall flows through
    // the system prompt rather than tool calls.
    if (!capability) return [];

    // ADR-0078: skip capability if channel is restricted
    if (channel && capability.allowedChannels && !capability.allowedChannels.includes(channel)) {
      return [];
    }

    // ADR-0195: per-tool dotted key lookup — preserves mixed-authority seeds
    // (e.g. journey: 3× suggest + 1× autonomous). Falls back to the legacy
    // short-key for capabilities that still have a single level.
    return selectToolsForCapability(capability, authorityConfig, defaultLevel);
  }

  const allTools: SmartoutTool<AgentToolContext>[] = [];
  for (const capability of getAllCapabilities()) {
    // ADR-0078: skip capabilities restricted to other channels
    if (channel && capability.allowedChannels && !capability.allowedChannels.includes(channel)) {
      continue;
    }

    allTools.push(...selectToolsForCapability(capability, authorityConfig, defaultLevel));
  }
  return allTools;
}
