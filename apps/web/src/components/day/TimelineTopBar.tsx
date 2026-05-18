"use client";

/**
 * TimelineTopBar — thin row above the DayTimelineStrip.
 *
 * Composes <ScopeFilterPopover/> (multi-select, ADR-0367 W7-W9) + <SavedTimelinesDropdown/>.
 * The row is always rendered when workspaceId is available.
 * SavedTimelinesDropdown is only interactive when a non-"all" scope is active.
 *
 * Spec ref: docs/superpowers/specs/2026-05-16-timeline-templates-design.md §Architecture
 * ADR ref:  ADR-0334, ADR-0367
 */

import {
  ScopeFilterPopover,
  type ScopeSelection,
  useDepartments,
  useLocations,
  useShiftsToday,
} from "@/components/day/ScopeFilterPopover";
import { SavedTimelinesDropdown } from "@/components/day/SavedTimelinesDropdown";
import {
  useDayTimelineScope,
  type DayTimelineScope,
} from "@/app/dashboard/_hooks/use-day-timeline-scope";
import type { TimelineTemplateItemT, ScopeTypeT } from "@smartout/types";

export type TimelineTopBarProps = {
  workspaceId: string;
  dateISO: string;
  ownDepartmentId: string | null;
  profileId: string;
  scope: DayTimelineScope;
  onScopeChange?: (next: DayTimelineScope) => void;
  departmentId: string | null;
  sessionId: string | null;
  /** Canvas items from TimelineTab draft-chips state. */
  canvasItems: TimelineTemplateItemT[];
};

// Resolve the scope_type and scope_id for the hooks (null when scope is "all")
function resolveScope(scope: DayTimelineScope): {
  scopeType: ScopeTypeT | null;
  scopeId: string | null;
} {
  if (scope.type === "all") return { scopeType: null, scopeId: null };
  return { scopeType: scope.type as ScopeTypeT, scopeId: scope.id };
}

export function TimelineTopBar({
  workspaceId,
  dateISO,
  // ownDepartmentId kept in props for future authority filtering on option lists
  ownDepartmentId: _ownDepartmentId,
  profileId: _profileId,
  scope,
  departmentId,
  sessionId,
  canvasItems,
}: TimelineTopBarProps) {
  const { scopeType, scopeId } = resolveScope(scope);

  // Multi-select filter state — persisted to URL via useDayTimelineScope.
  // Selection round-trips through ?scope_dept=...&scope_loc=...&scope_shift=...
  const { selection, setSelection } = useDayTimelineScope();

  // Fetch option lists — always enabled so the popover renders without delay.
  const deptsQuery = useDepartments(workspaceId, true);
  const locationsQuery = useLocations(workspaceId, true);
  const shiftsQuery = useShiftsToday(workspaceId, dateISO, true);

  const departments = (deptsQuery.data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
  }));
  const locations = (locationsQuery.data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
  }));
  const shifts = (shiftsQuery.data ?? []).map((s) => ({
    id: s.id,
    name: `${s.label} ${s.start}–${s.end}`,
  }));

  return (
    <div
      className="border-border bg-card flex items-center gap-2 border-b px-0 pb-2"
      data-testid="timeline-top-bar"
    >
      {/* Multi-select scope filter — left-aligned */}
      <ScopeFilterPopover
        selection={selection}
        onChange={setSelection}
        departments={departments}
        locations={locations}
        shifts={shifts}
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Saved Timelines Dropdown — right-aligned */}
      <SavedTimelinesDropdown
        workspaceId={workspaceId}
        scopeType={scopeType}
        scopeId={scopeId}
        dateISO={dateISO}
        departmentId={departmentId}
        sessionId={sessionId}
        canvasItems={canvasItems}
      />
    </div>
  );
}
