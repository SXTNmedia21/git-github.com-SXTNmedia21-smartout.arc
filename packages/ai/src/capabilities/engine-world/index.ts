// packages/ai/src/capabilities/engine-world/index.ts
//
// Phase 0 + Phase 1: engine-world capability.
//
// Phase 0 shipped READ tools only (read_surface, read_surface_class).
// Phase 1 adds report_observation — a gated mutation (ADR-0204) that lets
// agents and system components update the shared world model.
//
// ─── Channel split (council F3, ADR-0078 + ADR-0282 amendment) ──────────────
// The CapabilityDefinition type holds a single `allowedChannels` field — there
// is no readAllowedChannels/writeAllowedChannels split in the type. Following
// the onboarding capability precedent (ADR-0275), we:
//
//   1. Set allowedChannels to the UNION of all channels used by any tool:
//      ["chat", "voice", "system"]
//        chat   — read + write (primary user surface)
//        voice  — READ only (ADR-0078: voice never writes world observations)
//        system — write only (stage-engine async writer, heartbeat jobs)
//
//   2. Enforce the voice-blocks-write rule via a Layer 3 per-tool guard
//      inside report_observation.execute() — same pattern as onboarding's
//      add_procedures / add_key_fact tools.
//
// Read tools (read_surface, read_surface_class) carry no per-tool guard
// because voice reading world state is non-PII, non-mutating, and safe.
//
// The tool-selector (ADR-0078 gating at line 136) gates the WHOLE capability
// by channel. By unioning all three, voice sessions retain read access while
// the per-tool Layer 3 guard in report_observation handles the write block.
//
// References: ADR-0078 (channel guard), ADR-0282 (platform RPC bypass +
//             Phase 1 write path), council F3 verdict (2026-05-06).

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { readSurfaceTool, readSurfaceClassTool, reportObservationTool } from "./tools.js";

// Re-export the capability gate slug so callers that need the gate_action key
// import from this module rather than hardcoding "engine.world_observe" inline.
// Distinct from CapabilityName "engine_world" — the dot-form is the DB-side key.
export { ENGINE_WORLD_OBSERVE_CAPABILITY_SLUG } from "./tools.js";

const readTools = [readSurfaceTool, readSurfaceClassTool] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

const writeTools = [reportObservationTool] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

const allTools = [...readTools, ...writeTools] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const engineWorldCapability: CapabilityDefinition = {
  name: "engine_world",
  description:
    "Read and write the shared agent world model (engine_world). " +
    "READ: check service health (vercel.web, supabase.prod), PR state (pr.323), " +
    "worktree state (wt.mobile-wt-2), migration tail, cost surfaces, CI workflow status. " +
    "WRITE: report_observation — UPSERT a fresh surface observation after an agent or " +
    "system component has new truth (e.g. CI went red, PR merged, deploy succeeded). " +
    "Read-only tools are chat+voice safe. report_observation is chat+system only " +
    "(voice cannot write — ADR-0078 council F3).",
  // Channel union = read-channels ∪ write-channels.
  // Read:  chat + voice  (non-PII, non-mutating — both safe).
  // Write: chat + system (stage-engine/heartbeat async writers use "system").
  // Voice is included at the capability level to preserve read access for voice sessions.
  // report_observation's Layer 3 guard (in tools.ts) blocks voice writes.
  allowedChannels: ["chat", "voice", "system"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "engine_world",
  // confirm: report_observation requires at least confirm authority.
  // Read tools are always available (they sit in readOnlyTools — tool-selector
  // exposes readOnlyTools when level ≥ read_only, which is always true).
  defaultAuthority: "confirm",
  readOnlyTools: readTools,
  // report_observation is a gated mutation → suggest tier (exposed at suggest+).
  // Full mutation paths (confirm/autonomous) see all tools.
  suggestTools: writeTools,
  tools: allTools,
};
