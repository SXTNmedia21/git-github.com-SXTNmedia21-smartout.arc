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
 *   [FilterChip onlyOpen] [FilterChip deviations+count] |
 *   [Bruk mal chip] | [zoom − +] | [Akkurat nå pulse-button]
 *
 * Prototype parity:
 *   "Bruk mal" — opens ApplyTemplateModal via onApplyTemplate prop.
 *   "Akkurat nå · HH:MM" — pulse-dot button that scrolls chart to nowMinutes.
 *   Both emit telemetry (L-0176 hard rule: registry-entry + emit-site same commit).
 *
 * Motion:
 *   Pulse dot uses framer-motion with motionTokens.springGentle (30/20/2.5).
 *   useReducedMotion() gating follows the single-tree pattern from NowLine.tsx
 *   (commit 376567a39) — no DOM-structure branching on reduced-motion preference.
 *
 * Design: Nordic Split tokens only — no OKLCH literals, no zinc/gray/slate.
 * Icons: Lucide React only (ZoomIn, ZoomOut, BookOpen).
 * ARIA: zoom + now-button have aria-label for keyboard users (WCAG 2.4.11).
 */

import { motion } from "framer-motion";
import { useReducedMotion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import { ZoomIn, ZoomOut, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentGroup, FilterChip } from "@smartout/ui";
import { useTranslation } from "@smartout/i18n";
import { emit, nonEmpty } from "@smartout/telemetry";
import { minToHM } from "../_chart/timeMath";
import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspaceOptional } from "@/lib/workspace-context";

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
  /** Current time in absolute minutes — shown in the "Akkurat nå" button label. */
  nowMinutes: number;
  /** Callback to scroll the chart body to the current time position. */
  scrollToNow?: () => void;
  /** Callback to open the ApplyTemplateModal. */
  onApplyTemplate?: () => void;
};

// ── Pulse dot variants (single tree — no DOM branching on reduced-motion) ────

const pulseVariants = {
  idle: { opacity: 1, scale: 1 },
  pulse: {
    opacity: [1, 0.5, 1],
    scale: [1, 1.3, 1],
  },
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
  nowMinutes,
  scrollToNow,
  onApplyTemplate,
}: TimelineToolbarProps) {
  const { t } = useTranslation("oppgaver");
  const wsCtx = useWorkspaceOptional();
  const workspaceId = wsCtx?.workspace.workspace_id ?? null;
  const { profileId } = useContext(DashboardContext);

  // Single-tree reduced-motion pattern (NowLine.tsx commit 376567a39):
  // null on SSR + first render, boolean after media-query mounts.
  // Gating DOM structure on this value causes hydration mismatch.
  // Only the framer-motion `animate` target changes post-hydration.
  const prefersReducedMotion = useReducedMotion();

  const viewSegments = [
    { value: "area" as const, label: t("view_mode.area") },
    { value: "role" as const, label: t("view_mode.role") },
    { value: "person" as const, label: t("view_mode.person") },
  ];

  function handleApplyTemplate() {
    onApplyTemplate?.();
    // L-0176: emit registered event at call-site (registry entry same commit).
    if (workspaceId && profileId) {
      void emit({
        event: "oppgaver.template_apply_clicked",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {},
      });
    }
  }

  function handleScrollToNow() {
    scrollToNow?.();
    // L-0176: emit registered event at call-site (registry entry same commit).
    if (workspaceId && profileId) {
      void emit({
        event: "oppgaver.pulse_now_clicked",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          data: { nowMinutes },
        },
      });
    }
  }

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

      {/* ── "Bruk mal" chip ───────────────────────────────────────────── */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleApplyTemplate}
        className="text-muted-foreground hover:text-foreground h-7 gap-1.5 px-2.5 text-xs"
      >
        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
        {t("use_template")}
      </Button>

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

      {/* ── "Akkurat nå" pulse-button ─────────────────────────────────── */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleScrollToNow}
        aria-label={`${t("now_btn_aria")} (${minToHM(nowMinutes)})`}
        data-testid="now-pulse-button"
        className="text-muted-foreground hover:text-foreground relative h-7 gap-1.5 px-2.5 text-xs"
      >
        {/* Pulse dot — single-tree pattern: animate target switches, DOM stays constant. */}
        <span className="relative flex h-2 w-2 shrink-0">
          <motion.span
            className="bg-warning absolute inset-0 rounded-full"
            variants={pulseVariants}
            initial="idle"
            animate={prefersReducedMotion ? "idle" : "pulse"}
            transition={{
              type: "spring",
              ...motionTokens.springGentle,
              duration: 2,
              repeat: Infinity,
            }}
          />
        </span>
        {t("now_label")} · {minToHM(nowMinutes)}
      </Button>
    </div>
  );
}
