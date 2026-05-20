/**
 * packages/ai/src/capabilities/day-line/index.ts
 *
 * Day-line capability definition (ADR-0367).
 *
 * Four tools covering the D6 Production day_line lifecycle:
 *   create              — insert day_line for a dept_session + location pairing (manager+)
 *   add_item            — delegating dispatcher: task branch delegates to task.create_session,
 *                         routine branch delegates to timeline_template.apply_template (ADR-0240)
 *   instantiate_template— convenience alias for add_item {item_type:'routine'} (manager+)
 *   update_hours        — patch planned_open / planned_close, emit one or both change events
 *
 * Authority: defaultAuthority="suggest" (seeded by migration
 * 20260620120800_day_line_capability_authority_seed.sql + 20260620120900_day_line_update_hours_authority_seed.sql).
 * All mutations require user confirmation at suggest level.
 *
 * Channels: chat-only at capability level AND inside each tool body (ADR-0078 double guard).
 * No voice surface for day-line tools in V1 — free-text fields + operational
 * context make voice-PII risk unacceptable.
 *
 * emitPrefix collision check (ADR-0194 + INVARIANTS.md I3):
 *   "day-line" prefix is new — no existing capability owns "day_line.*" events.
 *   This capability ALSO emits "routine.attached" — shared with timeline-template
 *   capability which also emits this event (ADR-0356 §"Audit symmetry"). Both
 *   are intentional: day-line emits for delegation provenance; timeline-template
 *   emits for template materialisation metrics.
 *
 * Cross-namespace delegation (ADR-0240 + ADR-0356):
 *   add_item and instantiate_template NEVER write directly to session_task or any
 *   timeline_template-owned table. All cross-namespace writes go through the
 *   owning capability's tool execute() method.
 */

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { create, addItem, instantiateTemplate, updateHours } from "./tools.js";

const readOnlyTools: ReadonlyArray<SmartoutTool<AgentToolContext>> = [] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

const suggestTools = [
  create,
  addItem,
  instantiateTemplate,
  updateHours,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const allTools = [...suggestTools] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const dayLineCapability: CapabilityDefinition = {
  name: "day-line",
  description:
    "D6 Production dag-linje lifecycle. Opprett dag-linje for en bestemt lokasjon og session, " +
    "legg til elementer (oppgaver, rutiner), appliser tidslinje-maler, og oppdater planlagte åpningstider. " +
    "Alle mutasjoner krever bekreftelse (suggest). Chat-only (ADR-0078). Manager+.",
  tools: allTools,
  readOnlyTools,
  suggestTools,
  allowedChannels: ["chat"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "day-line",
  defaultAuthority: "suggest",
};
