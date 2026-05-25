"use client";

/**
 * TimelineToolbar — secondary toolbar for the Manager Timeline (Dagslinjen) page.
 *
 * WHY: Centralises all filter + view-mode controls in one horizontal bar so
 * ManagerTimelineShell can keep its layout concerns separate from interactive
 * state. Consumes SegmentGroup (view-mode switcher) + FilterChip (boolean
 * filters + area pills) from @smartout/ui primitives.
 *
 * Layout (left → right):
 *   [SegmentGroup view-mode] | [Area pills — wrapping flex] | spacer |
 *   [FilterChip onlyOpen] [FilterChip deviations+count] | [zoom − +]
 *
 * Design: Nordic Split tokens only — no OKLCH literals, no zinc/gray/slate.
 * Icons: Lucide React only (ZoomIn, ZoomOut).
 * ARIA: zoom buttons have aria-label for keyboard users (WCAG 2.4.11).
 */

import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentGroup, FilterChip } from "@smartout/ui";
import { useTranslation } from "@smartout/i18n";

// ── Types ────────────────────────────────────────────────────────────────────

export type ViewMode = "area" | "role" | "person";

export type AreaChip = {
  id: string;
  label: string;
};

export type TimelineToolbarProps = {
  viewMode: ViewMode;
  onViewModeChange: (next: ViewMode) => void;
  areas: ReadonlyArray<AreaChip>;
  activeAreaIds: ReadonlyArray<string>;
  onToggleArea: (areaId: string) => void;
  onlyOpen: boolean;
  onToggleOnlyOpen: () => void;
  deviationsOnly: boolean;
  deviationsCount: number;
  onToggleDeviations: () => void;
  zoom: number;
  onZoomChange: (next: number) => void;
};

// ── Component ────────────────────────────────────────────────────────────────

export function TimelineToolbar({
  viewMode,
  onViewModeChange,
  areas,
  activeAreaIds,
  onToggleArea,
  onlyOpen,
  onToggleOnlyOpen,
  deviationsOnly,
  deviationsCount,
  onToggleDeviations,
  zoom,
  onZoomChange,
}: TimelineToolbarProps) {
  const { t } = useTranslation("oppgaver");

  const viewSegments = [
    { value: "area" as const, label: t("view_mode.area") },
    { value: "role" as const, label: t("view_mode.role") },
    { value: "person" as const, label: t("view_mode.person") },
  ];

  return (
    <div
      role="toolbar"
      aria-label={t("toolbar_aria")}
      className="border-border bg-card flex h-full flex-wrap items-center gap-2 border-b px-4 py-2"
    >
      {/* ── View-mode switcher ──────────────────────────────────────── */}
      <SegmentGroup
        value={viewMode}
        onValueChange={onViewModeChange}
        segments={viewSegments}
        size="sm"
      />

      {/* ── Vertical divider ──────────────────────────────────────────── */}
      <div className="bg-border mx-1 h-5 w-px shrink-0" aria-hidden="true" />

      {/* ── Area filter chips ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5">
        {areas.map((area) => (
          <FilterChip
            key={area.id}
            label={area.label}
            active={activeAreaIds.includes(area.id)}
            onToggle={() => onToggleArea(area.id)}
          />
        ))}
      </div>

      {/* ── Spacer ───────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Boolean filter chips ──────────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        <FilterChip label={t("filter.only_open")} active={onlyOpen} onToggle={onToggleOnlyOpen} />

        <FilterChip
          label={t("filter.deviations")}
          active={deviationsOnly}
          onToggle={onToggleDeviations}
          count={deviationsCount}
          tone="destructive"
        />
      </div>

      {/* ── Vertical divider ──────────────────────────────────────────── */}
      <div className="bg-border mx-1 h-5 w-px shrink-0" aria-hidden="true" />

      {/* ── Zoom cluster ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("zoom_out_aria")}
          onClick={() => onZoomChange(zoom - 1)}
          className="text-muted-foreground hover:text-foreground h-7 w-7 p-0"
        >
          <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          aria-label={t("zoom_in_aria")}
          onClick={() => onZoomChange(zoom + 1)}
          className="text-muted-foreground hover:text-foreground h-7 w-7 p-0"
        >
          <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
