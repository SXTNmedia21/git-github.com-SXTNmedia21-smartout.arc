"use client";

import { useEffect } from "react";
import { Button } from "@smartout/ui";
import { reportErrorFromClient } from "@/lib/error-reporter";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] render error:", error);
    reportErrorFromClient(`Dashboard error: ${error.message.slice(0, 80)}`, error, {
      digest: error.digest,
      page: typeof window !== "undefined" ? window.location.pathname : "unknown",
    });
  }, [error]);

  return (
    <div className="bg-background flex flex-1 flex-col items-center justify-center gap-4 px-4">
      <p className="text-foreground text-base font-medium">Noe gikk galt</p>
      <p className="text-muted-foreground max-w-md text-center text-sm">{error.message}</p>
      {error.digest && <p className="text-muted-foreground text-xs">Feilkode: {error.digest}</p>}
      <Button variant="outline" onClick={reset}>
        Prøv igjen
      </Button>
    </div>
  );
}
