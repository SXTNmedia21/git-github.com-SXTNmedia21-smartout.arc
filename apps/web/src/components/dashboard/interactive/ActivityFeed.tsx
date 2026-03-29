"use client";

// ActivityFeed — realtime scrollable activity timeline.
// Shows workspace events from activity_trail with category/time-range filters.
// New entries animate in from below. Subscribes via the hook's realtime channel.
// Auto-scrolls to the latest entry when new data arrives.

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import {
  useActivityFeed,
  type ActivityFeedFilters,
} from "@/app/dashboard/_hooks/use-activity-feed";
import { useEntityDrawerOptional } from "@/components/dashboard/entity-drawer/EntityDrawerContext";
import type { ActivityEntry } from "@/app/dashboard/_hooks/use-activity-feed";

// ─── Constants ──────────────────────────────────────────────────────────────

const FEED_LIMIT = 50;

// New-entry entrance: quick 150ms fade + slide from below
const ENTRY_ENTER = {
  initial: { y: 12, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  transition: { duration: 0.15 },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Maps an activity category to a severity dot colour class.
 *
 * Why: Consistent colour semantics across feed rows — operations gets warning,
 * scheduling stays info, training uses success.
 *
 * @param category - Category string from activity_trail row.
 * @returns Tailwind class for the 6px severity dot.
 */
function categoryDotClass(category: string): string {
  switch (category) {
    case "operations":
      return "bg-warning";
    case "scheduling":
      return "bg-info";
    case "training":
      return "bg-success";
    default:
      return "bg-muted-foreground";
  }
}

/**
 * Formats a createdAt ISO string to a compact "HH:MM" time label.
 *
 * @param isoString - ISO 8601 timestamp.
 * @returns Localized "HH:MM" string in Norwegian locale, or "—" on failure.
 */
function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString("nb-NO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

type FilterPillProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

/** Single filter toggle pill. */
function FilterPill({ label, active, onClick }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

/** Single feed entry row. */
function FeedEntry({
  entry,
  onPress,
  reducedMotion,
}: {
  entry: ActivityEntry;
  onPress: () => void;
  reducedMotion: boolean;
}) {
  // Disable slide-in animation for users who prefer reduced motion
  const motionProps = reducedMotion ? {} : ENTRY_ENTER;
  return (
    <motion.button
      type="button"
      onClick={onPress}
      className="hover:bg-muted/40 flex w-full items-start gap-2 rounded-md px-1 py-1.5 text-left transition-colors"
      {...motionProps}
    >
      {/* Timestamp */}
      <span className="text-muted-foreground mt-0.5 w-10 shrink-0 font-mono text-[11px] tabular-nums">
        {formatTime(entry.createdAt)}
      </span>

      {/* Severity dot */}
      <span
        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${categoryDotClass(entry.category)}`}
        aria-hidden="true"
      />

      {/* Description + actor */}
      <div className="min-w-0 flex-1">
        <span className="block truncate text-xs leading-relaxed">{entry.description}</span>
        <span className="text-muted-foreground block text-[11px]">{entry.actorName}</span>
      </div>
    </motion.button>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

type TimeRange = "today" | "7d";

/**
 * ActivityFeed — scrollable realtime workspace activity timeline.
 *
 * Why: Managers need ongoing awareness of what's happening without refreshing
 * the page. This component provides a live feed with lightweight filters.
 */
export function ActivityFeed() {
  const { t } = useTranslation("dashboard");
  const drawer = useEntityDrawerOptional();
  const scrollRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion() ?? false;

  const [timeRange, setTimeRange] = useState<TimeRange>("today");

  const filters: ActivityFeedFilters = {
    category: "all",
    timeRange,
  };

  const { data, isLoading, isError, refetch } = useActivityFeed({
    limit: FEED_LIMIT,
    filters,
  });

  // Auto-scroll to latest entry whenever data changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0; // Newest entries are at the top
    }
  }, [data]);

  // ── Error state ─────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8">
        <p className="text-muted-foreground text-sm">{t("interactive.feed_error")}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="text-primary flex items-center gap-1.5 text-xs"
        >
          <RefreshCw className="h-3 w-3" />
          {t("interactive.feed_reconnect")}
        </button>
      </div>
    );
  }

  const entries = data ?? [];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header: title + time-range filter pills */}
      <div className="flex items-center justify-between gap-2 pb-2">
        <span className="text-sm font-semibold">{t("interactive.feed_title")}</span>
        <div className="flex items-center gap-1">
          <FilterPill
            label={t("interactive.feed_filter_today")}
            active={timeRange === "today"}
            onClick={() => setTimeRange("today")}
          />
          <FilterPill
            label={t("interactive.feed_filter_7d")}
            active={timeRange === "7d"}
            onClick={() => setTimeRange("7d")}
          />
        </div>
      </div>

      {/* Scrollable feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {isLoading ? (
          // Loading skeleton rows
          <div className="space-y-2 px-1 py-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="bg-muted mt-0.5 h-3 w-10 animate-pulse rounded" />
                <div className="bg-muted mt-1.5 h-1.5 w-1.5 animate-pulse rounded-full" />
                <div className="flex-1 space-y-1">
                  <div className="bg-muted h-3 w-3/4 animate-pulse rounded" />
                  <div className="bg-muted h-2.5 w-1/3 animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          // Empty state
          <div className="border-border mt-4 rounded-lg border border-dashed px-4 py-8 text-center">
            <p className="text-muted-foreground text-sm">{t("interactive.no_activity_yet")}</p>
          </div>
        ) : (
          <div className="px-1">
            {entries.map((entry) => (
              <FeedEntry
                key={entry.id}
                entry={entry}
                reducedMotion={prefersReduced}
                onPress={() => {
                  // Open entity drawer when entity info is available
                  if (drawer && entry.entityType && entry.entityLabel) {
                    // entity_label is not an ID — we can only open the drawer if
                    // we have a valid entity type that maps to a drawer tab.
                    // For now we open drawer only for known types.
                    const drawerType = entry.entityType as
                      | "profile"
                      | "shift"
                      | "department_session"
                      | "department"
                      | null;

                    if (drawerType && entry.actorId) {
                      drawer.openDrawer(drawerType, entry.actorId);
                    }
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
