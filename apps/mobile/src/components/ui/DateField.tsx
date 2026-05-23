/**
 * DateField — date selector built on the shared Dropdown primitive.
 *
 * One input type across every form (Nordic Split, dark-aware) — matches the
 * Fra/Til time Dropdowns so all drawer forms use the SAME control family.
 * No native picker dependency, no raw <input> styling burden.
 *
 * Emits YYYY-MM-DD. Options span a window around an anchor date (default today,
 * or `anchor` when the sheet was opened on a specific day).
 */
import React, { useMemo } from "react";
import { Dropdown, type DropdownOption } from "@/components/ui/Dropdown";

/** YYYY-MM-DD in local time (no UTC shift from toISOString). */
function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "man. 26. mai" — capitalized weekday + day + month, nb-NO. */
function labelFor(d: Date, today: string): string {
  const ymd = toYmd(d);
  const base = d.toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const cap = base.charAt(0).toUpperCase() + base.slice(1);
  if (ymd === today) return `I dag · ${cap}`;
  return cap;
}

export function DateField(props: {
  label?: string;
  /** YYYY-MM-DD or null. */
  value: string | null;
  onChange: (ymd: string) => void;
  placeholder?: string;
  /** Anchor day the option window centers on. Defaults to today. */
  anchor?: Date;
  /** Days before the anchor to include (default 2). */
  daysBefore?: number;
  /** Days after the anchor to include (default 60). */
  daysAfter?: number;
}) {
  const { anchor, daysBefore = 2, daysAfter = 60 } = props;

  const options = useMemo<DropdownOption[]>(() => {
    const today = toYmd(new Date());
    const start = anchor ? new Date(anchor) : new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - daysBefore);

    const out: DropdownOption[] = [];
    for (let i = 0; i <= daysBefore + daysAfter; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const ymd = toYmd(d);
      out.push({ value: ymd, label: labelFor(d, today) });
    }
    return out;
  }, [anchor, daysBefore, daysAfter]);

  return (
    <Dropdown
      label={props.label}
      options={options}
      value={props.value}
      onChange={props.onChange}
      placeholder={props.placeholder ?? "Velg dato"}
    />
  );
}
