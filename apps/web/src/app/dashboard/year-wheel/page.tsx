import { Suspense } from "react";
import { resolveDashboardContext } from "../_data/resolve-page-context";
import { withPagePerf } from "@/lib/page-perf";
import { YearWheelPageClient } from "./year-wheel-page-client";
import YearWheelLoading from "./loading";

/**
 * /dashboard/year-wheel — Server Component shell.
 *
 * Resolves workspace + profile context server-side (gating, redirects
 * on access-denied), then hands off to the client timeline island which
 * owns TanStack Query hooks for seasons, planning events, budgets, and
 * factor tables.
 *
 * Per ADR-0115 RSC migration pattern. No initial data is hydrated
 * server-side because the timeline hooks key off the selected year +
 * selected season (both client state driven by navigation), and the
 * page mounts with "current year, auto-pick active season" — which
 * only resolves once the client has hydrated.
 */
export default withPagePerf(async function YearWheelPage() {
  await resolveDashboardContext();

  return (
    <Suspense fallback={<YearWheelLoading />}>
      <YearWheelPageClient />
    </Suspense>
  );
});
