"use client";

/**
 * RedactedPill — visual marker for PII that was replaced by the recorder
 * redactor (ADR-0184) before persistence.
 *
 * Nordic Split contract:
 *   - Muted chip colour (bg-muted/60, text-muted-foreground) — signals
 *     "system metadata, not content". No destructive red, no warning amber.
 *   - Lucide Shield icon at h-2.5 w-2.5 — small, non-shouting.
 *   - Content stays readable: ‹email› not ••••••@••••.•• and not a blur.
 *
 * If the caller provides both an `envelopeId` and an `onReveal` handler, a
 * small "Vis (5s)" button appears. Reveal itself is the caller's job — the
 * pill is deliberately dumb about break-glass semantics (ADR-0185). The 5s
 * contract is implemented upstream via the /break-glass endpoint auto-expiry.
 */

import { Shield } from "lucide-react";

type RedactedPillProps = {
  piiClass: string;
  envelopeId?: string | null;
  onReveal?: () => void;
};

export function RedactedPill({ piiClass, envelopeId, onReveal }: RedactedPillProps) {
  const canReveal = Boolean(envelopeId && onReveal);

  return (
    <span
      className="bg-muted/60 text-muted-foreground inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[0.85em]"
      title={canReveal ? "Hover for å vise (5s)" : "Redacted by policy"}
    >
      <Shield className="h-2.5 w-2.5" />
      <span>‹{piiClass}›</span>
      {canReveal ? (
        <button
          onClick={onReveal}
          className="text-[0.9em] underline-offset-2 opacity-60 transition-opacity hover:underline hover:opacity-100"
          type="button"
        >
          Vis (5s)
        </button>
      ) : null}
    </span>
  );
}
