// ============================================
// calendar/page.tsx
// Calendar hub — tabbed shell mirroring reports layout.
// Tabs: Kalender | Årshjul | Eventer | Bookinger
// Server Component shell (per ADR-0115). Heavy tabs lazy-load.
// ============================================

import { Suspense } from "react";
import { resolveDashboardContext } from "../_data/resolve-page-context";
import { withPagePerf } from "@/lib/page-perf";
import { CalendarPageShell } from "./_components/CalendarPageShell";
import CalendarLoading from "./loading";

export default withPagePerf(async function CalendarPage() {
  await resolveDashboardContext();

  return (
    <Suspense fallback={<CalendarLoading />}>
      <CalendarPageShell />
    </Suspense>
  );
});
