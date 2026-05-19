import { CalendarDays, Sparkles, ListTree, Users } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type PlanningTabDef = {
  key: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

/**
 * Planlegging hub tab definitions per docs/design/sitemap/web/00-CANONICAL.md §3.
 *
 * Tab keys match the CalendarPageShell `TABS` values and the ?tab= search param.
 * Sub-page shims at /planning/arshjul etc. redirect to /planning?tab=<key>.
 *
 * Cascade alignment:
 *   - Kalender: D4 (planning_event) + K1a (public_holiday)
 *   - Årshjul:  D4 (season_budget, planning_cycle, day_factor) + D5 (workspace config)
 *   - Eventer:  D4 (planning_event table — event list view)
 *   - Bookings: D4 / future booking_integration source
 *
 * Note: "Bookinger" is the Norwegian form (spec §3 uses "Bookings" in English tab label;
 * the CalendarPageShell uses "Bookinger" in Norwegian. i18n key controls the display label.
 *
 * Dropped from Planlegging per spec §3.3:
 *   - Season detail page (/dashboard/season/[seasonId]) — still orphan; absorbed in
 *     SM-3-followup-absorb when year-wheel moves under /planning.
 *   - Setup-veiviser — first-run modal flow; deferred to SM-3-followup-setup-wizard.
 */
export const PLANNING_TAB_DEFS: readonly PlanningTabDef[] = [
  { key: "calendar", label: "Kalender", icon: CalendarDays },
  { key: "year-wheel", label: "Årshjul", icon: Sparkles },
  { key: "events", label: "Eventer", icon: ListTree },
  { key: "bookings", label: "Bookings", icon: Users },
] as const;
