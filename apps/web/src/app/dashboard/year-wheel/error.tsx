"use client";

/**
 * error.tsx — Next.js error boundary for /dashboard/year-wheel.
 *
 * Catches runtime errors thrown during render of the year-wheel page tree.
 * Shows a human-readable message in Norwegian with a retry CTA. The `reset`
 * callback re-renders the segment from scratch without a full page reload.
 *
 * Styled with Nordic Split tokens (bg-background, text-foreground,
 * text-muted-foreground, border-border) and Instrument Serif heading.
 */

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function YearWheelError({ error, reset }: Props) {
  return (
    <div className="bg-background text-foreground flex h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="bg-destructive/10 text-destructive flex h-14 w-14 items-center justify-center rounded-full">
        <AlertTriangle className="h-7 w-7" />
      </div>

      <div className="max-w-md space-y-2">
        <h1 className="font-heading text-2xl font-normal italic">Kunne ikke laste årshjulet</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Noe gikk galt ved innlasting av sesongkalenderen. Prøv å laste siden på nytt — problemet
          er vanligvis forbigående.
        </p>
        {error.digest && (
          <p className="text-muted-foreground/60 mt-1 font-mono text-xs">
            Feilkode: {error.digest}
          </p>
        )}
      </div>

      <Button onClick={reset} variant="outline" size="default">
        Prøv igjen
      </Button>
    </div>
  );
}
