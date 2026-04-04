/**
 * types.ts — Zod schemas and derived types for shift clock data shapes
 * used at the boundary between database JSON columns and typed application code.
 *
 * The schedule_shift and timesheet.time_entry tables store GPS coordinates,
 * break entries, and supplement entries as JSONB. These schemas validate that
 * data at the DB read boundary so the rest of the code can work with typed values.
 *
 * For API payload validation, see @smartout/shift-clock/schemas (canonical source).
 */

import { z } from "zod";

// ── GPS coordinate stored in punch_in_location / punch_out_location ──────────

export const GpsCoordinateSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().optional(),
  timestamp: z.number().optional(),
});
export type GpsCoordinate = z.infer<typeof GpsCoordinateSchema>;

// ── Break entry stored in the breaks JSONB array on time_entry ────────────────

export const BreakEntrySchema = z.object({
  break_start: z.string(),
  break_end: z.string().nullable(),
  break_type: z.enum(["paid", "unpaid"]),
  duration_minutes: z.number().optional(),
});
export type BreakEntry = z.infer<typeof BreakEntrySchema>;

// ── Supplement entry stored in supplement_claims JSONB ────────────────────────

export const SupplementEntrySchema = z.object({
  type: z.string(),
  rate: z.number(),
  hours: z.number(),
  amount: z.number(),
});
export type SupplementEntry = z.infer<typeof SupplementEntrySchema>;
