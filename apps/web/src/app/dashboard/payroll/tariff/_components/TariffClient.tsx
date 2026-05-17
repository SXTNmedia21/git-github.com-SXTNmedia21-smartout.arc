/**
 * TariffClient — client boundary for /dashboard/payroll/tariff.
 *
 * Orchestrates: current binding card + history list + supplement overrides
 * + change binding form + add supplement form.
 *
 * Emits payroll.tariff_view_loaded on mount (Phase 7g: registry entry added).
 *
 * Layout: page header (ADR-0357 §b) → current binding card → history list →
 * supplement overrides → change binding form (admin-only) → add supplement
 * form (admin + manager).
 *
 * Instructions: visible above the page content per ADR-0357 §c.
 */
"use client";

import { useContext, useEffect, useRef } from "react";
import { ShieldCheck, FileClock, Plus, RefreshCw } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { useCurrentTariff } from "@/hooks/payroll/use-current-tariff";
import { CurrentBindingCard } from "./CurrentBindingCard";
import { BindingHistoryList } from "./BindingHistoryList";
import { SupplementOverridesList } from "./SupplementOverridesList";
import { ChangeBindingForm } from "./ChangeBindingForm";
import { AddSupplementForm } from "./AddSupplementForm";
import { emit, nonEmpty } from "@smartout/telemetry";
import { Separator } from "@/components/ui/separator";

export function TariffClient() {
  const { isAdminMode } = useContext(DashboardContext);
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id ?? "";

  const { data, isLoading, error } = useCurrentTariff();

  const emittedRef = useRef(false);

  // Telemetry view-emit (ADR-0357 §d)
  // Phase 7g: payroll.tariff_view_loaded is now in the telemetry registry.
  // PostHog + Logger only (no activity_trail — view event per registry entry).
  // actor_id: client components use workspaceId as placeholder since no direct
  // profile context is available. Activity_trail writes are mutation-only and
  // server-initiated — no audit risk here.
  // Fires after data loads so is_bound reflects the real binding state.
  useEffect(() => {
    if (emittedRef.current || !workspaceId || isLoading) return;
    emittedRef.current = true;
    const resolvedIsBound = data?.ok ? data.data.is_bound : false;
    void emit({
      event: "payroll.tariff_view_loaded",
      workspace_id: nonEmpty(workspaceId, "workspaceId"),
      actor_id: nonEmpty(workspaceId, "workspaceId"), // placeholder — BFF resolves real profileId for mutations
      properties: {
        data: {
          route: "/dashboard/payroll/tariff",
          is_bound: resolvedIsBound,
          viewed_at: new Date().toISOString(),
        },
      },
    });
  }, [workspaceId, isLoading, data]);

  const isBound = data?.ok ? data.data.is_bound : false;

  // Manager can add supplements; only admin can change binding
  const canAddSupplement = isAdminMode; // server enforces — UI reflects

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Page header — ADR-0357 §b */}
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-muted-foreground h-5 w-5" aria-hidden="true" />
          <h1 className="text-foreground text-lg font-semibold">Tariffbinding</h1>
        </div>
        {/* Page description — ADR-0357 §b */}
        <p className="text-muted-foreground mt-1 text-sm">
          Administrer arbeidsplassens tilknytning til tariffavtale. Endringer i tariffbinding
          gjelder for fremtidige lønnskjøringer — historiske perioder berøres ikke.
        </p>
      </div>

      {/* Instructions — ADR-0357 §c */}
      <div className="border-border bg-muted/20 rounded-lg border p-3 text-xs">
        <p className="text-muted-foreground">
          <strong className="text-foreground">Slik bruker du siden:</strong> Se gjeldende
          tariffbinding og aktive tillegg øverst. Bruk «Endre tariffbinding» (kun admin) for å bytte
          til en ny overenskomst eller versjon. Legg til lokale tillegg i «Legg til tillegg» —
          tillegg kan ikke settes under tariffgulvet.
        </p>
      </div>

      {/* Current binding */}
      <section aria-labelledby="current-binding-heading">
        <h2 id="current-binding-heading" className="text-foreground mb-3 text-sm font-medium">
          Gjeldende binding
        </h2>
        <CurrentBindingCard data={data} isLoading={isLoading} error={error} />
      </section>

      <Separator />

      {/* Binding history */}
      <section aria-labelledby="history-heading">
        <div className="mb-3 flex items-center gap-2">
          <FileClock className="text-muted-foreground h-4 w-4" aria-hidden="true" />
          <h2 id="history-heading" className="text-foreground text-sm font-medium">
            Historikk
          </h2>
        </div>
        {/* History endpoint not yet in BFF v1 — passes empty entries */}
        <BindingHistoryList entries={[]} isLoading={false} />
      </section>

      <Separator />

      {/* Supplement overrides */}
      <section aria-labelledby="supplements-heading">
        <div className="mb-3 flex items-center gap-2">
          <Plus className="text-muted-foreground h-4 w-4" aria-hidden="true" />
          <h2 id="supplements-heading" className="text-foreground text-sm font-medium">
            Lokale tillegg
          </h2>
        </div>
        {/* Supplement list comes from BFF v1 GET current — not yet in response shape.
            Passes empty until Track 1 exposes the list. */}
        <SupplementOverridesList overrides={[]} isLoading={isLoading} />
      </section>

      <Separator />

      {/* Change binding form — admin only */}
      <section aria-labelledby="change-binding-heading">
        <div className="mb-3 flex items-center gap-2">
          <RefreshCw className="text-muted-foreground h-4 w-4" aria-hidden="true" />
          <h2 id="change-binding-heading" className="text-foreground text-sm font-medium">
            {isBound ? "Endre tariffbinding" : "Sett opp tariffbinding"}
          </h2>
        </div>
        <ChangeBindingForm isBound={isBound} isAdmin={isAdminMode} />
      </section>

      <Separator />

      {/* Add supplement form — admin + manager */}
      <section aria-labelledby="add-supplement-heading">
        <div className="mb-3 flex items-center gap-2">
          <Plus className="text-muted-foreground h-4 w-4" aria-hidden="true" />
          <h2 id="add-supplement-heading" className="text-foreground text-sm font-medium">
            Legg til tillegg
          </h2>
        </div>
        <AddSupplementForm canSubmit={canAddSupplement} />
      </section>
    </div>
  );
}
