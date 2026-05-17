// packages/ai/src/capabilities/cascade/index.ts
//
// Cascade delegation capability — cross-namespace write surface (ADR-0356).
//
// Two delegation tools. Both are write-only (no readOnlyTools, no suggestTools):
//   - bind_workspace_union  (autonomous — caller already gated per ADR-0356 §"Gate convention")
//   - add_supplement_rule   (autonomous — caller already gated per ADR-0356 §"Gate convention")
//
// defaultAuthority rationale (ADR-0356 §"Gate convention"):
//   These tools assume the CALLER capability has already fired its own gate_action.
//   The cascade gate is a SECOND, INDEPENDENT authority check scoped to the cascade
//   namespace — not a rubber stamp. 'autonomous' here means: when the cascade gate
//   evaluates and approves, execution proceeds without a second UI confirm loop.
//   "Autonomous" != "unguarded" — both the caller gate AND the cascade gate must
//   approve before any write occurs.
//
// Authority rows seeded in migration 20260618200000_cascade_capability_authority_seed.sql.
//
// Binding ADRs: 0078 (chat-only), 0134 (actor_id non-null), 0173 (frozen-4 boundaries),
//               0204 (gatedMutation), 0240 (delegation precedent), 0356 (this pattern)

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { bindWorkspaceUnionTool, addSupplementRuleTool } from "./tools.js";

// Explicit empty array: all cascade delegation tools are writes (mutations).
// None are safe at read_only authority — they all modify shared cascade state.
const readOnlyTools = [] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// No suggestTools: these delegation tools are fired programmatically by the
// calling capability (payroll), not surfaced in the UI for manual suggestion.
const suggestTools = [] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const tools = [bindWorkspaceUnionTool, addSupplementRuleTool] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const cascadeCapability: CapabilityDefinition = {
  name: "cascade",
  description:
    "Cascade-namespace delegation tools — cross-namespace write surface per ADR-0356 + ADR-0173 frozen-4. " +
    "Provides bind_workspace_union (writes workspace_union_binding) and add_supplement_rule " +
    "(writes supplement_rule). Called by payroll capability tools; never invoked directly by users. " +
    "Both gates fire: caller gate + cascade delegation gate (independent authority, ADR-0356 §'Gate convention').",
  // ADR-0078 — payroll-adjacent PII + admin-level workspace configuration.
  // Voice is forbidden: binding decisions are documented admin acts, not voice commands.
  allowedChannels: ["chat"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "cascade",
  // Rationale: delegation tools assume caller already passed its own gate per
  // ADR-0356. The cascade gate here is an independent defense, not a double-confirm.
  // 'autonomous' so the delegation write executes without a UI confirm round-trip.
  defaultAuthority: "autonomous",
  tools,
  readOnlyTools,
  suggestTools,
};

export { bindWorkspaceUnionTool, addSupplementRuleTool };
