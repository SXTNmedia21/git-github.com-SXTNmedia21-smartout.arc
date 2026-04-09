"use client";

/**
 * AcknowledgementRing — Progress indicator for ghost value acknowledgements.
 *
 * Shows a progress bar and "{N} av {M} godkjent" text.
 * Fires onAllAcknowledged callback when all blocks are acknowledged.
 */

import * as React from "react";

type AcknowledgementRingProps = {
  totalBlocks: number;
  acknowledgedBlocks: number;
  children: React.ReactNode;
  onAllAcknowledged?: () => void;
};

export function AcknowledgementRing({
  totalBlocks,
  acknowledgedBlocks,
  children,
  onAllAcknowledged,
}: AcknowledgementRingProps) {
  const allDone = totalBlocks > 0 && acknowledgedBlocks >= totalBlocks;
  const percentage = totalBlocks > 0 ? (acknowledgedBlocks / totalBlocks) * 100 : 0;

  React.useEffect(() => {
    if (allDone && onAllAcknowledged) {
      onAllAcknowledged();
    }
  }, [allDone, onAllAcknowledged]);

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-2">
        <div className="bg-muted h-1.5 w-full rounded-full">
          <div
            className="bg-primary h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          {acknowledgedBlocks} av {totalBlocks} godkjent
          {allDone && <span className="text-primary font-medium"> — klar til å sende</span>}
        </p>
      </div>

      {children}
    </div>
  );
}
