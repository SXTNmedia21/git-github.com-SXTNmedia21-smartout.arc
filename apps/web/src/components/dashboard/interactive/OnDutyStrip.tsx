"use client";

// OnDutyStrip — compact horizontal avatar row showing who is currently on shift.
// Provides fast situational awareness at a glance. Clicking an avatar opens the
// entity drawer for the profile. Overflow past 8 avatars is shown as a +N pill.
// Clicking the totals button slides down a detailed shift card panel.

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "@smartout/i18n";
import { useLiveShifts } from "@/app/dashboard/_hooks/use-live-shifts";
import { useEntityDrawerOptional } from "@/components/dashboard/entity-drawer/EntityDrawerContext";
import type { LiveShiftEntry } from "@/app/dashboard/_hooks/use-live-shifts";
import { getSeverityToneStyles } from "../cockpit/severity-styles";
import type { CockpitSeverityTone } from "../cockpit/severity-styles";

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_VISIBLE_AVATARS = 8;

// Ambient spring — Nordic Split spec: stiffness 40, damping 22, mass 2.2
const AMBIENT_SPRING = {
  type: "spring" as const,
  stiffness: 40,
  damping: 22,
  mass: 2.2,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Maps a live shift status to a status dot CSS class.
 *
 * Why: Consistent colour coding across avatar dot and shift card badge.
 *
 * @param status - Live shift status from the hook.
 * @returns Tailwind class for the dot background.
 */
function statusDotClass(status: LiveShiftEntry["status"]): string {
  switch (status) {
    case "clocked_in":
      return "bg-success";
    case "on_break":
      return "bg-info";
    case "late":
      return "bg-destructive";
    case "waiting":
      return "bg-warning";
  }
}

/**
 * Maps a live shift status to a cockpit severity tone for badge rendering.
 *
 * @param status - Live shift status.
 * @returns Severity tone for the badge inside the expand panel.
 */
function statusToTone(status: LiveShiftEntry["status"]): CockpitSeverityTone {
  switch (status) {
    case "late":
      return "critical";
    case "waiting":
      return "warning";
    case "on_break":
      return "info";
    case "clocked_in":
      return "good";
  }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

type AvatarProps = {
  entry: LiveShiftEntry;
  onPress: () => void;
};

/** Single avatar circle with initials and status dot. */
function Avatar({ entry, onPress }: AvatarProps) {
  return (
    // 44px tap target wraps the 36px visual circle
    <button
      type="button"
      onClick={onPress}
      className="relative flex h-11 w-11 items-center justify-center"
      aria-label={entry.employeeName}
      title={`${entry.employeeName} — ${entry.status.replace("_", " ")}`}
    >
      {/* Visual avatar circle — 36px */}
      <span className="bg-muted border-border flex h-9 w-9 items-center justify-center rounded-full border text-[11px] font-bold uppercase">
        {entry.initials}
      </span>

      {/* Status dot — 10px absolute bottom-right of the visual circle */}
      <span
        className={`ring-background absolute right-1 bottom-1 h-2.5 w-2.5 rounded-full ring-2 ${statusDotClass(entry.status)}`}
        aria-hidden="true"
      />
    </button>
  );
}

/** Shift detail card used in the expanded panel — mirrors CockpitOnDutyProgress card markup. */
function ShiftCard({ entry }: { entry: LiveShiftEntry }) {
  const tone = statusToTone(entry.status);
  const { badge } = getSeverityToneStyles(tone);

  return (
    <div className="border-border bg-muted/30 flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{entry.employeeName}</p>
        <p className="text-muted-foreground truncate text-xs">{entry.role || "—"}</p>
      </div>
      <div className="flex items-center gap-2">
        {entry.duration ? (
          <span className="text-muted-foreground text-xs tabular-nums">{entry.duration}</span>
        ) : entry.startTime ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            Start {entry.startTime}
          </span>
        ) : null}
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${badge}`}>
          {entry.status.replace("_", " ")}
        </span>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

/**
 * OnDutyStrip — horizontal avatar bar showing live shift presence.
 *
 * Why: Managers need instant visual awareness of who is clocked in without
 * navigating to the full schedule view.
 */
export function OnDutyStrip() {
  const { t } = useTranslation("dashboard");
  const { data, isLoading } = useLiveShifts();
  const drawer = useEntityDrawerOptional();
  const [isExpanded, setIsExpanded] = useState(false);
  const prefersReduced = useReducedMotion();

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center gap-1 px-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-muted h-9 w-9 animate-pulse rounded-full" aria-hidden="true" />
        ))}
      </div>
    );
  }

  const entries = data?.entries ?? [];

  // ── Empty state ─────────────────────────────────────────────────────────
  if (entries.length === 0) {
    return <p className="text-muted-foreground px-1 text-sm">{t("interactive.no_one_on_duty")}</p>;
  }

  const visibleEntries = entries.slice(0, MAX_VISIBLE_AVATARS);
  const overflowCount = Math.max(0, entries.length - MAX_VISIBLE_AVATARS);

  const clockedIn = data?.clockedIn ?? 0;
  const onBreak = data?.onBreak ?? 0;
  const late = data?.late ?? 0;

  const totalsSummary = [
    `${entries.length} ${t("interactive.on_duty_suffix")}`,
    onBreak > 0 ? `${onBreak} ${t("interactive.on_break_suffix")}` : null,
    late > 0 ? `${late} ${t("interactive.late_suffix")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-2">
      {/* Avatar row + totals button */}
      <div className="flex items-center gap-2">
        {/* Avatar row */}
        <div className="flex items-center">
          {visibleEntries.map((entry) => (
            <Avatar
              key={entry.shiftId}
              entry={entry}
              onPress={() => {
                if (drawer) {
                  // The drawer expects "profile" entity type with a profile id.
                  // We only have shiftId here — open shift view instead.
                  drawer.openDrawer("shift", entry.shiftId);
                }
              }}
            />
          ))}

          {/* Overflow pill */}
          {overflowCount > 0 && (
            <span className="bg-muted border-border text-muted-foreground ml-1 flex h-9 w-9 items-center justify-center rounded-full border text-[11px] font-bold">
              +{overflowCount}
            </span>
          )}
        </div>

        {/* Totals button — toggles the expand panel */}
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground ml-2 text-xs transition-colors"
          aria-expanded={isExpanded}
        >
          {totalsSummary}
        </button>
      </div>

      {/* Expand panel — full shift cards. Instant expand when reduced motion. */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            key="on-duty-panel"
            initial={prefersReduced ? false : { height: 0, opacity: 0 }}
            animate={{
              height: "auto",
              opacity: 1,
              transition: prefersReduced ? { duration: 0 } : AMBIENT_SPRING,
            }}
            exit={
              prefersReduced
                ? { opacity: 0, transition: { duration: 0 } }
                : { height: 0, opacity: 0, transition: AMBIENT_SPRING }
            }
            className="overflow-hidden"
          >
            <div className="space-y-2 pt-1">
              {entries.map((entry) => (
                <ShiftCard key={entry.shiftId} entry={entry} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
