/**
 * packages/ai/src/capabilities/scheduler/index.ts
 *
 * Scheduler capability — bundle solver + turnus diagnose + week templates.
 *
 * 6 tools:
 *   propose_plan       — web Compose, chat-only (ADR-0307/0309), suggest
 *   accept_proposal    — mobile Approve, chat-only (ADR-0309), suggest
 *   reject_proposal    — mobile Approve, chat-only, suggest
 *   diagnose_turnus_disabled — read-only D1/D2/D3/D4 audit (ADR-0417 Phase 1).
 *                              Voice-OK; tool body trims output on voice.
 *   list_week_templates      — read-only archived planning_cycle index (ADR-0417).
 *                              Voice-OK (no PII per ADR-0078).
 *   apply_week_template      — write change_proposal kind='template_apply' (ADR-0417).
 *                              Chat-only; tool body rejects voice (ADR-0288).
 *
 * Channel policy: capability admits chat + voice. Per-tool execute() bodies
 * enforce ADR-0288 for irreversible C4 acts (propose/accept/reject/apply
 * return early on voice; diagnose trims; list passes through).
 *
 * ADR REFERENCES:
 *   ADR-0078 channel gating | ADR-0192 authority seed | ADR-0204 mutateWithGate
 *   ADR-0287 one gate per atomic write | ADR-0288 chat-only irreversible
 *   ADR-0307 greedy V1 | ADR-0309 bundle proposal | ADR-0417 template_apply taxonomy
 *   L-0292 intent enum + system prompt + capability registration in SAME commit
 */

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { proposePlan, acceptProposal, rejectProposal } from "./tools.js";
import { diagnoseTurnusDisabled } from "./diagnose-tools.js";
import { listWeekTemplates, applyWeekTemplate } from "./tools-template.js";

// Master tool list. Order is presentation-only; tool-selector keys by .name.
// Reads first, then writes.
const allTools = [
  diagnoseTurnusDisabled,
  listWeekTemplates,
  proposePlan,
  acceptProposal,
  rejectProposal,
  applyWeekTemplate,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// read_only authority bucket — no gate evaluated. Both reads are voice-safe.
const readOnlyTools = [diagnoseTurnusDisabled, listWeekTemplates] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

// suggest authority bucket — HITL via mutateWithGate (ADR-0204).
// propose_plan + apply_week_template: Compose verb. accept_proposal + reject_proposal: Approve verb.
const suggestTools = [
  proposePlan,
  acceptProposal,
  rejectProposal,
  applyWeekTemplate,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// Re-export tools so BFF routes can import them without going through dist/
// (pattern: @smartout/ai/capabilities/scheduler → named exports)
export { proposePlan, acceptProposal, rejectProposal } from "./tools.js";
export { diagnoseTurnusDisabled } from "./diagnose-tools.js";
export { listWeekTemplates, applyWeekTemplate } from "./tools-template.js";

export const schedulerCapability: CapabilityDefinition = {
  name: "scheduler",
  description:
    "Scheduler bundle ops (propose/accept/reject) + turnus diagnostics (diagnose_turnus_disabled) + week templates (list_week_templates, apply_week_template). Manager+ for all writes. Mutation tools are chat-only (ADR-0288, per-tool voice guards). Reads (diagnose + list) are voice-allowed; diagnose returns a trimmed summary on voice.",
  tools: allTools,
  readOnlyTools,
  suggestTools,
  // ADR-0078: capability admits both channels. Per-tool execute() bodies enforce
  // ADR-0288 for irreversible acts (propose/accept/reject/apply reject voice).
  // Reads (diagnose, list) operate on voice without restriction.
  allowedChannels: ["chat", "voice"],
  // ADR-0191: BFF-proxied auth (web + mobile surfaces call BFF → stage-engine → capability).
  toolAuthPattern: "bff",
  // ADR-0194: emit namespace = "scheduler".
  emitPrefix: "scheduler",
  // ADR-0192: default when engine_authority_config row is missing.
  // Real production workspaces get seeded row from PLAN Phase 1 migration.
  defaultAuthority: "suggest",
};
