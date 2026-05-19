"use client";

/**
 * error.tsx — Next.js App Router error boundary for /dashboard/proposals/[proposalId].
 *
 * Shown when ProposalDetailClient throws (proposal not found, BFF 500, etc.).
 * Uses Nordic Split tokens — no hardcoded colors.
 */

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ProposalDetailError({ reset }: Props) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <AlertCircle className="text-destructive h-10 w-10 opacity-80" />
        <div className="flex flex-col gap-1">
          <p className="text-foreground font-medium">Kunne ikke laste forslaget.</p>
          <p className="text-muted-foreground text-sm">
            Forslaget finnes kanskje ikke, eller du har ikke tilgang. Prøv igjen.
          </p>
        </div>
        <Button variant="outline" onClick={reset}>
          Prøv igjen
        </Button>
      </div>
    </div>
  );
}
