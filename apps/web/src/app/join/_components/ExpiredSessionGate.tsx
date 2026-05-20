"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createClient } from "@smartout/supabase/client";
import { loadJoinState } from "../_lib/storage";
import { JOIN_STORAGE_KEY } from "../types";

/**
 * Detects expired-session restore case at /join page load:
 * - If localStorage has a valid (in-TTL) wizard envelope with account.email set
 * - AND Supabase cookie session resolves to no authenticated user
 * → redirect to /login?return_to=/join&reason=expired before the user wastes time refilling.
 *
 * Renders children unchanged when the gate does not fire (fresh visitor, no
 * envelope, or authenticated session present).
 *
 * ADR-0357 invariant: this component never reads or stores access tokens.
 * It only checks whether a session cookie is alive via supabase.auth.getUser().
 */
export function ExpiredSessionGate({ children }: { children: ReactNode }) {
  const checked = useRef(false);
  // Render null while the async session check is in-flight to prevent the
  // wizard flashing Step 6 before a redirect fires (Patch 5 — UX guard).
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    const envelope = loadJoinState();
    // Only rescue when there is resumable state with an email (i.e. the user
    // reached at least Step 1 in a prior session). First-time visitors have no
    // envelope — resolve immediately so they see no blank flash.
    if (!envelope?.account?.email) {
      setChecking(false);
      return;
    }

    const supabase = createClient();
    void supabase.auth
      .getUser()
      .then(({ data }) => {
        if (data?.user) {
          // Session is alive — let the wizard render.
          setChecking(false);
          return;
        }

        // Session is absent — redirect. Do NOT setChecking(false) here;
        // the page is navigating away, no paint needed.

        // Emit telemetry before redirect — best-effort, must not block.
        try {
          // Dynamic import keeps server-only telemetry out of this client bundle path.
          void import("@smartout/telemetry").then(({ emit }) => {
            // Compute envelope age for analytics (how long the session had been idle).
            let envelopeAgeHours: number | null = null;
            try {
              const raw = localStorage.getItem(JOIN_STORAGE_KEY);
              if (raw) {
                const parsed = JSON.parse(raw) as { savedAt?: string };
                if (parsed.savedAt) {
                  const ms = Date.now() - Date.parse(parsed.savedAt);
                  envelopeAgeHours = Math.round((ms / (1000 * 60 * 60)) * 10) / 10;
                }
              }
            } catch {
              // best-effort
            }
            void emit({
              event: "join.session_expired_rescued",
              workspace_id: null,
              actor_id: null,
              properties: { data: { has_envelope: true, envelope_age_hours: envelopeAgeHours } },
            });
          });
        } catch {
          // never block redirect on telemetry failure
        }

        window.location.replace("/login?return_to=/join&reason=expired");
      })
      .catch((err) => {
        // Fail-open: if the auth check itself rejects (network error, etc.),
        // log the problem and let the wizard render rather than blocking forever.
        console.warn("[ExpiredSessionGate] auth check failed:", err);
        setChecking(false);
      });
  }, []);

  if (checking) return null;
  return <>{children}</>;
}
