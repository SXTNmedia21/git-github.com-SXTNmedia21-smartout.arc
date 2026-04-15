"use client";

/**
 * ShiftUnlockHint — actionable hint shown under a shift row when the assigned
 * profile is not Ready for one or more required protocols. Tells the employee
 * which protocol is missing, how much is left, and links them straight to the
 * corresponding training page.
 *
 * Consumes pending protocols produced by `useShiftReadinessCheck`, which
 * supplies the real `protocol_id` (UUID) plus denormalized step counters from
 * `protocol_assignment`.
 *
 * Part of Task 27 (governance training UI MVP): shift-gate UI unlock hint.
 */

import Link from "next/link";
import { motion } from "framer-motion";

import { ReadinessBadge } from "@smartout/ui";

export type MissingProtocol = {
  protocol_id: string;
  name: string;
  steps_remaining: number;
  test_pending?: boolean;
  confirmation_pending?: boolean;
};

export type ShiftUnlockHintProps = {
  missingProtocols: MissingProtocol[];
};

/**
 * Describe what's left for a pending protocol in human terms. Falls back to
 * "test gjenstår" / "signering gjenstår" when step counters are zero but a
 * test/confirmation is still outstanding.
 */
function formatRemaining(protocol: MissingProtocol): string {
  if (protocol.steps_remaining > 0) {
    return `${protocol.steps_remaining} steg igjen`;
  }
  if (protocol.test_pending) return "test gjenstår";
  if (protocol.confirmation_pending) return "signering gjenstår";
  return "fullfør opplæring";
}

/**
 * Map pending state to ReadinessBadge semantics. Any real progress (some steps
 * done but more left) reads as `in_progress`; otherwise `blocked`.
 */
function resolveState(protocol: MissingProtocol): "in_progress" | "blocked" {
  if (protocol.steps_remaining === 0 && (protocol.test_pending || protocol.confirmation_pending)) {
    return "in_progress";
  }
  return protocol.steps_remaining > 0 ? "in_progress" : "blocked";
}

export function ShiftUnlockHint({ missingProtocols }: ShiftUnlockHintProps) {
  if (!missingProtocols || missingProtocols.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 35, damping: 22, mass: 2.2 }}
      className="flex flex-col gap-1 border-l-2 border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[11px]"
      data-testid="shift-unlock-hint"
    >
      {missingProtocols.map((protocol) => (
        <div key={protocol.protocol_id} className="flex items-center gap-2">
          <ReadinessBadge state={resolveState(protocol)} />
          <span className="text-muted-foreground">
            <span className="text-foreground font-semibold">{protocol.name}</span>
            {" mangler — "}
            {formatRemaining(protocol)}
          </span>
          <Link
            href={`/dashboard/my-training/${protocol.protocol_id}`}
            className="text-amber-500 underline-offset-2 hover:underline"
            data-testid="shift-unlock-hint-link"
          >
            Gå til opplæring
          </Link>
        </div>
      ))}
    </motion.div>
  );
}
