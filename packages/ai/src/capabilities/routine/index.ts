/**
 * Routine capability definition — ADR-0367 BT2 + procedure-engine Phase 1.
 *
 * Tools:
 *   attach_to_line    — materialises a routine template into a day_line's task set (BT2).
 *   create            — creates a routine template bound to procedure + protocol (Phase 1 T3).
 *   assign_to_location — scopes routine to location + optional teams + wires session_hook (T4+T5).
 *   add_step          — appends a step to the routine's procedure (T5b).
 *
 * Authority:
 *   create            — admin+ (authoring act).
 *   assign_to_location, attach_to_line, add_step — manager+, confirm.
 *
 * Channels: chat-only V1 (ADR-0078 — free-text titles/descriptions carry PII risk).
 *   Per-tool channel guard at tool body level (channel === "voice" → reject).
 *
 * emitPrefix: "routine" — all events under "routine.*" namespace.
 *   routine.attached, routine.created, routine.assigned_to_location (4 destinations each).
 *   Also emits "procedure_step.added" (3 destinations) — cross-namespace emit,
 *   justified by ADR-0240 §delegation (procedure namespace owned by governance capability;
 *   step additions via routine are routine-capability acts with procedure_step as the
 *   target entity). No direct session_task writes (ADR-0173 frozen-4 boundaries).
 *
 * toolAuthPattern: "direct_admin" — stage-engine writes via service_role.
 *
 * emitPrefix collision check (ADR-0194 + INVARIANTS.md I3):
 *   "routine" prefix — no existing capability owns this prefix.
 *   getAllCapabilities() in registry.ts asserts uniqueness at runtime.
 *
 * ADR-0240 delegation contract:
 *   attach_to_line MUST NOT write session_task directly. All task creation
 *   is delegated to task.create_session.execute(). The __tests__/tools.test.ts
 *   grep test enforces this at CI time.
 */

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { attachToLine, createRoutineTool, assignRoutineToLocation, addStepTool } from "./tools.js";

const allTools = [
  attachToLine,
  createRoutineTool,
  assignRoutineToLocation,
  addStepTool,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const readOnlyTools = [] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// All 4 tools are suggest-level (manager+ / admin triggers)
const suggestTools = [
  attachToLine,
  createRoutineTool,
  assignRoutineToLocation,
  addStepTool,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const routineCapability: CapabilityDefinition = {
  name: "routine",
  description:
    "Routine management surface — create, scope, and materialise routine templates. " +
    "create: admin creates routine bound to procedure + protocol. " +
    "assign_to_location: scopes routine to location + optional teams, wires session_hook per dept. " +
    "add_step: appends a step to the routine's procedure. " +
    "attach_to_line: materialises routine into day_line task set (ADR-0240 delegation). " +
    "Manager+/admin, confirm authority. Chat-only V1.",
  tools: allTools,
  readOnlyTools,
  suggestTools,
  // Chat-only V1. Voice rejected at tool body level.
  allowedChannels: ["chat"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "routine",
  defaultAuthority: "confirm",
};
