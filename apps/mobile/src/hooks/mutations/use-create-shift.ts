/**
 * useCreateShift — Calls the web BFF to create a new schedule_shift.
 *
 * ADR-0270: mobile shift-create routes through POST /api/mobile/shifts (BFF).
 * The BFF wraps addShiftAction server-side, which enforces:
 * - C4 authority gate (roster.add_shift_manual)
 * - Server-derived workspace_id (ADR-0151 — never sent from body)
 * - Server-derived day_category (workspace tz, not device tz)
 * - Audit reason min-8-chars, source=manual_admin, is_published=true
 * - emit("shift added_manual") server-side (ADR-0134)
 *
 * Mobile-side emit("shift created") is REMOVED — server is now the sole
 * source of truth for shift-creation telemetry.
 *
 * Requires online connectivity — offline shift-create is out of scope
 * per ADR-0270 R4. Caller should surface an error banner if offline.
 */
import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { getMobileShiftsUrl } from "@/lib/web-api";

// TODO: BFF route not yet built (Phase 3a). Wire points to the expected URL.
// Once apps/web/src/app/api/mobile/shifts/route.ts is committed this works.
// See: apps/web/src/app/api/mobile/shifts/route.ts (Phase 3a deliverable)
const SHIFTS_BFF_URL = getMobileShiftsUrl();

/**
 * Shape of the POST body sent to the BFF.
 * workspace_id is intentionally absent — derived from JWT server-side (ADR-0151).
 */
export type CreateShiftPayload = {
  /** UUID of the target employee (not the actor) */
  profileId: string;
  /** UTC ISO-8601 start timestamp */
  startAtISO: string;
  /** UTC ISO-8601 end timestamp */
  endAtISO: string;
  /** Role or position label */
  role: string;
  /** Audit reason — min 8 chars (Aml. §14-6) */
  reason: string;
  /** Optional department override */
  departmentId?: string | null;
  /** Required when assigning an unavailable/absent employee */
  overrideReason?: string | null;
};

/**
 * Response shape from the BFF.
 * warnings[] carries informational messages (e.g. >5.5h shift without break).
 */
type BffResponse =
  | { ok: true; shiftId: string; warnings?: string[] }
  | { ok: false; error: string };

type UseCreateShiftReturn = {
  createShift: (payload: CreateShiftPayload) => Promise<BffResponse>;
  isSubmitting: boolean;
};

export function useCreateShift(): UseCreateShiftReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const createShift = useCallback(
    async (payload: CreateShiftPayload): Promise<BffResponse> => {
      setIsSubmitting(true);

      try {
        // Get the current session JWT for Bearer auth (ADR-0132 / ADR-0151)
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          return { ok: false, error: "Ikke autentisert. Logg inn på nytt." };
        }

        const response = await fetch(SHIFTS_BFF_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            profileId: payload.profileId,
            startAtISO: payload.startAtISO,
            endAtISO: payload.endAtISO,
            role: payload.role,
            reason: payload.reason,
            ...(payload.departmentId ? { departmentId: payload.departmentId } : {}),
            ...(payload.overrideReason ? { overrideReason: payload.overrideReason } : {}),
          }),
        });

        const result = (await response.json()) as BffResponse;

        if (result.ok) {
          // Invalidate shift list so it re-fetches with the new shift
          void queryClient.invalidateQueries({ queryKey: ["my-shifts"] });
        }

        return result;
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Nettverksfeil. Sjekk tilkoblingen.",
        };
      } finally {
        setIsSubmitting(false);
      }
    },
    [queryClient],
  );

  return { createShift, isSubmitting };
}
