"use client";

import { useEffect } from "react";
import { Button } from "@smartout/ui";
import { AlertCircle } from "lucide-react";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function InvoiceDetailError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 px-4 text-center">
      <AlertCircle className="text-muted-foreground size-12" />
      <div className="max-w-md space-y-2">
        <h1 className="font-heading text-2xl">Noe gikk galt</h1>
        <p className="text-muted-foreground text-sm">
          Kunne ikke laste fakturadetaljene. Prøv å laste siden på nytt.
        </p>
      </div>
      <Button variant="outline" onClick={() => reset()}>
        Prøv igjen
      </Button>
    </div>
  );
}
