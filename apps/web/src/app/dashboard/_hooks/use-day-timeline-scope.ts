"use client";

/**
 * useDayTimelineScope — reads and writes scope URL search-params.
 *
 * Two planes coexist:
 *
 * 1. Legacy single-scope  ?scope=type:<id>   (backwards-compatible — read by
 *    useDayTimelineEvents + SavedTimelinesDropdown). Written by setScope().
 *
 * 2. Multi-select         ?scope_dept=id1,id2&scope_loc=id1&scope_shift=id1
 *    Written by setSelection(). When any multi-select param is present it
 *    wins over the legacy param for the `selection` return value.
 *
 * URL schema: one param per dimension, comma-separated IDs.
 * Simple, debuggable, allows partial presence, no special encoding needed.
 */

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ScopeSelection } from "@/components/day/ScopeFilterPopover";

export type DayTimelineScope =
  | { type: "all" }
  | { type: "department"; id: string }
  | { type: "team"; id: string }
  | { type: "location"; id: string }
  | { type: "shift"; id: string };

// ─── Legacy single-scope helpers ─────────────────────────────────────────────

/** Serialise scope → URL param string, e.g. "team:abc-123" */
function encodeScope(scope: DayTimelineScope): string {
  if (scope.type === "all") return "all";
  return `${scope.type}:${scope.id}`;
}

/** Parse URL param string → typed scope. Falls back to "all" on bad input. */
function decodeScope(raw: string | null): DayTimelineScope {
  if (!raw || raw === "all") return { type: "all" };
  const colon = raw.indexOf(":");
  if (colon === -1) return { type: "all" };
  const type = raw.slice(0, colon) as DayTimelineScope["type"];
  const id = raw.slice(colon + 1);
  if (!id) return { type: "all" };
  if (type === "department" || type === "team" || type === "location" || type === "shift") {
    return { type, id };
  }
  return { type: "all" };
}

// ─── Multi-select helpers ─────────────────────────────────────────────────────

const PARAM_DEPT = "scope_dept";
const PARAM_LOC = "scope_loc";
const PARAM_SHIFT = "scope_shift";

const EMPTY_SELECTION: ScopeSelection = {
  departmentIds: [],
  locationIds: [],
  shiftIds: [],
};

function decodeSelection(searchParams: URLSearchParams): ScopeSelection {
  const depts = searchParams.get(PARAM_DEPT);
  const locs = searchParams.get(PARAM_LOC);
  const shifts = searchParams.get(PARAM_SHIFT);
  const departmentIds = depts ? depts.split(",").filter(Boolean) : [];
  const locationIds = locs ? locs.split(",").filter(Boolean) : [];
  const shiftIds = shifts ? shifts.split(",").filter(Boolean) : [];
  return { departmentIds, locationIds, shiftIds };
}

function hasAnySelection(sel: ScopeSelection): boolean {
  return sel.departmentIds.length > 0 || sel.locationIds.length > 0 || sel.shiftIds.length > 0;
}

function applySelectionToParams(
  params: URLSearchParams,
  sel: ScopeSelection,
): void {
  if (sel.departmentIds.length > 0) {
    params.set(PARAM_DEPT, sel.departmentIds.join(","));
  } else {
    params.delete(PARAM_DEPT);
  }
  if (sel.locationIds.length > 0) {
    params.set(PARAM_LOC, sel.locationIds.join(","));
  } else {
    params.delete(PARAM_LOC);
  }
  if (sel.shiftIds.length > 0) {
    params.set(PARAM_SHIFT, sel.shiftIds.join(","));
  } else {
    params.delete(PARAM_SHIFT);
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDayTimelineScope(): {
  /** Legacy single-scope — consumed by useDayTimelineEvents + SavedTimelinesDropdown. */
  scope: DayTimelineScope;
  setScope: (s: DayTimelineScope) => void;
  /** Multi-select — consumed by ScopeFilterPopover + AggregatedDayLineList filter. */
  selection: ScopeSelection;
  setSelection: (s: ScopeSelection) => void;
} {
  const router = useRouter();
  const searchParams = useSearchParams();

  const scope = decodeScope(searchParams.get("scope"));
  const selection = decodeSelection(searchParams);

  const setScope = useCallback(
    (next: DayTimelineScope) => {
      // Preserve all existing search-params; only mutate "scope"
      const params = new URLSearchParams(searchParams.toString());
      const encoded = encodeScope(next);
      if (encoded === "all") {
        params.delete("scope");
      } else {
        params.set("scope", encoded);
      }
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const setSelection = useCallback(
    (next: ScopeSelection) => {
      const params = new URLSearchParams(searchParams.toString());
      applySelectionToParams(params, next);
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // When multi-select has data it is the authoritative selection; else derive
  // from legacy scope so the popover reflects the active single-scope filter.
  const effectiveSelection: ScopeSelection = hasAnySelection(selection)
    ? selection
    : EMPTY_SELECTION;

  return { scope, setScope, selection: effectiveSelection, setSelection };
}
