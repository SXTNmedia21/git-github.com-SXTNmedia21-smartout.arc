/**
 * Task capability definition — ADR-0298 Sortie 3 (+ Wave 1 Phase A DnD re-timing).
 *
 * Seven tools unifying the five-source task ontology (ADR-0298 R1):
 *   list_mine, create_personal, create_session, create_day_ad_hoc, complete,
 *   update_session_task, cancel_personal.
 *
 * Authority: defaultAuthority="suggest" (seeded by migration 20260607100000_task_capability_authority_seed.sql).
 *   Mutations require user confirmation at suggest level.
 *   list_mine is read-only and ungated.
 *
 * Channels: allowedChannels=['chat','voice'] at capability level.
 *   Per-tool chat-only enforcement is applied inside each create_* and cancel_personal
 *   tool body (runtime channel guard) — NOT at capability level. This is intentional:
 *   list_mine and complete are voice-safe, so the capability cannot be voice-blocked wholesale.
 *   Spec §4.2 + ADR-0298 R6 confirm this split-channel pattern.
 *
 * emitPrefix: "task" — all events under "task.*" namespace.
 *   Replaces 8 disjoint event families during 30-day alias window (ADR-0298 §Telemetry).
 *
 * toolAuthPattern: "direct_admin" — stage-engine writes via service_role.
 *   Assignee cross-workspace check in create_session uses resolveAssigneeWorkspaceMembership
 *   helper in gate.ts (explicit fail-fast per L-0177).
 *
 * emitPrefix collision check (ADR-0194 + INVARIANTS.md I3):
 *   "task" prefix is new — no existing capability owns this prefix.
 *   getAllCapabilities() in registry.ts asserts uniqueness at runtime.
 */

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import {
  listMine,
  createPersonal,
  createSession,
  createDayAdHoc,
  complete,
  updateSessionTask,
  cancelPersonal,
} from "./tools.js";

const readOnlyTools = [listMine] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const suggestTools = [
  createPersonal,
  createSession,
  createDayAdHoc,
  complete,
  updateSessionTask,
  cancelPersonal,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const allTools = [...readOnlyTools, ...suggestTools] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const taskCapability: CapabilityDefinition = {
  name: "task",
  description:
    "Unified task surface across all five sources: session, personal, day ad-hoc, emma, and runtime. " +
    "list_mine returns a normalized union via fn_list_my_tasks RPC. " +
    "create_personal (employee+), create_session (manager+), create_day_ad_hoc (manager+) are " +
    "chat-only in V1 (free-text PII risk per ADR-0298 R6). " +
    "complete and cancel_personal are available on chat + voice.",
  tools: allTools,
  readOnlyTools,
  suggestTools,
  // chat + voice at capability level. Per-tool chat-only guards live in tool bodies.
  // list_mine and complete are voice-safe. create_* and cancel_personal self-enforce.
  allowedChannels: ["chat", "voice"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "task",
  defaultAuthority: "suggest",
};
