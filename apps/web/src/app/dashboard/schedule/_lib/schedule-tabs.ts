/**
 * Vaktplan hub tab definitions — canonical spec §3.
 *
 * Tab keys are full pathnames so PageTabNav variant="route" can drive them
 * directly. Active state derived from pathname match via usePathname().
 *
 * - Vaktplan: drag-drop authoring surface (schedule/page.tsx). The primary
 *   D6 editor. View-modes: Liste / Kalender / Tidslinjer (stub until SM-6).
 * - Vaktbørs: open-shift marketplace at /schedule/marketplace. Manager+
 *   only per ADR-0133 + ADR-0306.
 * - Ferieplan: vacation absences (schedule_absence WHERE absence_type='vacation').
 *   View-modes: Liste / Tidslinjer (stub until SM-6).
 *
 * Dropped tabs (spec §3.1):
 * - Foreslått plan: spec §13 O7 — drawer/modal target, not a tab.
 * - Pipeline: admin audit surface accessed via in-page button, not tab.
 */
import { CalendarDays, ArrowLeftRight, Sun } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type ScheduleTabDef = {
  key: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export const SCHEDULE_TAB_DEFS: readonly ScheduleTabDef[] = [
  { key: "", label: "Vaktplan", icon: CalendarDays },
  { key: "marketplace", label: "Vaktbørs", icon: ArrowLeftRight },
  { key: "ferieplan", label: "Ferieplan", icon: Sun },
] as const;
