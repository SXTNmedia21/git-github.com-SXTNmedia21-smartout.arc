"use client";

import { useState, useEffect, useRef, useContext } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import { Filter } from "lucide-react";
import { cn } from "@smartout/ui";
import { emit, nonEmpty } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import type { DayEvent, DayEventType } from "@/app/dashboard/_hooks/use-day-timeline-events";
import type { SelectionSource } from "./use-timeline-selection";
import { EVENT_TYPE_META, EVENT_FILTER_KEYS } from "./event-types";

// Build filter pills from the shared filter-key order.
// filterLabel carries the Norwegian plural form (e.g. "Bookinger") for pill display.
const FILTERS: { key: DayEventType | "all"; label: string }[] = EVENT_FILTER_KEYS.map((k) =>
  k === "all"
    ? { key: "all" as const, label: "Alle" }
    : { key: k, label: EVENT_TYPE_META[k].filterLabel },
);

export type DayEventListProps = {
  events: DayEvent[];
  highlightedId?: string | null;
  onEventClick?: (event: DayEvent) => void;
  /** Which surface triggered the current selection — "strip" → pulse list row + scroll. */
  pulseSource?: SelectionSource;
  /** Department id — passed through to telemetry. */
  departmentId?: string;
  /** Session id — passed through to telemetry. */
  sessionId?: string;
};

export function DayEventList({
  events,
  highlightedId,
  onEventClick,
  pulseSource,
  departmentId,
  sessionId,
}: DayEventListProps) {
  const [filter, setFilter] = useState<DayEventType | "all">("all");
  const reduceMotion = useReducedMotion();
  const dashCtx = useContext(DashboardContext);
  const wsCtx = useWorkspaceOptional();
  const profileId = dashCtx.profileId;
  const workspaceId = wsCtx?.workspace.workspace_id;
  // Ref map for scroll-into-view on strip-click
  const itemRefs = useRef<Record<string, HTMLLIElement | null>>({});

  const filtered = filter === "all" ? events : events.filter((e) => e.type === filter);

  // Scroll highlighted row into view when selection comes from the strip marker
  useEffect(() => {
    if (!highlightedId || pulseSource !== "strip") return;
    const el = itemRefs.current[highlightedId];
    if (el) el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
  }, [highlightedId, pulseSource, reduceMotion]);

  return (
    <div className="bg-card border-border relative overflow-hidden rounded-2xl border p-5 shadow-sm">
      <div className="relative z-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-foreground text-sm font-bold tracking-tight">Hendelser i dag</h3>
          <div
            role="group"
            aria-label="Filter hendelser etter type"
            className="bg-muted/60 border-border inline-flex items-center gap-0.5 rounded-lg border p-0.5"
          >
            <Filter className="text-muted-foreground ml-1.5 h-3 w-3" aria-hidden />
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-semibold transition-all",
                  filter === f.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-[13px]">
            Ingen hendelser i denne kategorien.
          </div>
        ) : (
          <ul className="grid gap-2">
            {filtered.map((e) => {
              const meta = EVENT_TYPE_META[e.type];
              const Icon = meta.icon;
              const isHighlighted = highlightedId === e.id;
              const shouldPulse = isHighlighted && pulseSource === "strip";
              // Key bump forces remount → re-fires boxShadow keyframe on repeated strip-clicks
              const motionKey = shouldPulse ? `row-${e.id}-pulse-${Date.now()}` : `row-${e.id}`;
              return (
                <motion.li
                  key={motionKey}
                  ref={(el) => {
                    itemRefs.current[e.id] = el;
                  }}
                  initial={false}
                  animate={
                    shouldPulse && !reduceMotion
                      ? {
                          boxShadow: [
                            "0 0 0 0px var(--ring)",
                            "0 0 0 4px var(--ring)",
                            "0 0 0 2px var(--ring)",
                          ],
                        }
                      : isHighlighted
                        ? { boxShadow: "0 0 0 2px var(--ring)" }
                        : { boxShadow: "0 0 0 0px var(--ring)" }
                  }
                  transition={
                    shouldPulse && !reduceMotion
                      ? { duration: 1.2, ease: motionTokens.easingArray }
                      : { type: "spring", ...motionTokens.springSnappy }
                  }
                  className="rounded-xl"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onEventClick?.(e);
                      // Emit telemetry — guard: only when IDs present (ADR-0134)
                      if (workspaceId && profileId) {
                        void emit({
                          event: "ui.dagslinjen.list_row_clicked",
                          workspace_id: nonEmpty(workspaceId, "workspace_id"),
                          actor_id: nonEmpty(profileId, "actor_id"),
                          properties: {
                            data: {
                              eventId: e.id,
                              eventTypeKind: e.type,
                              departmentId: departmentId ?? "",
                              sessionId: sessionId ?? "",
                              time: e.time,
                              filterActive: filter,
                            },
                          },
                        });
                      }
                    }}
                    className={cn(
                      "border-border bg-background hover:bg-muted/40 group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
                      "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                    )}
                  >
                    <span className="text-muted-foreground w-12 shrink-0 font-mono text-[12px] tabular-nums">
                      {e.time}
                    </span>
                    <span
                      className={cn(
                        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                        meta.listBg,
                        meta.listBorder,
                      )}
                    >
                      <Icon className={cn("h-4 w-4", meta.listIconColor)} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span
                          className={cn(
                            "truncate text-[13px] font-semibold",
                            e.done && "line-through opacity-60",
                          )}
                        >
                          {e.title}
                        </span>
                      </div>
                      {e.subtitle ? (
                        <div className="text-muted-foreground truncate text-[11px]">
                          {e.subtitle}
                        </div>
                      ) : null}
                    </div>
                    <span
                      aria-hidden="true"
                      className="text-muted-foreground shrink-0 text-[10px] font-bold tracking-[0.12em] uppercase"
                    >
                      {meta.label}
                    </span>
                  </button>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
