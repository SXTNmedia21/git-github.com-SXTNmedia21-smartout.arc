// packages/ai/src/capabilities/engine-world/index.ts
//
// Phase 0: registers the engine-world capability with read-only tools.
//
// engine_world is the shared world model for the agent fleet. Every agent
// reads from it before acting. Phase 0 ships READ tools only; report_observation
// (gated mutation) lands in Phase 1 along with capability_default_registry seed
// for `engine.world_observe`.
//
// Channel scope: both chat AND voice. Reading world state is non-PII, non-mutating.
// Authority: read_only by default — every workspace gets read access; writes
// (Phase 1) require explicit grant.

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { readSurfaceTool, readSurfaceClassTool } from "./tools.js";

const readTools = [readSurfaceTool, readSurfaceClassTool] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const engineWorldCapability: CapabilityDefinition = {
  name: "engine_world",
  description:
    "Read the shared agent world model (engine_world). Use to check service health (vercel.web, supabase.prod), PR state (pr.323), worktree state (wt.mobile-wt-2), migration tail, cost surfaces, and CI workflow status before deciding to act. Read-only in Phase 0 — counter-reports + heartbeat-write land in Phase 1.",
  // World-state queries are non-PII, non-mutating — both channels safe.
  allowedChannels: ["chat", "voice"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "engine_world",
  defaultAuthority: "read_only",
  readOnlyTools: readTools,
  // No suggest/apply tools yet — Phase 1 sortie adds report_observation.
  suggestTools: [],
  tools: readTools,
};
