// ============================================
// planning/page.tsx
// Planlegging hub — canonical URL for the planning surface.
//
// Renders CalendarPageShell (shared with /dashboard/calendar).
// Tabs: Kalender | Årshjul | Eventer | Bookings
//
// Deep-link sub-routes (/planning/kalender etc.) redirect here
// with ?tab=<value>. The shell consumes the param and clears it.
//
// Canonical spec: docs/design/sitemap/web/00-CANONICAL.md §3
// Cascade alignment: D4 (Demand Signal) + D5 (Service Concept)
// SM-3 — /dashboard/calendar compositeActive preserves legacy URL.
// ============================================

import { Suspense } from "react";
import { resolveDashboardContext } from "../_data/resolve-page-context";
import { withPagePerf } from "@/lib/page-perf";
import { CalendarPageShell } from "../calendar/_components/CalendarPageShell";
import PlanningLoading from "./loading";

export default withPagePerf(async function PlanningPage() {
  await resolveDashboardContext();

  return (
    <Suspense fallback={<PlanningLoading />}>
      <CalendarPageShell />
    </Suspense>
  );
});
