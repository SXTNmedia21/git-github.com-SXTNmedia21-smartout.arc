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
    <div className="fixed top-0 right-0 left-0 z-50 border-b border-destructive/20 bg-destructive/10 px-4 py-3 text-center">
      <div className="flex items-center justify-center gap-2 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Kan ikke koble til tjenesten. Registrering er midlertidig utilgjengelig.</span>
      </div>
      {error && <p className="mt-1 text-xs text-destructive/80">{error}</p>}
    </div>
  );
}
