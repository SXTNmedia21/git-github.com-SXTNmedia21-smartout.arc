"use client";

import { useMemo, useState, useContext } from "react";
import type React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@smartout/ui";
import { emit, nonEmpty } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import type { DayEvent, DayEventType } from "@/app/dashboard/_hooks/use-day-timeline-events";
import type { SelectionSource } from "./use-timeline-selection";
import { EVENT_TYPE_META, EVENT_TYPE_ORDER, type ShapeKind } from "./event-types";
import { ClusterMarker } from "./ClusterMarker";

const SPARSE_THRESHOLD = 4; // events within bounds at/below this → auto-zoom near now
const ZOOM_HALF_WINDOW = 180; // minutes either side of now

export type DayTimelineStripProps = {
  events: DayEvent[];
  /** Session start HH:MM. If null, falls back to 06:00. */
  startHHMM: string | null;
  /** Session end HH:MM. If null, falls back to "next day 02:00". */
  endHHMM: string | null;
  /** ISO date for "now" calculation when same day. */
  dateISO: string;
  /** Click an event marker → drill to row. */
  onSelect?: (event: DayEvent) => void;
  /**
   * When true, the time axis becomes interactive: invisible 15-min hit-zones
   * appear on hover (guide-line + pointer cursor) and clicking fires onSlotClick.
   * Defaults to false — read-only contract preserved for existing consumers.
   */
  editable?: boolean;
  /**
   * Called with the resolved HH:MM string when a time-axis slot is clicked.
   * Second arg is the clicked button's bounding rect, so the caller can
   * anchor a popover at the click point. Only fires when editable=true.
   */
  onSlotClick?: (timeHHMM: string, rect: DOMRect) => void;
  /** The currently selected event id — drives selection ring on the matching marker. */
  highlightedId?: string | null;
  /** Which surface triggered the current selection — "list" → pulse marker. */
  pulseSource?: SelectionSource;
  /**
   * Department ID — passed through to telemetry and ClusterMarker.
   * Required for ui.dagslinjen.cluster_expanded (ADR-0134).
   */
  departmentId?: string;
  /**
   * Session ID — passed through to telemetry and ClusterMarker.
   */
  sessionId?: string;
  /**
   * Phase boundaries in minute-of-day space. When provided, renders three
   * subtle phase-tint bands between the background bar and now-marker.
   * Computed by getPhaseBoundaries() from @smartout/utils.
   * null = session bounds missing; undefined = not yet computed.
   */
  phaseBoundaries?: {
    prep: [number, number];
    service: [number, number];
    windDown: [number, number];
  } | null;
};

// ShapeKind is imported from ./event-types above; used by the Marker component below.

function minutesToHHMM(m: number): string {
  const wrapped = ((m % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const mm = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function timeToMinutes(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const parts = hhmm.split(":").map(Number);
  const h = parts[0];
  const m = parts[1] ?? 0;
  if (h === undefined || Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function Marker({
  shape,
  fill,
  ring,
  iconColor,
  Icon,
}: {
  shape: ShapeKind;
  fill: string;
  ring: string;
  iconColor: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
}) {
  if (shape === "dot") {
    return (
      <span
        className={cn(
          "border-background flex h-5 w-5 items-center justify-center rounded-full border-2 shadow-sm ring-4",
          fill,
          ring,
        )}
      >
        <Icon className={cn("h-2.5 w-2.5", iconColor)} />
      </span>
    );
  }
  if (shape === "ring") {
    return (
      <span
        className={cn(
          "border-background flex h-5 w-5 items-center justify-center rounded-full border-2 shadow-sm",
          fill,
          "ring-2",
          ring,
        )}
      >
        <Icon className={cn("h-2.5 w-2.5", iconColor)} />
      </span>
    );
  }
  if (shape === "diamond") {
    return (
      <span
        className={cn(
          "border-background flex h-5 w-5 rotate-45 items-center justify-center border-2 shadow-sm",
          fill,
          "ring-2",
          ring,
        )}
      >
        <Icon className={cn("h-2.5 w-2.5 -rotate-45", iconColor)} />
      </span>
    );
  }
  if (shape === "flag") {
    // Right-pointing rectangle: pin at left edge, content extends right
    return (
      <span
        className={cn(
          "border-background flex h-5 w-6 items-center justify-center rounded-l-sm rounded-r-md border-2 shadow-sm",
          fill,
          "ring-2",
          ring,
        )}
      >
        <Icon className={cn("h-2.5 w-2.5", iconColor)} />
      </span>
    );
  }
  if (shape === "arrow-down") {
    return (
      <span
        className={cn(
          "border-background relative flex h-5 w-5 items-center justify-center rounded-t-md border-2 shadow-sm",
          fill,
          "ring-2",
          ring,
        )}
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%)" }}
      >
        <Icon className={cn("h-2.5 w-2.5", iconColor)} />
      </span>
    );
  }
  // arrow-up
  return (
    <span
      className={cn(
        "border-background relative flex h-5 w-5 items-center justify-center rounded-b-md border-2 shadow-sm",
        fill,
        "ring-2",
        ring,
      )}
      style={{ clipPath: "polygon(50% 0, 100% 40%, 100% 100%, 0 100%, 0 40%)" }}
    >
      <Icon className={cn("h-2.5 w-2.5", iconColor)} />
    </span>
  );
}

export function DayTimelineStrip({
  events,
  startHHMM,
  endHHMM,
  dateISO,
  onSelect,
  editable = false,
  onSlotClick,
  highlightedId,
  pulseSource,
  departmentId = "",
  sessionId = "",
  phaseBoundaries,
}: DayTimelineStripProps) {
  const reduceMotion = useReducedMotion();
  const dashCtx = useContext(DashboardContext);
  const wsCtx = useWorkspaceOptional();
  const profileId = dashCtx.profileId;
  const workspaceId = wsCtx?.workspace.workspace_id;

  // Session bounds — the full operating window.
  const boundsStart = timeToMinutes(startHHMM) ?? 6 * 60;
  let boundsEnd = timeToMinutes(endHHMM) ?? 26 * 60;
  if (boundsEnd <= boundsStart) boundsEnd += 24 * 60;

  // Now marker (computed against bounds — visible-window decision uses this).
  const now = new Date();
  const todayISO = now.toISOString().slice(0, 10);
  const isToday = todayISO === dateISO;
  const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() : null;

  // Normalise events to absolute minutes within bounds (handles post-midnight).
  const normalised = useMemo(
    () =>
      events
        .map((e) => {
          const m = timeToMinutes(e.time);
          if (m == null) return null;
          let normM = m;
          if (normM < boundsStart && normM + 24 * 60 <= boundsEnd) normM += 24 * 60;
          if (normM < boundsStart || normM > boundsEnd) return null;
          let normEnd: number | null = null;
          if (e.endTime) {
            const em = timeToMinutes(e.endTime);
            if (em != null) {
              let nem = em;
              if (nem < boundsStart && nem + 24 * 60 <= boundsEnd) nem += 24 * 60;
              if (nem >= boundsStart && nem <= boundsEnd) normEnd = nem;
            }
          }
          return { event: e, normM, normEnd };
        })
        .filter((x): x is { event: DayEvent; normM: number; normEnd: number | null } => x !== null)
        .sort((a, b) => a.normM - b.normM),
    [events, boundsStart, boundsEnd],
  );

  // Zoom mode — "auto" means: today + sparse + now-in-bounds → zoom near now.
  const [zoomMode, setZoomMode] = useState<"auto" | "full">("auto");

  const isSparse = normalised.length <= SPARSE_THRESHOLD;
  const nowInBounds = nowMin != null && nowMin >= boundsStart && nowMin <= boundsEnd;
  const shouldZoom = zoomMode === "auto" && isSparse && nowInBounds;

  let visibleStart = boundsStart;
  let visibleEnd = boundsEnd;
  if (shouldZoom && nowMin != null) {
    // Snap window to 30-min boundaries for clean ticks.
    const rawStart = Math.max(boundsStart, nowMin - ZOOM_HALF_WINDOW);
    const rawEnd = Math.min(boundsEnd, nowMin + ZOOM_HALF_WINDOW);
    visibleStart = Math.floor(rawStart / 30) * 30;
    visibleEnd = Math.ceil(rawEnd / 30) * 30;
    // Re-clamp after snapping.
    if (visibleStart < boundsStart) visibleStart = boundsStart;
    if (visibleEnd > boundsEnd) visibleEnd = boundsEnd;
  }
  const span = visibleEnd - visibleStart;

  // Hour ticks — interval adapts to visible span.
  const tickInterval = span <= 8 * 60 ? 60 : 120;
  const ticks: { min: number; label: string }[] = [];
  for (let m = Math.ceil(visibleStart / 60) * 60; m <= visibleEnd; m += tickInterval) {
    const h = Math.floor((m % (24 * 60)) / 60);
    ticks.push({
      min: m - visibleStart,
      label: `${String(h).padStart(2, "0")}:00`,
    });
  }

  const nowPct =
    nowInBounds && nowMin! >= visibleStart && nowMin! <= visibleEnd
      ? ((nowMin! - visibleStart) / span) * 100
      : null;

  // Position events using visible window. Events outside window counted for edge pills.
  let offscreenLeft = 0;
  let offscreenRight = 0;
  const positioned = normalised
    .map(({ event, normM, normEnd }) => {
      if (normM < visibleStart) {
        offscreenLeft += 1;
        return null;
      }
      if (normM > visibleEnd) {
        offscreenRight += 1;
        return null;
      }
      const pct = ((normM - visibleStart) / span) * 100;
      let pctEnd: number | null = null;
      if (normEnd != null && normEnd >= visibleStart && normEnd <= visibleEnd) {
        pctEnd = ((normEnd - visibleStart) / span) * 100;
      }
      return { event, pct, pctEnd };
    })
    .filter((x): x is { event: DayEvent; pct: number; pctEnd: number | null } => x !== null);
  // Keep backwards-compat names below (startMin/endMin) so following hit-zone code untouched.
  const startMin = visibleStart;
  const endMin = visibleEnd;

  // ─── Cluster pre-processing ───────────────────────────────────────────────
  // Group positioned entries by 15-min bucket. Buckets with 2+ events collapse
  // to a ClusterMarker; buckets with 1 event remain as normal markers.
  const CLUSTER_BUCKET_MIN = 15;
  type ClusterBucket = {
    bucketIdx: number;
    startMin: number;
    endMin: number;
    entries: typeof positioned;
    pct: number; // center pct of the bucket's first entry (anchor)
  };

  const bucketMap = new Map<number, typeof positioned>();
  for (const p of positioned) {
    // Reconstruct normM from pct: normM = startMin + (pct/100)*span
    const normM = startMin + (p.pct / 100) * span;
    const bucketKey = Math.floor((normM - startMin) / CLUSTER_BUCKET_MIN);
    const bucket = bucketMap.get(bucketKey) ?? [];
    bucket.push(p);
    bucketMap.set(bucketKey, bucket);
  }

  const clusters: ClusterBucket[] = [];
  const singlesPositioned: typeof positioned = [];

  for (const [key, entries] of bucketMap.entries()) {
    if (entries.length >= 2) {
      const bucketStartAbsMin = startMin + key * CLUSTER_BUCKET_MIN;
      const bucketEndAbsMin = bucketStartAbsMin + CLUSTER_BUCKET_MIN;
      clusters.push({
        bucketIdx: key,
        startMin: bucketStartAbsMin,
        endMin: bucketEndAbsMin,
        entries,
        pct: entries[0]?.pct ?? 0,
      });
    } else if (entries[0]) {
      singlesPositioned.push(entries[0]);
    }
  }

  // Lane assignment for singles only — clusters get their own marker.
  const LANES = 3;
  const laneTails: number[] = [-100, -100, -100];
  const withLanes = singlesPositioned.map((p) => {
    let lane = 0;
    for (let i = 0; i < LANES; i++) {
      if (p.pct - (laneTails[i] ?? -100) > 2) {
        lane = i;
        break;
      }
      if (i === LANES - 1) lane = 0;
    }
    laneTails[lane] = p.pct;
    return { ...p, lane };
  });

  // 15-min hit-zones for editable mode.
  // Each zone covers one 15-min slot; clicking resolves the nearest HH:MM.
  const SLOT_INTERVAL = 15; // minutes
  const slots: { min: number; pct: number; label: string }[] = [];
  if (editable) {
    // Round startMin up to the nearest 15-min boundary
    const firstSlot = Math.ceil(startMin / SLOT_INTERVAL) * SLOT_INTERVAL;
    for (let m = firstSlot; m <= endMin; m += SLOT_INTERVAL) {
      const absMin = m % (24 * 60);
      const h = Math.floor(absMin / 60);
      const min = absMin % 60;
      const label = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      const pct = ((m - startMin) / span) * 100;
      if (pct >= 0 && pct <= 100) {
        slots.push({ min: m, pct, label });
      }
    }
  }

  return (
    <div className="bg-card border-border relative overflow-hidden rounded-2xl border p-5 shadow-sm">
      <div className="relative z-10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-foreground text-sm font-bold tracking-tight">Dagslinjen</h3>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
              {minutesToHHMM(visibleStart)}–{minutesToHHMM(visibleEnd)}
            </span>
            {nowInBounds && isSparse && (
              <button
                type="button"
                onClick={() => setZoomMode((m) => (m === "auto" ? "full" : "auto"))}
                className={cn(
                  "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase transition-colors",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                )}
                aria-label={zoomMode === "auto" ? "Vis hele dagen" : "Zoom inn på nå"}
              >
                {zoomMode === "auto" ? "Hele dagen" : "Nær nå"}
              </button>
            )}
          </div>
        </div>

        {/* Track */}
        <div className={cn("relative h-24 select-none", editable && "cursor-crosshair")}>
          {/* Background bar */}
          <div className="border-border bg-muted/40 absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full border" />

          {/* Off-screen counters (auto-zoom only) */}
          {offscreenLeft > 0 && (
            <button
              type="button"
              onClick={() => setZoomMode("full")}
              className="bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground border-border focus-visible:ring-ring absolute top-1/2 left-1 z-20 flex -translate-y-1/2 items-center gap-0.5 rounded-full border px-1.5 py-0.5 font-mono text-[10px] tabular-nums shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
              aria-label={`${offscreenLeft} hendelser før dette vinduet — vis hele dagen`}
            >
              <ChevronLeft className="h-3 w-3" aria-hidden />
              {offscreenLeft}
            </button>
          )}
          {offscreenRight > 0 && (
            <button
              type="button"
              onClick={() => setZoomMode("full")}
              className="bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground border-border focus-visible:ring-ring absolute top-1/2 right-1 z-20 flex -translate-y-1/2 items-center gap-0.5 rounded-full border px-1.5 py-0.5 font-mono text-[10px] tabular-nums shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
              aria-label={`${offscreenRight} hendelser etter dette vinduet — vis hele dagen`}
            >
              {offscreenRight}
              <ChevronRight className="h-3 w-3" aria-hidden />
            </button>
          )}

          {/* Phase tinting — three bands rendered between background bar and now-marker.
              Only rendered when phaseBoundaries is provided (calculated in TimelineTab). */}
          {phaseBoundaries != null && (
            <>
              {(
                [
                  ["prep", phaseBoundaries.prep, "var(--color-phase-prep)"] as const,
                  ["service", phaseBoundaries.service, "var(--color-phase-service)"] as const,
                  ["winddown", phaseBoundaries.windDown, "var(--color-phase-winddown)"] as const,
                ] as const
              ).map(([key, [rangeStart, rangeEnd], color]) => {
                // Skip degenerate bands or those fully outside visible range.
                if (rangeEnd <= rangeStart) return null;
                if (rangeEnd < startMin || rangeStart > endMin) return null;
                const clampedStart = Math.max(rangeStart, startMin);
                const clampedEnd = Math.min(rangeEnd, endMin);
                const leftPct = ((clampedStart - startMin) / span) * 100;
                const widthPct = ((clampedEnd - clampedStart) / span) * 100;
                return (
                  <div
                    key={key}
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      height: 8,
                      top: "50%",
                      transform: "translateY(2px)",
                      backgroundColor: color,
                      opacity: 0.4,
                      borderRadius: 4,
                    }}
                  />
                );
              })}
            </>
          )}

          {/* Now marker */}
          {nowPct != null ? (
            <div
              className="absolute top-2 bottom-2 z-[1] w-0.5 rounded-full bg-orange-500/80"
              style={{ left: `${nowPct}%` }}
              role="img"
              aria-label={`Klokken er nå ${minutesToHHMM(nowMin!)}`}
            >
              <span
                className={cn(
                  "absolute -top-1 left-1/2 inline-block h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-orange-500 shadow-md ring-2 ring-orange-200 dark:ring-orange-900/50",
                  !reduceMotion && "animate-pulse",
                )}
              />
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 rounded-sm bg-orange-500 px-1 py-px font-mono text-[9px] font-bold tracking-wider text-white tabular-nums shadow-sm">
                NÅ {minutesToHHMM(nowMin!)}
              </span>
            </div>
          ) : null}

          {/* Hour ticks */}
          {ticks.map((t) => {
            const pct = (t.min / span) * 100;
            return (
              <div
                key={t.label}
                className="absolute top-1/2 -translate-y-1/2"
                style={{ left: `${pct}%` }}
              >
                <span
                  aria-hidden
                  className="bg-border/60 absolute top-0 h-2 w-px -translate-x-1/2"
                />
                <span className="text-muted-foreground/60 absolute top-3 -translate-x-1/2 font-mono text-[10px] tabular-nums">
                  {t.label}
                </span>
              </div>
            );
          })}

          {/* 15-min click-to-add hit-zones (editable mode only).
              Invisible full-height buttons spaced every 15 min.
              On hover: thin guide-line + cursor hint.
              Rendered BEHIND event markers so markers remain interactive. */}
          {editable &&
            slots.map((slot, idx) => {
              // Each zone occupies from this slot's pct to the next slot's pct
              const nextPct = slots[idx + 1]?.pct ?? 100;
              const widthPct = nextPct - slot.pct;
              return (
                <button
                  key={`slot-${slot.label}`}
                  type="button"
                  aria-label={`Legg til kl ${slot.label}`}
                  onClick={(e) =>
                    onSlotClick?.(slot.label, e.currentTarget.getBoundingClientRect())
                  }
                  className={cn(
                    "group absolute top-0 bottom-0 z-0",
                    "cursor-pointer",
                    "focus-visible:outline-none",
                  )}
                  style={{ left: `${slot.pct}%`, width: `${widthPct}%` }}
                >
                  {/* Thin guide-line on hover */}
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute top-0 bottom-0 left-0 w-px",
                      "bg-transparent transition-colors",
                      "group-hover:bg-orange-400/50 group-focus-visible:bg-orange-400/50",
                    )}
                  />
                </button>
              );
            })}

          {/* Duration bars (tasks with start+end). Rendered behind markers. */}
          {withLanes.map(({ event, pct, pctEnd, lane }) => {
            if (pctEnd == null || pctEnd <= pct) return null;
            const meta = EVENT_TYPE_META[event.type];
            const offsetY = lane === 0 ? "0" : lane === 1 ? "-22px" : "22px";
            return (
              <div
                key={`bar-${event.id}`}
                aria-hidden
                className={cn("absolute top-1/2 h-2 rounded-full", meta.stripFill)}
                style={{
                  left: `${pct}%`,
                  width: `${pctEnd - pct}%`,
                  transform: `translateY(calc(-50% + ${offsetY}))`,
                  opacity: 0.6,
                }}
              />
            );
          })}

          {/* Single event markers in lanes */}
          {withLanes.map(({ event, pct, lane }) => {
            const meta = EVENT_TYPE_META[event.type];
            const Icon = meta.icon;
            const offsetY = lane === 0 ? "0" : lane === 1 ? "-22px" : "22px";
            const isHighlighted = highlightedId === event.id;
            const shouldPulse = isHighlighted && pulseSource === "list" && !reduceMotion;
            // Key bump when shouldPulse: forces remount → re-fires keyframe animation
            // even when user clicks the same row twice in succession.
            const motionKey = shouldPulse
              ? `marker-${event.id}-pulse-${Date.now()}`
              : `marker-${event.id}`;
            return (
              <motion.button
                key={motionKey}
                type="button"
                onClick={() => {
                  onSelect?.(event);
                  // Emit telemetry — guard: only when IDs present (ADR-0134)
                  if (workspaceId && profileId) {
                    void emit({
                      event: "ui.dagslinjen.marker_clicked",
                      workspace_id: nonEmpty(workspaceId, "workspace_id"),
                      actor_id: nonEmpty(profileId, "actor_id"),
                      properties: {
                        data: {
                          eventId: event.id,
                          eventTypeKind: event.type,
                          departmentId: departmentId ?? "",
                          sessionId: sessionId ?? "",
                          time: event.time,
                        },
                      },
                    });
                  }
                }}
                title={`${event.time} · ${event.title}${event.actor ? ` · ${event.actor}` : ""}`}
                aria-label={`${event.time} — ${EVENT_TYPE_META[event.type].label}: ${event.title}`}
                initial={false}
                animate={shouldPulse ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                transition={
                  shouldPulse
                    ? { duration: 1.2, ease: motionTokens.easingArray }
                    : { type: "spring", ...motionTokens.springSnappy }
                }
                className={cn(
                  "absolute top-1/2 z-10",
                  "hover:scale-125 focus-visible:scale-125 focus-visible:outline-none",
                  isHighlighted && "ring-ring rounded-full ring-2 ring-offset-1",
                )}
                style={{
                  left: `${pct}%`,
                  transform: `translate(-50%, calc(-50% + ${offsetY}))`,
                }}
              >
                <Marker
                  shape={meta.shape}
                  fill={meta.stripFill}
                  ring={meta.stripRing}
                  iconColor={meta.stripIconColor}
                  Icon={Icon}
                />
              </motion.button>
            );
          })}

          {/* Cluster markers — collapsed from buckets with 2+ events */}
          {clusters.map((cluster) => {
            const bucketAbsStartMin = cluster.startMin % (24 * 60);
            const bucketAbsEndMin = cluster.endMin % (24 * 60);
            const fmt = (m: number) =>
              `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
            return (
              <ClusterMarker
                key={`cluster-${cluster.bucketIdx}`}
                events={cluster.entries.map((e) => e.event)}
                pct={cluster.pct}
                offsetY="0"
                onSelect={(e) => onSelect?.(e)}
                bucketIdx={cluster.bucketIdx}
                departmentId={departmentId}
                sessionId={sessionId}
                bucketStartHHMM={fmt(bucketAbsStartMin)}
                bucketEndHHMM={fmt(bucketAbsEndMin)}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="text-muted-foreground/80 mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px]">
          {EVENT_TYPE_ORDER.map((k) => {
            const meta = EVENT_TYPE_META[k];
            const Icon = meta.icon;
            return (
              <span key={k} className="inline-flex items-center gap-1.5">
                <Marker
                  shape={meta.shape}
                  fill={meta.stripFill}
                  ring={meta.stripRing}
                  iconColor={meta.stripIconColor}
                  Icon={Icon}
                />
                {meta.label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
