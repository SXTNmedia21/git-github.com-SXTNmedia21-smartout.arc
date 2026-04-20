import { redirect } from "next/navigation";
import { getSuperAdminId } from "@/lib/platform-admin";

import { ExportForm } from "./_components/export-form";

// Phase 8.3 — CSV export form.
//
// Platform-admin picks period_from / period_to (and optionally a
// specific company_id) and submits to the Route Handler at
// `/platform-admin/billing/export/csv` which streams the CSV back.

export default async function ExportPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/");

  return (
    <div className="max-w-xl space-y-4">
      <header className="space-y-1">
        <h2 className="font-heading text-2xl">Eksport til CSV</h2>
        <p className="text-muted-foreground text-sm">
          Last ned alle fakturaer innenfor et valgt periode-intervall. Semikolon-separert, UTF-8 med
          BOM for Excel, norsk desimalskilletegn (kr 1.234,56).
        </p>
      </header>
      <ExportForm />
    </div>
  );
}
