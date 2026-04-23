import { z } from "zod";
import type { CapabilityName, AuthorityLevel, SessionChannel } from "../../capabilities/types.js";

const CAPABILITY_NAMES = [
  "knowledge",
  "schedule",
  "training",
  "operations",
  "operations_intelligence",
  "profile",
  "communication",
  "memory",
  "payroll",
  "ui",
  "guardian",
  "contract",
  "contract_intake",
  "shift_swap",
  "shift_lifecycle",
  "governance",
  "billing_query",
  "helpdesk_query",
  "journey",
] as const satisfies ReadonlyArray<CapabilityName>;

const AUTHORITY_LEVELS = [
  "autonomous",
  "confirm",
  "suggest",
  "read_only",
  "disabled",
] as const satisfies ReadonlyArray<AuthorityLevel>;

const SESSION_CHANNELS = [
  "chat",
  "voice",
  "sms",
  "email",
  "autonomous",
  "telegram",
  "system",
] as const satisfies ReadonlyArray<SessionChannel>;

export const goldenTranscriptSchema = z.object({
  id: z.string().min(1),
  description: z.string(),
  input: z.object({
    message: z.string().min(1),
    profile_id: z.string().min(1),
    channel: z.enum(SESSION_CHANNELS),
    page_context: z.string().optional(),
  }),
  seeded_authority: z
    .record(z.enum(CAPABILITY_NAMES), z.enum(AUTHORITY_LEVELS))
    .optional()
    .default({}),
  expected: z.object({
    intent: z.object({
      capability: z.enum(CAPABILITY_NAMES).nullable(),
      minConfidence: z.number().min(0).max(1),
    }),
    gate: z.object({
      allow: z.boolean(),
      reason: z.string().optional(),
    }),
    tools_offered: z.array(z.string()).default([]),
    tool_called: z.object({ name: z.string(), args: z.record(z.unknown()) }).optional(),
  }),
});

export type GoldenTranscript = z.infer<typeof goldenTranscriptSchema>;
