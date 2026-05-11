/**
 * _schema.ts — Zod schemas and TypeScript types for /api/botsson/sessions/* endpoints.
 *
 * All response shapes validated here. Route files import types — no inline type
 * definitions in route files (avoids schema drift between handler and consumer).
 *
 * ADR-0296: engine_sessions is the canonical chat-persistence surface.
 * Conversation turns live in collected_data.conversation (JSONB array).
 */

import { z } from "zod";

export const sessionListItemSchema = z.object({
  id: z.string().uuid(),
  summary: z.string().nullable(),
  started_at: z.string(),
  last_turn_at: z.string(),
  turn_count: z.number().int().min(0),
  channel: z.enum(["chat", "voice"]),
  mode: z.literal("agent"),
});

export const sessionListResponseSchema = z.object({
  sessions: z.array(sessionListItemSchema),
});

export const conversationTurnSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  timestamp: z.string(),
});

export const sessionDetailResponseSchema = z.object({
  id: z.string().uuid(),
  summary: z.string().nullable(),
  channel: z.enum(["chat", "voice"]),
  mode: z.literal("agent"),
  status: z.enum(["active", "complete", "expired", "abandoned"]),
  is_archived: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  conversation: z.array(conversationTurnSchema),
});

export type SessionListItem = z.infer<typeof sessionListItemSchema>;
export type SessionListResponse = z.infer<typeof sessionListResponseSchema>;
export type SessionDetail = z.infer<typeof sessionDetailResponseSchema>;
export type ConversationTurn = z.infer<typeof conversationTurnSchema>;
