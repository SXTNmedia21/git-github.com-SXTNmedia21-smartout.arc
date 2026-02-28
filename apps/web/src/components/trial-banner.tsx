"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type TrialBannerProps = {
  trialEndsAt: string;
  contractStatus: string;
};

export function TrialBanner({ trialEndsAt, contractStatus }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (contractStatus !== "pending_contract" && contractStatus !== "trial") return null;

  const now = new Date();
  const daysRemaining = Math.max(
    0,
    Math.ceil((new Date(trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  );

  return (
    <div className="relative flex items-center justify-center gap-3 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
      <span>
        {daysRemaining > 0
          ? `Proveperioden utloper om ${daysRemaining} ${daysRemaining === 1 ? "dag" : "dager"}. `
          : "Proveperioden har utlopt. "}
        <a href="/dashboard/settings" className="font-medium underline underline-offset-2">
          Signer avtalen for a beholde full tilgang.
        </a>
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 h-6 w-6 text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
        onClick={() => setDismissed(true)}
        aria-label="Lukk"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
