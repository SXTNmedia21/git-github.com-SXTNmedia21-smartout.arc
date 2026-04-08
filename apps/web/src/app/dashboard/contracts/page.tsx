"use client";

/**
 * ContractsPage — /dashboard/contracts
 *
 * Reads workspace context from DashboardShell and renders the contracts DataTable.
 * Workspace ID is required — renders nothing while context is loading.
 *
 * The "Lag kontrakt med Botsson" button delegates contract creation to Botsson via
 * a `botsson:open` window event. BotssonProvider listens for the event, expands the
 * floating overlay to immersive mode, switches to the admin-chat view, and primes
 * Botsson with the create_contract context. Botsson then walks the admin through
 * picking the employee + template using its existing capability tools.
 */

import { useContext } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@smartout/ui";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { ContractsDataTable } from "./_components/contracts-data-table";

export default function ContractsPage() {
  const { workspaceData } = useContext(DashboardContext);

  if (!workspaceData?.workspace_id) return null;

  function openBotssonForContract() {
    // Dispatch the global event BotssonProvider listens for. The provider expands
    // the overlay and switches to the admin-chat view with the prime context below.
    window.dispatchEvent(
      new CustomEvent("botsson:open", {
        detail: {
          view: "admin-chat",
          primeContext: {
            kind: "create_contract",
          },
        },
      }),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">Kontrakter</h1>
          <p className="text-muted-foreground text-sm">
            Se status, send for signering, og la Botsson hjelpe deg å lage nye.
          </p>
        </div>
        <Button onClick={openBotssonForContract} className="gap-2">
          <Sparkles className="h-4 w-4" />
          Lag kontrakt med Botsson
        </Button>
      </div>
      <ContractsDataTable workspaceId={workspaceData.workspace_id} />
    </div>
  );
}
