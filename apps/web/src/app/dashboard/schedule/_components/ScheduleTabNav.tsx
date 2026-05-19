"use client";

/**
 * Tab strip for the Vaktplan hub.
 *
 * Client component because active-tab detection requires usePathname()
 * (via PageTabNav's internal pathname resolution).
 * Rendered in schedule/layout.tsx so it persists across all three tab routes
 * without unmounting on navigation.
 *
 * Uses PageTabNav variant="route" (SM-7 merged). basePath="/dashboard/schedule"
 * means the root tab (key="") resolves to /dashboard/schedule exactly, while
 * "marketplace" → /dashboard/schedule/marketplace and
 * "ferieplan" → /dashboard/schedule/ferieplan.
 *
 * Spec: docs/design/sitemap/web/00-CANONICAL.md §3 (Vaktplan tabs).
 */
import { PageTabNav } from "@/components/dashboard/PageTabNav";
import { SCHEDULE_TAB_DEFS } from "../_lib/schedule-tabs";

const BASE_PATH = "/dashboard/schedule";

export function ScheduleTabNav() {
  return (
    <PageTabNav
      tabs={SCHEDULE_TAB_DEFS.map((t) => ({ key: t.key, label: t.label, icon: t.icon }))}
      variant="route"
      basePath={BASE_PATH}
      ariaLabel="Vaktplan-seksjoner"
    />
  );
}
