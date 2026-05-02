/**
 * Personal capability definition (feat/botsson-personal-tools).
 *
 * Five everyday-utility tools for Mr. Botsson:
 *   add_note, create_task, set_reminder, get_history, update_setting.
 *
 * Authority: defaultAuthority="suggest" (seeded by migration).
 *   Mutations require user confirmation at suggest level.
 *   get_history is read-only and always available.
 *
 * Channels: chat + voice.
 *   No Høy-PII data in these tools — no channel restriction beyond the defaults.
 *
 * emitPrefix: "personal" — all events under "personal.*" namespace.
 *
 * toolAuthPattern: "direct_admin" — stage-engine writes via service_role.
 */

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { addNote, createTask, setReminder, getHistory, updateSetting } from "./tools.js";

const readOnlyTools = [getHistory] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const suggestTools = [addNote, createTask, setReminder, updateSetting] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

const allTools = [...readOnlyTools, ...suggestTools] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const personalCapability: CapabilityDefinition = {
  name: "personal",
  description:
    "Personal utility tools: quick notes, personal tasks, timed reminders, activity history, " +
    "and per-profile settings. Available on chat and voice.",
  tools: allTools,
  readOnlyTools,
  suggestTools,
  allowedChannels: ["chat", "voice"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "personal",
  defaultAuthority: "suggest",
};
