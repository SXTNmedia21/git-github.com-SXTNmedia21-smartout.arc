// apps/web/src/components/RevealableField.tsx
// What: Renders Høy-PII field values masked by default; click-to-reveal for 5s then auto-masks.
// Why: ADR-0234 §Høy-PII — personal_number, bank_account, tax_* require masking + audit emit.
// Reusable across contract and payroll surfaces — not contract-only.
// Reveal emits contract.pii.revealed to activity_trail. Auto-masks after 5000ms.
// Driving ADR: ADR-0234 (payroll capability split — PII handling + RevealableField requirement)
//
// Motion: opacity crossfade between masked/revealed states uses motionTokens.exitMs / 1000
// with useReducedMotion guard — instant swap if reduced (WCAG AAA requirement per ADR-0236).

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Eye, EyeOff, Lock } from "lucide-react";
import { motion as motionTokens } from "@smartout/design-tokens";
import { emit, nonEmpty } from "@smartout/telemetry";

const REVEAL_DURATION_MS = 5000;
const MASK = "••••••••";

interface RevealableFieldProps {
  label: string;
  value: string;
  fieldName: string;
  profileId: string;
  workspaceId: string;
  /** When true the field is being viewed by the profile owner (audit: is_self = true). */
  isSelf?: boolean;
  /** Actor profile_id for telemetry. Defaults to profileId when isSelf. */
  actorProfileId?: string;
}

export function RevealableField({
  label,
  value,
  fieldName,
  profileId,
  workspaceId,
  isSelf = false,
  actorProfileId,
}: RevealableFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefersReduced = useReducedMotion();

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleReveal = useCallback(() => {
    if (revealed) {
      // Second click hides immediately
      setRevealed(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    setRevealed(true);

    // Emit audit event (ADR-0234)
    void emit({
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(actorProfileId ?? profileId, "actor_id"),
      event: "contract.pii.revealed",
      properties: {
        entity: { entity_type: "profile", entity_id: profileId },
        data: {
          pii_field: fieldName,
          revealed: true,
          target_profile_id: profileId,
          is_self: isSelf,
        },
      },
    });

    // Auto-mask after 5s
    timerRef.current = setTimeout(() => {
      setRevealed(false);
    }, REVEAL_DURATION_MS);
  }, [revealed, workspaceId, actorProfileId, profileId, fieldName, isSelf]);

  const hasValue = !!value;
  const duration = prefersReduced ? 0 : motionTokens.exitMs / 1000;

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <AnimatePresence mode="wait">
          {revealed && hasValue ? (
            <motion.span
              key="revealed"
              initial={prefersReduced ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={prefersReduced ? {} : { opacity: 0 }}
              transition={{ duration }}
              className="text-foreground font-mono text-sm"
              aria-label={`${label} — synlig`}
            >
              {value}
            </motion.span>
          ) : (
            <motion.span
              key="masked"
              initial={prefersReduced ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={prefersReduced ? {} : { opacity: 0 }}
              transition={{ duration }}
              className="text-muted-foreground font-mono text-sm tracking-widest"
              aria-label={`${label} — skjult`}
            >
              {hasValue ? MASK : "—"}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {hasValue && (
        <button
          type="button"
          onClick={handleReveal}
          className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
          aria-label={
            revealed ? `Skjul ${label}` : `Vis ${label} i ${REVEAL_DURATION_MS / 1000} sekunder`
          }
          title={revealed ? "Klikk for å skjule" : "Klikk for å vise"}
        >
          {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}

      {!hasValue && (
        <Lock className="text-muted-foreground h-4 w-4 shrink-0 opacity-40" aria-hidden="true" />
      )}
    </div>
  );
}
