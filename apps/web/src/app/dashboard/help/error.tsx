"use client";

/**
 * error.tsx — Next.js error boundary for /dashboard/help
 *
 * Catches uncaught errors thrown from server or client components inside this
 * route segment. Mirrors the pattern in apps/web/src/app/dashboard/billing/error.tsx.
 *
 * Nordic Split tokens only — no hardcoded colors (CLAUDE.md + ADR-0349 spirit).
 * ADR-0357 NEVER-skippable rule (a): error boundary present on Tier 1 surface.
 */

import { useEffect } from "react";
import { Button } from "@smartout/ui";
import { AlertCircle } from "lucide-react";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function HelpError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 px-4 text-center">
      <AlertCircle className="text-muted-foreground size-12" />
      <div className="max-w-md space-y-2">
        <h1 className="font-heading text-2xl">Noe gikk galt</h1>
        <p className="text-muted-foreground text-sm">
          Vi jobber med å fikse problemet. Last siden på nytt eller kontakt support.
        </p>
      </div>
      <Button variant="outline" onClick={() => reset()}>
        Last på nytt
      </Button>
    </div>
  );
}
