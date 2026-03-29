"use client";

// ConnectionBanner — purely cosmetic UI feedback component.
// Polls /api/smoke on mount and shows a top banner if the backend is unreachable.
// No onboarding routing logic, no workspace creation, no state mutations.

import { AlertTriangle } from "lucide-react";
import { useConnectionCheck } from "@/hooks/useConnectionCheck";

export function ConnectionBanner() {
  const { status, error } = useConnectionCheck();

  if (status !== "error") return null;

  return (
    <div className="border-destructive/20 bg-destructive/10 fixed top-0 right-0 left-0 z-50 border-b px-4 py-3 text-center">
      <div className="text-destructive flex items-center justify-center gap-2 text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Kan ikke koble til tjenesten. Registrering er midlertidig utilgjengelig.</span>
      </div>
      {error && <p className="text-destructive/80 mt-1 text-xs">{error}</p>}
    </div>
  );
}
