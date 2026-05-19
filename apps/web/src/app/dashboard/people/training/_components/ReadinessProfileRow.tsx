/**
 * ReadinessProfileRow.tsx
 *
 * Expandable row showing one profile's protocol readiness.
 * Collapsed: avatar + name + dept badge + readiness bar + count.
 * Expanded:  inline list of assigned protocols with status badges.
 *
 * Status color map mirrors CompetenceMatrix ProgressCell — duplicated here
 * intentionally to avoid a cross-hub import dependency (CompetenceMatrix
 * lives inside hms/_components and carries HMS-specific coupling).
 */
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { Badge } from "@/components/ui/badge";
import type {
  MatrixRow,
  ProtocolColumn,
  AssignmentStatus,
} from "@/app/dashboard/_hooks/use-workforce-readiness";

// ── Status color map ────────────────────────────────────────────────────────
// Matches CompetenceMatrix ProgressCell color logic — CSS variables only, no OKLCH literals.

const STATUS_COLORS: Record<AssignmentStatus, string> = {
  completed: "bg-success/15 text-success",
  expired: "bg-destructive/15 text-destructive",
  in_progress: "bg-primary/15 text-primary",
  pending: "bg-primary/15 text-primary",
  not_started: "bg-muted text-muted-foreground",
  waived: "bg-warning/15 text-warning",
  not_assigned: "",
};

// Sort order: expired → in_progress/pending → not_started → completed → waived
const STATUS_SORT_ORDER: Record<AssignmentStatus, number> = {
  expired: 0,
  in_progress: 1,
  pending: 2,
  not_started: 3,
  completed: 4,
  waived: 5,
  not_assigned: 6,
};

// ── Avatar initials ─────────────────────────────────────────────────────────

function ProfileAvatar({ name }: { name: string }) {
  const initial = name.trim()[0]?.toUpperCase() ?? "?";
  return (
    <div
      className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
      aria-hidden
    >
      {initial}
    </div>
  );
}

// ── Readiness bar ───────────────────────────────────────────────────────────

function ReadinessBar({ percent }: { percent: number }) {
  const colorClass = percent >= 80 ? "bg-success" : percent >= 40 ? "bg-warning" : "bg-destructive";

  return (
    <div
      className="bg-muted h-1.5 w-20 overflow-hidden rounded-full"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`${colorClass} h-full rounded-full transition-[width]`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

type Props = {
  row: MatrixRow;
  columns: ProtocolColumn[];
};

export function ReadinessProfileRow({ row, columns }: Props) {
  const { t } = useTranslation("dashboard");
  const [expanded, setExpanded] = useState(false);

  // Only protocols with a real assignment (not "not_assigned")
  const assignedEntries = columns
    .map((col) => ({ col, cell: row.protocols[col.protocolId] }))
    .filter(({ cell }) => cell && cell.status !== "not_assigned")
    .sort((a, b) => {
      const sa = STATUS_SORT_ORDER[a.cell!.status] ?? 99;
      const sb = STATUS_SORT_ORDER[b.cell!.status] ?? 99;
      return sa - sb;
    });

  const assignedCount = assignedEntries.length;
  const completedCount = assignedEntries.filter(({ cell }) => cell?.status === "completed").length;

  return (
    <li className="bg-card border-border rounded-xl border shadow-sm">
      {/* Collapsed row ── click anywhere to expand */}
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={expanded ? t("people.training.collapse_row") : t("people.training.expand_row")}
      >
        <ProfileAvatar name={row.profileName} />

        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-medium">{row.profileName}</p>
          {row.departmentName && (
            <p className="text-muted-foreground truncate text-[11px]">{row.departmentName}</p>
          )}
        </div>

        {/* Readiness bar + count */}
        <div className="flex shrink-0 items-center gap-2">
          <ReadinessBar percent={row.readinessPercent} />
          <span
            className={`font-mono text-xs font-bold tabular-nums ${
              row.readinessPercent >= 80
                ? "text-success"
                : row.readinessPercent >= 40
                  ? "text-warning"
                  : "text-destructive"
            }`}
          >
            {row.readinessPercent}%
          </span>
          <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
            {completedCount}/{assignedCount}
          </span>
          {expanded ? (
            <ChevronUp className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
          )}
        </div>
      </button>

      {/* Expanded protocol list */}
      {expanded && (
        <div className="border-border border-t px-4 pt-2 pb-3">
          {assignedEntries.length === 0 ? (
            <p className="text-muted-foreground py-2 text-sm">
              {t("people.training.no_assigned_protocols")}
            </p>
          ) : (
            <ul className="space-y-2">
              {assignedEntries.map(({ col, cell }) => {
                if (!cell) return null;
                const colorClass = STATUS_COLORS[cell.status] ?? "";
                const statusKey = `people.training.status_${cell.status}` as const;
                const statusLabel = t(statusKey as Parameters<typeof t>[0]);

                return (
                  <li key={col.protocolId} className="flex items-center gap-3">
                    <span className="text-foreground min-w-0 flex-1 truncate text-sm">
                      {col.protocolName}
                    </span>

                    {/* Progress bar for in-progress protocols */}
                    {(cell.status === "in_progress" || cell.status === "pending") &&
                      cell.progress && (
                        <div className="bg-muted h-1.5 w-16 shrink-0 overflow-hidden rounded-full">
                          <div
                            className="bg-primary h-full rounded-full transition-[width]"
                            style={{ width: `${cell.percent}%` }}
                          />
                        </div>
                      )}

                    <Badge className={`${colorClass} shrink-0 text-[11px]`}>{statusLabel}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
