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
    <div className="fixed top-0 right-0 left-0 z-50 border-b border-red-200 bg-red-50 px-4 py-3 text-center dark:border-red-900 dark:bg-red-950/50">
      <div className="flex items-center justify-center gap-2 text-sm text-red-800 dark:text-red-200">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Kan ikke koble til tjenesten. Registrering er midlertidig utilgjengelig.</span>
      </div>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
