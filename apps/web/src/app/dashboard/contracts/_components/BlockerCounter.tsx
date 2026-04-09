"use client";

/**
 * BlockerCounter — Summary badges for compliance blockers and warnings.
 *
 * Shows red blocker count and/or amber warning count.
 * Returns null when both counts are zero (nothing to show).
 */

import * as React from "react";
import { AlertTriangle } from "lucide-react";

type BlockerCounterProps = {
  warningCount: number;
  blockerCount: number;
};

export function BlockerCounter({ warningCount, blockerCount }: BlockerCounterProps) {
  if (warningCount === 0 && blockerCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      {blockerCount > 0 && (
        <div className="flex items-center gap-1.5 text-sm font-medium text-red-600">
          <AlertTriangle className="h-4 w-4" />
          <span>
            {blockerCount} {blockerCount === 1 ? "blokkering" : "blokkeringer"}
          </span>
        </div>
      )}
      {warningCount > 0 && (
        <div className="flex items-center gap-1.5 text-sm font-medium text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          <span>
            {warningCount} {warningCount === 1 ? "advarsel" : "advarsler"}
          </span>
        </div>
      )}
    </div>
  );
}
