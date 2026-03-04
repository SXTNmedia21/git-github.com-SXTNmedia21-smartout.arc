"use client";

import { FileText, X } from "lucide-react";
import { useState } from "react";
import { useWorkspaceOptional } from "@/lib/workspace-context";

export function ContractPendingBanner() {
  const ctx = useWorkspaceOptional();
  const [dismissed, setDismissed] = useState(false);

  if (!ctx || ctx.workspace.contract_status !== "pending_contract" || dismissed) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 border-b border-orange-500/20 bg-orange-500/10 px-6 py-3">
      <FileText className="h-4 w-4 shrink-0 text-orange-400" />
      <p className="flex-1 text-sm text-orange-200">
        Du har et usignert kontrakt. Sjekk e-posten din for signeringslenken.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="rounded p-1 text-orange-400/60 transition-colors hover:bg-orange-500/10 hover:text-orange-400"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
