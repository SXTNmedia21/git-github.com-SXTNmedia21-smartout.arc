/**
 * Zod validation schemas for common mutation inputs.
 *
 * These run on the client AND server — no Supabase dependency.
 * Keep schemas minimal: only fields the user can write, not DB defaults.
 */

import { z } from "zod";

// ── Profile ───────────────────────────────────────────────────────────

export const updateProfileInput = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  avatar_url: z.string().url().optional(),
  preferred_language: z.string().max(10).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileInput>;

// ── Absence ───────────────────────────────────────────────────────────

export const createAbsenceInput = z.object({
  profile_id: z.string().uuid(),
  absence_type: z.string().min(1),
  start_date: z.string().date(),
  end_date: z.string().date(),
  note: z.string().max(500).optional(),
});

export type CreateAbsenceInput = z.infer<typeof createAbsenceInput>;

export const cancelAbsenceInput = z.object({
  absence_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export type CancelAbsenceInput = z.infer<typeof cancelAbsenceInput>;
