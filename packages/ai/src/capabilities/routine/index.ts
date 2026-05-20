/**
 * Routine capability definition — ADR-0367 BT2.
 *
 * One tool: attach_to_line — materialises a routine template into a day_line's task set.
 *
 * Authority: confirm, manager+ (seeded in BT0 Phase A authority migration).
 *
 * Channels: chat-only V1 (ADR-0078 — free-text item title carries PII risk).
 *   Per-tool channel guard at tool body level (channel === "voice" → reject).
 *
 * emitPrefix: "routine" — all events under "routine.*" namespace.
 *   routine.attached (4 destinations: posthog + logger + activity_trail + engine_event).
 *
 * toolAuthPattern: "direct_admin" — stage-engine writes via service_role.
 *
 * emitPrefix collision check (ADR-0194 + INVARIANTS.md I3):
 *   "routine" prefix is new — no existing capability owns this prefix.
 *   getAllCapabilities() in registry.ts asserts uniqueness at runtime.
 *
 * ADR-0240 delegation contract:
 *   attach_to_line MUST NOT write session_task directly. All task creation
 *   is delegated to task.create_session.execute(). The __tests__/tools.test.ts
 *   grep test enforces this at CI time.
 */

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { attachToLine } from "./tools.js";

// attach_to_line is a mutation — no read-only tools in this capability V1.
const allTools = [attachToLine] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;
const readOnlyTools = [] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;
const suggestTools = [attachToLine] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const routineCapability: CapabilityDefinition = {
  name: "routine",
  description:
    "Routine attachment surface — materialises routine templates into day_line task sets. " +
    "attach_to_line creates session-scoped tasks via task.create_session delegation (ADR-0240). " +
    "Manager+, confirm authority. Chat-only V1.",
  tools: allTools,
  readOnlyTools,
  suggestTools,
  // Chat-only V1. Voice rejected at tool body level.
  allowedChannels: ["chat"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "routine",
  defaultAuthority: "confirm",
};
