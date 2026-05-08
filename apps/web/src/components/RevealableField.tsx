// apps/web/src/components/RevealableField.tsx
// What: Renders Høy-PII field values masked by default; click-to-reveal for 5s then auto-masks.
// Why: ADR-0242 §Høy-PII — personal_number, bank_account, tax_* require masking + audit emit.
// Reusable across contract and payroll surfaces — not contract-only.
// Reveal emits contract.pii.revealed to activity_trail. Auto-masks after 5000ms.
// Driving ADR: ADR-0242 (payroll capability split — PII handling + RevealableField requirement)
//
// Two modes:
//   1. Static mode (default): caller passes `value` directly. Reveal toggles mask/unmask.
//      Used on my-contract page where the server already resolved the value.
//   2. BFF-fetch mode: pass `fetchEndpoint` instead of `value`. On first reveal click the
//      component POSTs to the endpoint, receives the actual value, then shows it masked/revealed.
//      Body sent: { profileId }. Response shape: { ok, value, has_value }.
//      Used on payroll admin surfaces (ADR-0242 + ADR-0151 — value never fetched client-side).
//
// Motion: opacity crossfade between masked/revealed states uses motionTokens.exitMs / 1000
// with useReducedMotion guard — instant swap if reduced (WCAG AAA requirement per ADR-0244).

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Eye, EyeOff, Lock, Loader2 } from "lucide-react";
import { motion as motionTokens } from "@smartout/design-tokens";
import { emit, nonEmpty } from "@smartout/telemetry";

const REVEAL_DURATION_MS = 5000;
const MASK = "••••••••";

interface RevealableFieldBaseProps {
  label: string;
  fieldName: string;
  profileId: string;
  workspaceId: string;
  /** When true the field is being viewed by the profile owner (audit: is_self = true). */
  isSelf?: boolean;
  /** Actor profile_id for telemetry. Defaults to profileId when isSelf. */
  actorProfileId?: string;
}

interface RevealableFieldStaticProps extends RevealableFieldBaseProps {
  /** The plain-text value to show/mask. Required when fetchEndpoint is not set. */
  value: string;
  fetchEndpoint?: never;
}

interface RevealableFieldFetchProps extends RevealableFieldBaseProps {
  value?: never;
  /**
   * BFF endpoint to POST to on first reveal click.
   * Body: { profileId }. Response: { ok, value: string | null, has_value: boolean }.
   * Used on payroll admin surfaces (ADR-0151 — PII never fetched raw by the client).
   */
  fetchEndpoint: string;
}

type RevealableFieldProps = RevealableFieldStaticProps | RevealableFieldFetchProps;

export function RevealableField({
  label,
  fieldName,
  profileId,
  workspaceId,
  isSelf = false,
  actorProfileId,
  ...modeProps
}: RevealableFieldProps) {
  const isFetchMode = "fetchEndpoint" in modeProps && !!modeProps.fetchEndpoint;

  // In fetch mode the value starts null; it's populated on first reveal.
  const [fetchedValue, setFetchedValue] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [revealed, setRevealed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefersReduced = useReducedMotion();

  // The resolved value used for display.
  const resolvedValue = isFetchMode
    ? (fetchedValue ?? "")
    : (modeProps as RevealableFieldStaticProps).value;

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleReveal = useCallback(async () => {
    if (revealed) {
      // Second click hides immediately
      setRevealed(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    // BFF-fetch mode: fetch the value before revealing, but only if not yet fetched.
    if (isFetchMode && fetchedValue === null) {
      setFetching(true);
      setFetchError(null);
      try {
        const res = await fetch((modeProps as RevealableFieldFetchProps).fetchEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          value?: string | null;
          has_value?: boolean;
          reason?: string;
        };
        if (!data.ok) {
          setFetchError(data.reason ?? "Kunne ikke hente verdi");
          setFetching(false);
          return;
        }
        setFetchedValue(data.value ?? "");
      } catch {
        setFetchError("Nettverksfeil");
        setFetching(false);
        return;
      }
      setFetching(false);
    }

    setRevealed(true);

    // Emit audit event (ADR-0242)
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
  }, [
    revealed,
    isFetchMode,
    fetchedValue,
    modeProps,
    profileId,
    workspaceId,
    actorProfileId,
    fieldName,
    isSelf,
  ]);

  // In fetch mode: has_value is unknown until after first fetch.
  // Before fetch: show the button so admin can trigger the reveal.
  // After fetch: has_value is determined by whether fetchedValue is non-empty.
  const hasValue = isFetchMode
    ? fetchedValue === null // before first fetch — show button optimistically
      ? true
      : !!fetchedValue
    : !!resolvedValue;

  const duration = prefersReduced ? 0 : motionTokens.exitMs / 1000;

  // Show fetch error inline (below the field row)
  if (fetchError) {
    return <p className="text-destructive text-xs">{fetchError}</p>;
  }

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
              {resolvedValue}
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
          onClick={() => void handleReveal()}
          disabled={fetching}
          className="text-muted-foreground hover:text-foreground shrink-0 transition-colors disabled:opacity-40"
          aria-label={
            fetching
              ? "Henter…"
              : revealed
                ? `Skjul ${label}`
                : `Vis ${label} i ${REVEAL_DURATION_MS / 1000} sekunder`
          }
          title={fetching ? "Henter…" : revealed ? "Klikk for å skjule" : "Klikk for å vise"}
        >
          {fetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : revealed ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      )}

      {!hasValue && !isFetchMode && (
        <Lock className="text-muted-foreground h-4 w-4 shrink-0 opacity-40" aria-hidden="true" />
      )}
    </div>
  );
}
