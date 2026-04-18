"use client";

/**
 * ShiftUnlockHint — actionable hint shown under a shift row when the assigned
 * profile is not Ready for one or more required protocols. Tells the employee
 * which protocol is missing and links them to the corresponding training page.
 *
 * Part of Task 27 (governance training UI MVP): shift-gate UI unlock hint.
 */

import Link from "next/link";

import { Badge } from "@/components/ui/badge";

export type MissingProtocol = {
  protocol_id: string;
  name: string;
  steps_remaining: number;
};

export type ShiftUnlockHintProps = {
  missingProtocols: MissingProtocol[];
};

export function ShiftUnlockHint({ missingProtocols }: ShiftUnlockHintProps) {
  if (!missingProtocols || missingProtocols.length === 0) return null;

  return (
    <div
      className="flex flex-col gap-1 border-l-2 border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[11px]"
      data-testid="shift-unlock-hint"
    >
      {missingProtocols.map((protocol) => (
        <div key={protocol.protocol_id} className="flex items-center gap-2">
          <ReadinessBadge stepsRemaining={protocol.steps_remaining} />
          <span className="text-muted-foreground">
            <span className="text-foreground font-semibold">{protocol.name}</span>
            {" mangler — "}
            {protocol.steps_remaining} steg igjen
          </span>
          <Link
            href={`/dashboard/my-training/${protocol.protocol_id}`}
            className="text-amber-500 underline-offset-2 hover:underline"
          >
            Gå til opplæring
          </Link>
        </div>
      ))}
    </div>
  );
}

/**
 * Local ReadinessBadge — Phase 0's shared `@smartout/ui` badge is not yet
 * merged, so we render the same semantic using the existing shadcn Badge.
 * Replace with the package-level ReadinessBadge once Phase 0 lands.
 */
function ReadinessBadge({ stepsRemaining }: { stepsRemaining: number }) {
  return (
    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-500">
      {stepsRemaining > 0 ? `${stepsRemaining} igjen` : "Ikke klar"}
    </Badge>
  );
}
