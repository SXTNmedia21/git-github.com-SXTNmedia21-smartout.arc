/**
 * Time options for the Dropdown-based time picker.
 * Generates always-valid HH:MM values so the user never types a malformed time.
 * Default step 15 min → 96 options (00:00 … 23:45).
 */
import type { DropdownOption } from "@/components/ui/Dropdown";

export function timeOptions(stepMinutes = 15): DropdownOption[] {
  const out: DropdownOption[] = [];
  for (let m = 0; m < 24 * 60; m += stepMinutes) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    const t = `${hh}:${mm}`;
    out.push({ value: t, label: t });
  }
  return out;
}

/** Shared singleton — 15-minute grid. */
export const TIME_OPTIONS_15 = timeOptions(15);
