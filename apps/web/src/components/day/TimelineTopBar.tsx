"use client";

/**
 * TimelineTopBar — thin row above the DayTimelineStrip.
 *
 * Composes <ScopeFilterPill/> + <SavedTimelinesDropdown/>.
 * The row is always rendered when workspaceId is available.
 * SavedTimelinesDropdown is only interactive when a non-"all" scope is active.
 *
 * Spec ref: docs/superpowers/specs/2026-05-16-timeline-templates-design.md §Architecture
 * ADR ref:  ADR-0334
 */

import { ScopeFilterPill } from "@/components/day/ScopeFilterPill";
import { SavedTimelinesDropdown } from "@/components/day/SavedTimelinesDropdown";
import type { DayTimelineScope } from "@/app/dashboard/_hooks/use-day-timeline-scope";
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
  ownDepartmentId,
  profileId,
  scope,
  departmentId,
  sessionId,
  canvasItems,
}: TimelineTopBarProps) {
  const { scopeType, scopeId } = resolveScope(scope);

  return (
    <div
      className="border-border bg-card flex items-center gap-2 border-b px-0 pb-2"
      data-testid="timeline-top-bar"
    >
      {/* Scope filter — left-aligned */}
      <ScopeFilterPill
        workspaceId={workspaceId}
        dateISO={dateISO}
        ownDepartmentId={ownDepartmentId}
        profileId={profileId}
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
