// packages/ai/src/capabilities/journey-authoring/index.ts
//
// Journey Authoring capability (ADR-0226).
//
// Migrates the standalone journey-wizard agent into the canonical
// stage-engine capability pattern. Three tools cover the 6-phase wizard
// (Discovery → Classification → Steps → Testing → Documentation → Review):
//
//   - save_draft       (suggestTool  — persists wizard_session draft via gatedMutation)
//   - check_duplicates (readOnlyTool — duplicate detection, no mutation)
//   - lookup_journeys  (readOnlyTool — journey search, no mutation)
//
// Authority posture (ADR-0226 §seed):
//   - read_only  → check_duplicates + lookup_journeys (readOnlyTools)
//   - suggest    → read_only tools + save_draft (suggestTools)
//   - confirm    → all tools
//   - autonomous → all tools
//
// chat-only surface (ADR-0078): journey spec-authoring is never a voice
// flow. No PII is written here, but the wizard is a long-form structured
// creation flow that requires precise multi-turn context that voice cannot
// provide reliably.
//
// toolAuthPattern: "direct_admin" — wizard sessions are godmode-only.
// The stage-engine BFF route resolves super-admin context before dispatch.
//
// Binding ADRs: 0078 (chat-only), 0134 (actor_id non-null), 0204 (gatedMutation),
//               0226 (migration spec)

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { saveDraftTool, checkDuplicatesTool, lookupJourneysTool } from "./tools.js";

// SmartoutTool is invariant on TSchema (schema property + z.infer in execute),
// so defineTool's inferred ZodObject doesn't widen to ZodType automatically.
// Cast through unknown to erase the specific schema type for the registry.
// This is the same pattern used by profile/index.ts and journey/index.ts.
const readOnlyTools = [checkDuplicatesTool, lookupJourneysTool] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

const suggestTools = [saveDraftTool] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// All 3 tools — readOnly + suggest.
const tools = [saveDraftTool, checkDuplicatesTool, lookupJourneysTool] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const journeyAuthoringCapability: CapabilityDefinition = {
  name: "journey_authoring",
  description:
    "Author new Smartout journeys via 6-phase wizard (Discovery → Classification → Steps → Testing → Documentation → Review). Persists draft to wizard_session table.",
  // ADR-0078 — authoring is chat-only. Voice is not a viable surface for
  // long-form structured spec creation requiring precise multi-turn context.
  allowedChannels: ["chat"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "journey_authoring",
  defaultAuthority: "read_only",
  tools,
  readOnlyTools,
  suggestTools,
};

export { saveDraftTool, checkDuplicatesTool, lookupJourneysTool };
