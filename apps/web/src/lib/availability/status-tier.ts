/**
 * Shared per-day availability status — tier ordering + Norwegian labels.
 *
 * Single source for the status tuple consumed by manager-facing day views:
 * - `AvailabilitySidebar` (roster overlay — status badge/chip form)
 * - `AddShiftDialog` (availability-aware dropdown + override warning)
 *
 * Until Task R (2026-04-24) these maps were duplicated per component with
 * drift risk. Tier ordering + the two label shapes now live here so any
 * future status (e.g. a dedicated `blocked` surface) is added in one place.
 *
 * The `DailyStatus` union is re-exported from
 * `use-team-availability.ts` — that hook is the schema owner (it resolves
 * `employee_availability.preference_type` + `schedule_absence` into the
 * runtime shape). Do NOT fork the union here.
 */

import type { DailyStatus } from "@/app/dashboard/_hooks/use-team-availability";

export type { DailyStatus };

/**
 * Sort order for manager-facing lists: most-useful-first.
 * Lower number = renders higher in the list.
 *
 * available (0) → the people a manager can reach right now
 * preferred (1) → people who opted in for this day
 * unavailable (2) → opted-out via `employee_availability`
 * absent (3) → `schedule_absence` row covers the day
 */
export const STATUS_TIER: Record<DailyStatus, number> = {
  available: 0,
  preferred: 1,
  unavailable: 2,
  absent: 3,
};

/**
 * Badge / chip label — capitalized noun form.
 * Use when the label stands alone as a status indicator (e.g. a row
 * badge in `AvailabilitySidebar`).
 */
export const STATUS_LABEL_NB: Record<DailyStatus, string> = {
  available: "Tilgjengelig",
  preferred: "Foretrukket",
  unavailable: "Opptatt",
  absent: "Fraværende",
};

/**
 * Inline sentence-body label — lowercase adjectival form.
 * Use when the label is embedded in a Norwegian sentence
 * (e.g. "Ola er utilgjengelig denne dagen" in the override warning
 * banner). Follows standard Norwegian sentence casing.
 */
export const STATUS_LABEL_NB_INLINE: Record<DailyStatus, string> = {
  available: "tilgjengelig",
  preferred: "foretrukket dag",
  unavailable: "utilgjengelig",
  absent: "fraværende",
};

/** Helper — tier lookup with explicit typing. */
export function statusTier(status: DailyStatus): number {
  return STATUS_TIER[status];
}

/** Helper — badge/chip label. */
export function statusLabel(status: DailyStatus): string {
  return STATUS_LABEL_NB[status];
}

/** Helper — inline sentence-body label. */
export function statusLabelInline(status: DailyStatus): string {
  return STATUS_LABEL_NB_INLINE[status];
}
