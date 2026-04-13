/**
 * Shift swap types — shared between web, mobile, and server.
 * Lives in packages/utils so all surfaces can import without React dependency.
 *
 * ShiftSwapContext is the JSONB shape stored in engine_state.context.
 * No new tables — all swap state lives in the Event Engine (ADR-0067).
 */

import { z } from "zod";

// ── Engine State Context ────────────────────────────────────────────────────
// Zod-validated shape for engine_state.context JSONB when process_id = 'shift_swap'

export const swapValidationResultSchema = z.object({
  eligible: z.boolean(),
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
  tariff_delta: z.number().optional(),
});

export const shiftSwapContextSchema = z.object({
  // Parties
  requester_profile_id: z.string().uuid(),
  target_profile_id: z.string().uuid(),

  // Shifts
  requester_shift_id: z.string().uuid(),
  target_shift_id: z.string().uuid(),

  // Type — Phase 1 only supports mutual exchange
  swap_type: z.literal("mutual_exchange"),

  // Optional
  reason: z.string().optional(),

  // Validation result (populated at step 2)
  validation_result: swapValidationResultSchema,

  // Status tracking
  status: z.enum([
    "pending_recipient",
    "pending_manager",
    "approved",
    "rejected",
    "cancelled",
    "executed",
  ]),
  rejected_by: z.string().uuid().optional(),
  rejection_reason: z.string().optional(),
  executed_at: z.string().datetime().optional(),
});

export type ShiftSwapContext = z.infer<typeof shiftSwapContextSchema>;
export type SwapValidationResult = z.infer<typeof swapValidationResultSchema>;

// ── Shift Data for Validation ───────────────────────────────────────────────
// Minimal shift data needed by the pure validation function.
// Decoupled from database types so this stays framework-agnostic.

export type ShiftForValidation = {
  schedule_shift_id: string;
  employee_id: string | null;
  shift_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM or HH:MM:SS
  end_time: string;
  work_hours: number;
  position_id: string | null;
  status: string;
};
