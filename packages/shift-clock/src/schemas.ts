/**
 * schemas.ts — Zod validation schemas for shift clock API payloads.
 * Used in Edge Functions and React hooks to validate inputs before DB writes.
 */

import { z } from "zod";

export const gpsSnapshotSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative(),
  timestamp: z.string().datetime(),
});

export const punchInPayloadSchema = z.object({
  shiftId: z.string().uuid(),
  gps: gpsSnapshotSchema.nullable(),
  isAdhoc: z.boolean().default(false),
});

export const punchOutPayloadSchema = z.object({
  timeEntryId: z.string().uuid(),
  gps: gpsSnapshotSchema.nullable(),
  comment: z.string().max(1000).optional(),
});

export const breakStartPayloadSchema = z.object({
  timeEntryId: z.string().uuid(),
  gps: gpsSnapshotSchema.nullable(),
});

export const breakEndPayloadSchema = z.object({
  timeEntryId: z.string().uuid(),
  gps: gpsSnapshotSchema.nullable(),
});

export const supplementClaimSchema = z.object({
  supplementRuleId: z.string().uuid(),
  shiftId: z.string().uuid(),
  comment: z.string().min(1, "Comment is required").max(1000),
  timestamp: z.string().datetime(),
});

export const shiftNoteSchema = z.object({
  shiftId: z.string().uuid(),
  content: z.string().min(1).max(2000),
});

export type PunchInPayload = z.infer<typeof punchInPayloadSchema>;
export type PunchOutPayload = z.infer<typeof punchOutPayloadSchema>;
export type BreakStartPayload = z.infer<typeof breakStartPayloadSchema>;
export type BreakEndPayload = z.infer<typeof breakEndPayloadSchema>;
export type SupplementClaimPayload = z.infer<typeof supplementClaimSchema>;
export type ShiftNotePayload = z.infer<typeof shiftNoteSchema>;
