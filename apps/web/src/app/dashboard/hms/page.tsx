import { Suspense } from "react";
import { resolveDashboardContext } from "../_data/resolve-page-context";
import { HmsPageClient } from "./_components/hms-page-client";
import HmsLoading from "./loading";

/**
 * /dashboard/hms — Server Component shell (HMS / governance overview).
 *
 * Resolves the workspace + profile context server-side, then hands off to
 * a single client boundary that conditionally renders admin vs employee
 * variants. Server-side data prefetch deferred — admin/employee child
 * components own their data (5 parallel TanStack queries) and refactoring
 * those hooks to accept hydrated initial data is out of scope for this PR
 * per ADR-0115 ("apply pattern to non-schedule routes first").
 */
export default async function HmsPage() {
  await resolveDashboardContext();

  return (
    <Suspense fallback={<HmsLoading />}>
      <HmsPageClient />
    </Suspense>
  );
}
