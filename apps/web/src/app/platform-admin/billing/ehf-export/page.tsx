import { redirect } from "next/navigation";
import { getSuperAdminId } from "@/lib/platform-admin";

import { EhfExportForm } from "./_components/ehf-export-form";

// Fase 3B B5 — EHF-eksport-side for regnskapsfører-workflow.
//
// Platform-admin velger periode + grouping + format og genererer en
// pakke som regnskapsfører bruker til å lage EHF-fakturaer eksternt.
// Per ADR-0139 er CSV/PDF-eksport hele Fase 3B-leveransen; Smartout
// sender ikke EHF direkte.

export default async function EhfExportPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/");

  return (
    <div className="max-w-2xl space-y-6">
      <header className="space-y-2">
        <h2 className="font-heading text-2xl">EHF-eksport til regnskapsfører</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Månedlig eksport-pakke for workspaces som har aktivert EHF. Regnskapsfører lager
          EHF-fakturaer fra pakken og markerer betalt i Smartout på melding. Kun fakturaer med{" "}
          <span className="font-medium">status=utstedt</span> eller{" "}
          <span className="font-medium">forfallt</span> inkluderes.
        </p>
      </header>
      <EhfExportForm />
    </div>
  );
}
