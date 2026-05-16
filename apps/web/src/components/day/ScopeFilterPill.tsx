"use client";

/**
 * ScopeFilterPill — compact header button showing the active Dagslinjen scope.
 *
 * Displays the current filter (e.g. "Team: Lørdag PM" or "Alle") and opens
 * ScopeFilterPopoverContent on click. Emits telemetry on scope changes.
 * Spring physics via motionTokens.springSnappy per Nordic Split spec.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Filter, X } from "lucide-react";
import { motion as motionTokens } from "@smartout/design-tokens";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TooltipProvider } from "@/components/ui/tooltip";
import { emit, nonEmpty } from "@smartout/telemetry";
import {
  useDayTimelineScope,
  type DayTimelineScope,
} from "@/app/dashboard/_hooks/use-day-timeline-scope";
import { ScopeFilterPopoverContent } from "@/components/day/ScopeFilterPopover";
import { useWorkspaceOptional } from "@/lib/workspace-context";

// ─── Helpers ─────────────────────────────────────────────

function scopeLabel(scope: DayTimelineScope): string {
  if (scope.type === "all") return "Alle";
  // Labels are resolved in ScopeFilterPopover; pill just shows type until
  // a richer lookup is available. The popover is the source of name data.
  const prefixMap: Record<string, string> = {
    department: "Avdeling",
    team: "Team",
    location: "Lokasjon",
    shift: "Vakt",
  };
  return `${prefixMap[scope.type] ?? scope.type}: …`;
}

// ─── Props ────────────────────────────────────────────────

type ScopeFilterPillProps = {
  workspaceId: string;
  dateISO: string;
  /** When non-null: manager authority — hide other depts. Null = admin/owner. */
  ownDepartmentId: string | null;
  /** Profile ID used for telemetry actor_id. */
  profileId: string;
};

// ─── Component ────────────────────────────────────────────

export function ScopeFilterPill({
  workspaceId,
  dateISO,
  ownDepartmentId,
  profileId,
}: ScopeFilterPillProps) {
  const [open, setOpen] = useState(false);
  const { scope, setScope } = useDayTimelineScope();
  const wsCtx = useWorkspaceOptional();
  const wsId = workspaceId || wsCtx?.workspace.workspace_id;

  const isFiltered = scope.type !== "all";

  function handleScopeChange(next: DayTimelineScope) {
    const from = scope;
    setScope(next);
    setOpen(false);

    // Skip telemetry if we don't have workspace or profile yet
    if (!wsId || !profileId) return;
    void emit({
      event: "ui.dagslinjen.scope_filter_changed",
      workspace_id: nonEmpty(wsId, "workspace_id"),
      actor_id: nonEmpty(profileId, "actor_id"),
      properties: {
        data: {
          from: from.type === "all" ? "all" : `${from.type}:${from.id}`,
          to: next.type === "all" ? "all" : `${next.type}:${next.id}`,
        },
      },
    });
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    handleScopeChange({ type: "all" });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={[
            "flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
            isFiltered
              ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
              : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
          ].join(" ")}
          aria-label="Filtrer Dagslinjen"
          data-testid="scope-filter-pill"
        >
          <Filter className="h-3.5 w-3.5 flex-shrink-0" />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={scope.type === "all" ? "all" : `${scope.type}:${scope.id}`}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{
                type: "spring",
                ...motionTokens.springSnappy,
              }}
              className="max-w-32 truncate"
            >
              {scopeLabel(scope)}
            </motion.span>
          </AnimatePresence>
          {isFiltered && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => e.key === "Enter" && handleClear(e as unknown as React.MouseEvent)}
              className="hover:text-foreground ml-0.5 cursor-pointer"
              aria-label="Nullstill filter"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" sideOffset={8} className="p-3">
        <TooltipProvider>
          {wsId ? (
            <ScopeFilterPopoverContent
              workspaceId={wsId}
              dateISO={dateISO}
              ownDepartmentId={ownDepartmentId}
              scope={scope}
              onScopeChange={handleScopeChange}
            />
          ) : (
            <p className="text-muted-foreground text-xs">Laster…</p>
          )}
        </TooltipProvider>
      </PopoverContent>
    </Popover>
  );
}
