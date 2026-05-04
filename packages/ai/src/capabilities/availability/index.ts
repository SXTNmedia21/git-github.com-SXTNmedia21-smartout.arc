// packages/ai/src/capabilities/availability/index.ts
//
// availability capability — D2 source-data per ADR-0200 (three-table model).
//
// Three tools:
//   - set_own_availability        (voice-OK per ADR-0202, gated autonomous/employee)
//   - clear_own_availability      (voice-OK per ADR-0202, gated autonomous/employee)
//   - query_others_availability   (chat-only per ADR-0202, gated read_only/employee)
//
// Authority rows seeded in migration 20260518200002_seed_availability_authority.sql
// (Task H). tool-selector.ts maps authority level → which tools the agent sees:
//   - read_only  → readOnlyTools   (query_others only)
//   - suggest    → readOnlyTools + suggestTools (all three — set_own/clear_own at suggest tier surface)
//   - confirm    → all tools
//   - autonomous → all tools (seeded default for set_own + clear_own)
//
// allowedChannels is the UNION of the per-tool channels. Per-tool voice policy
// is enforced inside each tool's execute() (inline channel guards) so that
// query_others can still hide even when the capability is loaded into a voice
// session. This matches the ADR-0202 split (set_own voice-OK, query_others
// chat-only) and matches the ADR-0078 defence-in-depth pattern (L-0097).
//
// Binding ADRs: 0200 (three-table model), 0201 (gate_action mandatory),
//               0202 (voice policy split), 0078 (chat-only class),
//               0099 (unified authority gate), 0176 (C4 authority seed),
//               0134 (actor_id non-null).

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { setOwnAvailability, clearOwnAvailability, queryOthersAvailability } from "./tools.js";

const allTools = [
  setOwnAvailability,
  clearOwnAvailability,
  queryOthersAvailability,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// query_others is the only read-only tool: no DB mutation, and the
// authority seed default is 'read_only'.
const readOnlyTools = [queryOthersAvailability] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

// set_own + clear_own are suggestible mutations. Their seeded default is
// 'autonomous', so at that level the tool-selector pulls them from `tools`.
// They appear in suggestTools so workspaces that downgrade to 'suggest' still
// see the UI-confirm flow surface them.
const suggestTools = [setOwnAvailability, clearOwnAvailability] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const availabilityCapability: CapabilityDefinition = {
  name: "availability",
  description:
    "Employee availability authoring + query — set/clear own availability preferences (voice-OK), query colleagues' availability within a window (chat-only).",
  // UNION of per-tool channels. set_own + clear_own permit voice; query_others
  // is chat-only but blocks at tool-level too (defence-in-depth, L-0097).
  allowedChannels: ["chat", "voice"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "availability",
  defaultAuthority: "read_only",
  tools: allTools,
  readOnlyTools,
  suggestTools,
};

export { setOwnAvailability, clearOwnAvailability, queryOthersAvailability };
