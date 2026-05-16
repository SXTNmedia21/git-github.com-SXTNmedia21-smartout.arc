"use client";

/**
 * apps/web/src/app/dashboard/admin/pos-accounts/error.tsx
 *
 * Error boundary for /dashboard/admin/pos-accounts.
 * Follows pages/[pageId]/error.tsx pattern: type ErrorProps,
 * @smartout/ui Button, AlertCircle, Norwegian copy.
 */

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@smartout/ui";
import { AlertCircle } from "lucide-react";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function PosAccountsError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 px-4 text-center">
      <AlertCircle className="text-muted-foreground size-12" />
      <div className="max-w-md space-y-2">
        <h1 className="font-heading text-2xl">Kunne ikke laste POS-tilkoblinger</h1>
        <p className="text-muted-foreground text-sm">Sjekk internett eller logg inn på nytt.</p>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" asChild>
          <Link href="/dashboard">Tilbake til dashboard</Link>
        </Button>
        <Button variant="default" onClick={reset}>
          Prøv igjen
        </Button>
      </div>
    </div>
  );
}
