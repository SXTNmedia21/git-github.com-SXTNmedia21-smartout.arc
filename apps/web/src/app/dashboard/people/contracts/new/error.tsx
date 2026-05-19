"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@smartout/ui";
import { AlertCircle } from "lucide-react";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function NewContractError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 px-4 text-center">
      <AlertCircle className="text-muted-foreground size-12" />
      <div className="max-w-md space-y-2">
        <h1 className="font-heading text-2xl">Noe gikk galt</h1>
        <p className="text-muted-foreground text-sm">
          Kunne ikke starte kontraktsflyt. Gå til oversikten og prøv å opprette en ny kontrakt.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" asChild>
          <Link href="/dashboard/people/contracts">Tilbake til kontrakter</Link>
        </Button>
        <Button variant="outline" onClick={() => reset()}>
          Prøv igjen
        </Button>
      </div>
    </div>
  );
}
