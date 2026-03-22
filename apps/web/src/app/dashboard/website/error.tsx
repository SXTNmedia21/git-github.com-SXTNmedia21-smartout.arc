"use client";

import { useEffect } from "react";
import { Button } from "@smartout/ui";

export default function WebsiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[website] render error:", error);
  }, [error]);

  return (
    <div className="z-10 flex flex-1 flex-col items-center justify-center gap-4 px-4 pt-8 pb-20">
      <p className="text-foreground text-base font-medium">Noe gikk galt</p>
      <p className="text-muted-foreground text-sm">{error.message}</p>
      <Button variant="outline" onClick={reset}>
        Prøv igjen
      </Button>
    </div>
  );
}
