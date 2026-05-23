/**
 * Bootstrap capability definition — ADR-0407 Phase 1.
 *
 * Three tools for workspace bootstrap gate management:
 *   list_bootstrap_gates  — read gates (ungated, admin+, chat+voice)
 *   close_bootstrap_gate  — mark gate closed (gated suggest, admin+, chat+voice)
 *   skip_bootstrap_gate   — skip optional gate (gated suggest, admin+, chat-only V1)
 *
 * Gate registry sourced from K1a industry-package (getBootstrapGates()).
 * Hospitality: 11 gates (incl. Mattilsynet + alcohol).
 * Default: 6 gates (generic).
 *
 * Authority:
 *   list_bootstrap_gates  — read_only, admin+
 *   close_bootstrap_gate  — suggest, admin+
 *   skip_bootstrap_gate   — suggest, admin+
 *
 * All seeded in migration 20260625120000_workspace_bootstrap_gate.sql.
 *
 * emitPrefix: "bootstrap" — all events under "bootstrap.*" namespace.
 *   bootstrap.gates_listed (activity_trail only)
 *   bootstrap.gate_closed  (PostHog + activity_trail + engine_event)
 *   bootstrap.gate_skipped (PostHog + activity_trail + engine_event)
 *
 * toolAuthPattern: "direct_admin" — stage-engine writes via service_role.
 *
 * L-0292 fix: capability registered + intent enum entry in same commit (ADR-0112).
 */

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { listBootstrapGates, closeBootstrapGate, skipBootstrapGate } from "./tools.js";

const readOnlyTools = [listBootstrapGates] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

const suggestTools = [closeBootstrapGate, skipBootstrapGate] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

const allTools = [...readOnlyTools, ...suggestTools] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const bootstrapCapability: CapabilityDefinition = {
  name: "bootstrap",
  description:
    "Workspace bootstrap gate management. Lists open setup gates, closes completed gates, " +
    "and skips optional gates with reason. Gates are sourced from the K1a industry package " +
    "(hospitality: 11 gates, default: 6 gates). Admin+ only. " +
    "list_bootstrap_gates is voice-safe. skip_bootstrap_gate is chat-only V1 (free-text reason).",
  tools: allTools,
  readOnlyTools,
  suggestTools,
  // chat + voice at capability level. skip_bootstrap_gate self-enforces chat-only in body.
  allowedChannels: ["chat", "voice"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "bootstrap",
  defaultAuthority: "suggest",
};
