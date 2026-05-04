/**
 * useMyAvailability — the authenticated employee's availability rules.
 *
 * ADR-0132: mobile reads via the web BFF. Direct `supabase.from(
 * "employee_availability")` is FORBIDDEN (the Task-I grep gate
 * enforces zero hits).
 *
 * Server re-derives identity (ADR-0176 Invariant 3) and RLS restricts
 * rows to `profile_id = auth.uid()'s profile`. The BFF adds an explicit
 * profile filter on top for belt-and-braces.
 *
 * Returns rules AND a flattened 14-day daily-resolution window. Task J's
 * calendar UI reads `next14Days` directly; the resolution logic is
 * deliberately client-side (cheap, easy to extend) and handles:
 *   - one-off rows (rrule == null) matching a date
 *   - RRULE rows (rrule != null): delegated to a tiny parser that today
 *     only understands FREQ=WEEKLY;BYDAY=<codes>. Other FREQ values fall
 *     through as "available" — acceptable for v1; richer RRULE parsing
 *     lands with the shared `rrule` library evaluation later.
 * Precedence on conflict: blocked > unavailable > preferred > available.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { getAvailabilityMeUrl } from "@/lib/web-api";

/** One row from `employee_availability`. */
export type AvailabilityRule = {
  id: string;
  workspace_id: string;
  profile_id: string;
  valid_from: string; // ISO date
  valid_to: string | null;
  rrule: string | null;
  preference_type: "unavailable" | "preferred" | "blocked";
  reason: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
};

/** Resolved per-day status for the 14-day swipe calendar. */
export type DailyStatus = {
  date: string; // ISO date YYYY-MM-DD
  status: "available" | "unavailable" | "preferred" | "blocked";
  ruleId: string | null;
  reason: string | null;
};

export type MyAvailabilityData = {
  /** Recurring rules (rrule != null) still in their valid window. */
  weeklyTemplates: AvailabilityRule[];
  /** One-off rules (rrule == null). */
  oneOffs: AvailabilityRule[];
  /** Flattened status for the next 14 days (today inclusive). */
  next14Days: DailyStatus[];
};

// Precedence: higher number wins when multiple rules match a date.
const STATUS_RANK: Record<DailyStatus["status"], number> = {
  available: 0,
  preferred: 1,
  unavailable: 2,
  blocked: 3,
};

/** ISO YYYY-MM-DD for a Date in the local tz (we ignore UTC offset on
 *  purpose — availability is expressed in the user's wall time). */
function isoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseIsoDate(s: string): Date {
  // `new Date("2026-04-23")` would parse as UTC midnight; we add T00:00
  // so it resolves in local tz (matching the rest of the codebase).
  const [y, m, d] = s.split("-").map((p) => Number(p));
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
}

/** 0=Sun … 6=Sat (RFC-5545 BYDAY codes: SU, MO, TU, WE, TH, FR, SA). */
const BYDAY_TO_DOW: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

/** Minimal RRULE matcher. Understands FREQ=WEEKLY;BYDAY=MO,TU — enough
 *  for weekly-template rules, which are the v1 UI shape. Other rules
 *  return false (no match), falling through to "available". */
function rruleMatchesDate(rrule: string, date: Date): boolean {
  // Split the rrule into key=value segments.
  const parts: Record<string, string> = {};
  for (const part of rrule.split(";")) {
    const [k, v] = part.split("=");
    if (k && v) parts[k.toUpperCase()] = v.toUpperCase();
  }
  if (parts.FREQ !== "WEEKLY") return false;
  const byday = parts.BYDAY;
  if (!byday) {
    // FREQ=WEEKLY with no BYDAY implicitly matches the rule's start
    // weekday; we don't have DTSTART on the row so we can't resolve
    // that — treat as no-match.
    return false;
  }
  const codes = byday.split(",").map((c) => c.trim());
  const dow = date.getDay();
  return codes.some((c) => BYDAY_TO_DOW[c] === dow);
}

function isRuleActiveOn(rule: AvailabilityRule, date: Date): boolean {
  const from = parseIsoDate(rule.valid_from);
  if (date < from) return false;
  if (rule.valid_to) {
    const to = parseIsoDate(rule.valid_to);
    if (date > to) return false;
  }
  if (rule.rrule) {
    return rruleMatchesDate(rule.rrule, date);
  }
  // One-off: valid_from bounds the window. A one-off with valid_to null
  // is an indefinite one-off, effectively "every day from valid_from" —
  // not a common shape in the UI, but we honour it.
  return true;
}

function resolveNext14Days(rules: AvailabilityRule[]): DailyStatus[] {
  const out: DailyStatus[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    let winning: DailyStatus = {
      date: isoDate(d),
      status: "available",
      ruleId: null,
      reason: null,
    };
    for (const rule of rules) {
      if (!isRuleActiveOn(rule, d)) continue;
      if (STATUS_RANK[rule.preference_type] > STATUS_RANK[winning.status]) {
        winning = {
          date: winning.date,
          status: rule.preference_type,
          ruleId: rule.id,
          reason: rule.reason,
        };
      }
    }
    out.push(winning);
  }
  return out;
}

type MeResponse = {
  ok: boolean;
  rows?: AvailabilityRule[];
  error?: string;
};

async function fetchMyAvailability(): Promise<MyAvailabilityData> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Ikke innlogget.");

  // Fetch 14 days ahead — matches the calendar window.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in14 = new Date(today);
  in14.setDate(today.getDate() + 14);

  const url = new URL(getAvailabilityMeUrl());
  url.searchParams.set("start", isoDate(today));
  url.searchParams.set("end", isoDate(in14));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  let parsed: MeResponse | null = null;
  try {
    parsed = (await res.json()) as MeResponse;
  } catch {
    /* ignore */
  }

  if (!res.ok || !parsed?.ok) {
    throw new Error(parsed?.error ?? `BFF ${res.status}`);
  }

  const rows = parsed.rows ?? [];
  return {
    weeklyTemplates: rows.filter((r) => r.rrule !== null),
    oneOffs: rows.filter((r) => r.rrule === null),
    next14Days: resolveNext14Days(rows),
  };
}

/**
 * Returns the current employee's availability rules + resolved 14-day
 * status. Refetch on tab focus is off — availability is low-churn, the
 * UI invalidates explicitly after a mutation.
 */
export function useMyAvailability() {
  return useQuery<MyAvailabilityData>({
    queryKey: ["my-availability"],
    queryFn: fetchMyAvailability,
    staleTime: 60_000,
  });
}
