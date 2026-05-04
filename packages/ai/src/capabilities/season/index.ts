// packages/ai/src/capabilities/season/index.ts
//
// Season capability — five tools for planning-cycle operations (ADR-0201).
//
// Tools:
//   - season.create         (suggest   default, admin min_role)   → season + budget + default factors
//   - season.set_revenue    (suggest   default, admin min_role)   → update season_budget target_revenue + labor%
//   - season.save_playbook  (suggest   default, admin min_role)   → append notes to season.description
//   - season.get_readiness  (read_only default, admin min_role)   → workforce readiness % from protocol_assignment
//   - season.learn_factors  (read_only default, admin min_role)   → compare day/hour factors with previous season
//
// season.activate (ADR-0200) is NOT exposed here — it is a Server Action path
// with its own authority seed (20260518010000). Invariant I11.
//
// Authority rows seeded in migration 20260518020000_season_agent_capability_authority_seed.sql
// (M3.4). tool-selector.ts maps authority level → which tools the agent sees:
//   - read_only  → readOnlyTools                        (get_readiness, learn_factors)
//   - suggest    → readOnlyTools + suggestTools         (all 5 — reads + create/set_revenue/save_playbook)
//   - confirm    → all tools                            (all 5)
//   - autonomous → all tools                            (all 5 — no autonomous tool here)
//
// Channel posture (ADR-0201 §D1):
//   - allowedChannels at capability level is the UNION: chat + voice + system.
//   - Per-tool voice-safety is carried by the read-only tools (voice-safe
//     for single-shot queries). Mutation tools (create/set_revenue/save_playbook)
//     are chat+system-only in practice — enforced at gate_action via the
//     channel argument and by never wiring a voice bridge (ADR-0201 §D5,
//     deferred to M5). Invariant I8.
//
// Binding ADRs: 0078 (voice forbidden for PII/critical), 0099 (gate_action),
// 0164 (season telemetry namespace), 0173 (capability model),
// 0191 (single auth-passing pattern), 0195 (per-tool dotted keys),
// 0196 (gate_action on every mutation), 0201 (season capability).

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { createSeason } from "../../tools/season/create-season.js";
import { setRevenue } from "../../tools/season/set-revenue.js";
import { savePlaybook } from "../../tools/season/save-playbook.js";
import { getReadiness } from "../../tools/season/get-readiness.js";
import { learnFactors } from "../../tools/season/learn-factors.js";

// Read-only tools: available at read_only+ authority level. Voice-safe per
// ADR-0201 §D1 (single-shot queries carry no PII).
const readOnlyTools = [getReadiness, learnFactors] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

// Suggest tools: available at suggest+ authority level. All 3 season
// mutations are low-risk (create/edit budget metadata, append playbook notes)
// but require the suggest flow's UI-confirm step before executing.
const suggestTools = [createSeason, setRevenue, savePlaybook] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

// All tools — exposed at confirm+ and autonomous levels.
const tools = [
  createSeason,
  setRevenue,
  savePlaybook,
  getReadiness,
  learnFactors,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const seasonCapability: CapabilityDefinition = {
  name: "season",
  description:
    "Season planning: create seasons, set revenue targets, read workforce readiness, compare factors with previous seasons, save playbooks.",
  tools,
  readOnlyTools,
  suggestTools,
  // ADR-0201 §D1 — capability-level channels are the UNION of read-safe and
  // write-safe sets. Per-tool posture is enforced by gate_action (channel
  // argument) and by the absence of voice bridges for mutation tools until M5.
  allowedChannels: ["chat", "voice", "system"],
  toolAuthPattern: "direct_admin",
  // ADR-0164 — season namespace owned by this capability. Forward-looking
  // reservation; no tool emits in M3 (telemetry wiring lands M4).
  emitPrefix: "season",
  defaultAuthority: "read_only",
};

export { createSeason, setRevenue, savePlaybook, getReadiness, learnFactors };
