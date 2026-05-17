/**
 * /dashboard/payroll/tariff — Admin tariff management page.
 *
 * Server Component shell. All data is fetched client-side via useCurrentTariff
 * (workspace-scoped, TanStack Query). Single Suspense boundary per ADR-0115.
 *
 * Purpose: read current tariff binding + supplement overrides; change binding
 * (admin-only); add supplement overrides (admin or manager).
 *
 * ADR-0133: authoring surface — web-only. Tariff admin is never built for mobile.
 * ADR-0151: workspace_id derived server-side by BFF routes, not from client body.
 * ADR-0356: payroll capability tools delegate to cascade for audit symmetry.
 * ADR-0357: page header + description MANDATORY; site-map entry MANDATORY.
 *
 * Telemetry: payroll.tariff_view_loaded emitted on mount (TariffClient).
 * FLAGGED: payroll.tariff_view_loaded not found in telemetry registry at build time.
 * Orchestrator must add this event in the telemetry registry sortie (separate scope).
 */
import { Suspense } from "react";
import { TariffClient } from "./_components/TariffClient";

export default function TariffPage() {
  return (
    <Suspense fallback={<TariffPageSkeleton />}>
      <TariffClient />
    </Suspense>
  );
}

function TariffPageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="bg-muted h-8 w-64 animate-pulse rounded-lg" />
      <div className="bg-muted h-32 animate-pulse rounded-lg" />
      <div className="bg-muted h-24 animate-pulse rounded-lg" />
    </div>
  );
}
