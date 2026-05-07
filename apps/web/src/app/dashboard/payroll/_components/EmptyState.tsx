"use client";

import { Receipt } from "lucide-react";

/**
 * Shown when no payroll periods exist yet for the workspace.
 * Guides the admin to trigger the first calculation via Botsson chat.
 */
export function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-full">
        <Receipt className="text-muted-foreground h-8 w-8" />
      </div>
      <div>
        <p className="text-foreground font-semibold">Ingen lønnsperioder ennå</p>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          Be Botsson om å starte første lønnskjøring, eller opprett en periode manuelt i
          innstillingene.
        </p>
      </div>
    </div>
  );
}
