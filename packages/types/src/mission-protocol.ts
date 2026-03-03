// packages/types/src/mission-protocol.ts
// WebSocket protocol types shared between Stage Engine and frontend.
// Connected to: services/stage-engine/src/ws/ (server side)
// Connected to: apps/web/src/hooks/useJourneySocket.ts (client side)

import { z } from "zod";

// ── Agent → Frontend ─────────────────────────────────────

export const UICommandSchema = z.object({
  type: z.literal("ui_command"),
  sessionId: z.string(),
  command: z.discriminatedUnion("action", [
    z.object({ action: z.literal("navigate"), target: z.string() }),
    z.object({
      action: z.literal("highlight"),
      target: z.string(),
      duration: z.number().optional(),
    }),
    z.object({ action: z.literal("fill_field"), field: z.string(), value: z.string() }),
    z.object({
      action: z.literal("show_panel"),
      panel: z.string(),
      data: z.record(z.unknown()).optional(),
    }),
    z.object({ action: z.literal("hide_panel"), panel: z.string() }),
    z.object({
      action: z.literal("toast"),
      message: z.string(),
      variant: z.enum(["info", "success", "warning"]).optional(),
    }),
    z.object({
      action: z.literal("custom"),
      name: z.string(),
      payload: z.record(z.unknown()),
    }),
  ]),
  timestamp: z.number(),
});
export type UICommand = z.infer<typeof UICommandSchema>;

// ── Frontend → Agent ─────────────────────────────────────

export const UserActionSchema = z.object({
  type: z.literal("user_action"),
  sessionId: z.string(),
  action: z.discriminatedUnion("event", [
    z.object({ event: z.literal("field_changed"), field: z.string(), value: z.string() }),
    z.object({ event: z.literal("step_entered"), stepOrder: z.number(), screen: z.string() }),
    z.object({ event: z.literal("button_clicked"), button: z.string() }),
    z.object({
      event: z.literal("form_submitted"),
      form: z.string(),
      data: z.record(z.unknown()),
    }),
    z.object({
      event: z.literal("custom"),
      name: z.string(),
      payload: z.record(z.unknown()),
    }),
  ]),
  timestamp: z.number(),
});
export type UserAction = z.infer<typeof UserActionSchema>;

// ── System Events ────────────────────────────────────────

export const SystemEventSchema = z.object({
  type: z.enum(["session_state", "agent_typing", "error", "journey_progress"]),
  sessionId: z.string(),
  data: z.record(z.unknown()),
  timestamp: z.number(),
});
export type SystemEvent = z.infer<typeof SystemEventSchema>;

// ── Union for parsing incoming WebSocket messages ────────

export const MissionProtocolMessage = z.discriminatedUnion("type", [
  UICommandSchema,
  UserActionSchema,
  SystemEventSchema,
]);
export type MissionProtocolMessage = z.infer<typeof MissionProtocolMessage>;
