/**
 * Availability mutation hooks — set, clear, acute.
 *
 * ADR-0132 (Mobile AI Routing): mobile MUST go through the web BFF. Direct
 * `supabase.from("employee_availability")` INSERT/UPDATE/DELETE is
 * FORBIDDEN — the BFF re-derives identity server-side (ADR-0176 Invariant
 * 3), runs the C4 authority gate (ADR-0201), then writes via a JWT-scoped
 * user client so table RLS re-verifies profile ownership.
 *
 * ADR-0176 Invariant 3: the request body MUST NOT contain workspace_id,
 * profile_id, or actor_id. The server binds identity to the authenticated
 * Supabase session.
 *
 * ADR-0134 (Mobile Telemetry Contract): every emit() resolves workspace_id
 * + actor_id via getProfileContext() BEFORE the call; empty-string
 * fallback is banned.
 *
 * Follows the useCallback pattern used by existing mobile mutation hooks
 * (e.g. use-swap.ts) rather than useMutation.
 *
 * Two export surfaces:
 *   1. Standalone hooks — useSetAvailability, useClearAvailability,
 *      useAcuteAvailability (named per Sortie 2 Task I brief).
 *   2. Bundled hook — useAvailability() returns `{ addWeeklyTemplate,
 *      deleteWeeklyTemplate, setDayStatus, setAcuteAvailable }` for
 *      call sites authored against the Task J stub shape (replaces
 *      that stub in-place; same method names).
 */

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { getProfileContext } from "@/lib/profile-context";
import { getAvailabilityClearUrl, getAvailabilitySetUrl } from "@/lib/web-api";
import { emit } from "@smartout/telemetry";

export type PreferenceType = "unavailable" | "preferred" | "blocked";

// ── Shared Bearer fetch helper ─────────────────────────────────────────────
// Identity fields are NEVER part of the body (ADR-0176 Invariant 3).

async function bffPost<TBody extends Record<string, unknown>>(
  url: string,
  body: TBody,
): Promise<Record<string, unknown>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Ikke innlogget.");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = (await res.json()) as Record<string, unknown>;
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    const msg = (parsed?.error as string | undefined) ?? `BFF ${res.status}`;
    throw new Error(msg);
  }

  return parsed ?? {};
}

// ── Set Availability ───────────────────────────────────────────────────────

export type SetAvailabilityPayload = {
  valid_from: string; // ISO date YYYY-MM-DD
  valid_to?: string | null;
  rrule?: string | null; // RFC-5545 RRULE or null for one-off
  preference_type: PreferenceType;
  reason?: string | null;
};

export type UseSetAvailabilityReturn = {
  setAvailability: (payload: SetAvailabilityPayload) => Promise<string | null>;
  isSubmitting: boolean;
};

export function useSetAvailability(): UseSetAvailabilityReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const setAvailability = useCallback(
    async (payload: SetAvailabilityPayload): Promise<string | null> => {
      setIsSubmitting(true);

      try {
        // Resolve BEFORE BFF so broken attribution fails fast (ADR-0134).
        // Server re-derives identity on its own (ADR-0176 Invariant 3);
        // we still need workspace + profile for telemetry attribution.
        const { profileId, workspaceId } = await getProfileContext();

        const result = await bffPost(getAvailabilitySetUrl(), {
          valid_from: payload.valid_from,
          valid_to: payload.valid_to ?? null,
          rrule: payload.rrule ?? null,
          preference_type: payload.preference_type,
          reason: payload.reason ?? null,
        });

        void queryClient.invalidateQueries({ queryKey: ["my-availability"] });
        void queryClient.invalidateQueries({ queryKey: ["team-availability"] });

        const availabilityId = (result.availability_id as string | null) ?? null;

        // Registry key uses the DOT convention (L-0129 + 2026-04-23 Council K1).
        // Guard on availabilityId so a degraded insert doesn't emit a
        // zero-id event.
        if (availabilityId) {
          void emit({
            event: "availability.set_own",
            workspace_id: workspaceId,
            actor_id: profileId,
            properties: {
              entity_type: "availability",
              entity_id: availabilityId,
              data: {
                availability_id: availabilityId,
                profile_id: profileId,
                workspace_id: workspaceId,
                preference_type: payload.preference_type,
                valid_from: payload.valid_from,
                valid_to: payload.valid_to ?? null,
                rrule: payload.rrule ?? null,
              },
            },
          });
        }

        return availabilityId;
      } finally {
        setIsSubmitting(false);
      }
    },
    [queryClient],
  );

  return { setAvailability, isSubmitting };
}

// ── Clear Availability ─────────────────────────────────────────────────────

export type ClearAvailabilityPayload = {
  availability_id: string;
};

export type UseClearAvailabilityReturn = {
  clearAvailability: (payload: ClearAvailabilityPayload) => Promise<void>;
  isSubmitting: boolean;
};

export function useClearAvailability(): UseClearAvailabilityReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const clearAvailability = useCallback(
    async (payload: ClearAvailabilityPayload): Promise<void> => {
      setIsSubmitting(true);

      try {
        const { profileId, workspaceId } = await getProfileContext();

        await bffPost(getAvailabilityClearUrl(), {
          availability_id: payload.availability_id,
        });

        void queryClient.invalidateQueries({ queryKey: ["my-availability"] });
        void queryClient.invalidateQueries({ queryKey: ["team-availability"] });

        // Registry key uses the DOT convention (L-0129 + 2026-04-23 Council K1).
        void emit({
          event: "availability.cleared",
          workspace_id: workspaceId,
          actor_id: profileId,
          properties: {
            entity_type: "availability",
            entity_id: payload.availability_id,
            data: {
              availability_id: payload.availability_id,
              profile_id: profileId,
              workspace_id: workspaceId,
            },
          },
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [queryClient],
  );

  return { clearAvailability, isSubmitting };
}

// ── Acute Availability ─────────────────────────────────────────────────────
// "Jeg kan jobbe ekstra i dag" — one-tap shortcut. Creates a preferred
// row with valid_from = today, valid_to = today, rrule = null, reason =
// 'acute_available'. Thin wrapper around useSetAvailability.

export type UseAcuteAvailabilityReturn = {
  setAcute: () => Promise<string | null>;
  isSubmitting: boolean;
};

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function useAcuteAvailability(): UseAcuteAvailabilityReturn {
  const { setAvailability, isSubmitting } = useSetAvailability();

  const setAcute = useCallback(async (): Promise<string | null> => {
    const today = todayIso();
    return setAvailability({
      valid_from: today,
      valid_to: today,
      rrule: null,
      preference_type: "preferred",
      reason: "acute_available",
    });
  }, [setAvailability]);

  return { setAcute, isSubmitting };
}

// ── Bundled Hook (Task J stub shape) ───────────────────────────────────────
// Exported for call sites that were authored against the Task J stub. It
// just re-packages the standalone hooks above — no new logic.

export type AddWeeklyTemplateInput = {
  /** RFC-5545 RRULE string, e.g. "FREQ=WEEKLY;BYDAY=MO" */
  rrule: string;
  valid_from: string;
  valid_to?: string | null;
  preference_type: PreferenceType;
  reason?: string | null;
};

export type SetDayStatusInput = {
  date: string;
  preference_type: PreferenceType | null; // null = clear
  reason?: string | null;
};

export type UseAvailabilityReturn = {
  addWeeklyTemplate: (input: AddWeeklyTemplateInput) => Promise<void>;
  deleteWeeklyTemplate: (id: string) => Promise<void>;
  setDayStatus: (input: SetDayStatusInput) => Promise<void>;
  /**
   * Clear a specific availability row by id. Use this for the day-detail
   * "Fjern" action — pass the DailyStatus.ruleId of the existing override.
   * If the day has no override (ruleId == null) the UI should no-op (the
   * day is already "available").
   */
  clearAvailabilityById: (availability_id: string) => Promise<void>;
  /** Quick "Kan jobbe ekstra i dag" — creates a preferred row for today only. */
  setAcuteAvailable: () => Promise<void>;
  isSubmitting: boolean;
};

export function useAvailability(): UseAvailabilityReturn {
  const { setAvailability, isSubmitting: isSetting } = useSetAvailability();
  const { clearAvailability, isSubmitting: isClearing } = useClearAvailability();
  const { setAcute, isSubmitting: isAcute } = useAcuteAvailability();

  const addWeeklyTemplate = useCallback(
    async (input: AddWeeklyTemplateInput): Promise<void> => {
      await setAvailability({
        valid_from: input.valid_from,
        valid_to: input.valid_to ?? null,
        rrule: input.rrule,
        preference_type: input.preference_type,
        reason: input.reason ?? null,
      });
    },
    [setAvailability],
  );

  const deleteWeeklyTemplate = useCallback(
    async (id: string): Promise<void> => {
      await clearAvailability({ availability_id: id });
    },
    [clearAvailability],
  );

  const setDayStatus = useCallback(
    async (input: SetDayStatusInput): Promise<void> => {
      // `preference_type === null` means "clear this day" — needs a prior
      // row id to DELETE. Task J's sheet must pass an id when clearing;
      // without one we surface an explicit error so the UI doesn't fail
      // silently (no-op-by-accident is worse than a loud error).
      if (input.preference_type === null) {
        throw new Error(
          "setDayStatus(null) requires a prior row id — call clearAvailability() with the row id instead.",
        );
      }
      await setAvailability({
        valid_from: input.date,
        valid_to: input.date,
        rrule: null,
        preference_type: input.preference_type,
        reason: input.reason ?? null,
      });
    },
    [setAvailability],
  );

  const setAcuteAvailable = useCallback(async (): Promise<void> => {
    await setAcute();
  }, [setAcute]);

  const clearAvailabilityById = useCallback(
    async (availability_id: string): Promise<void> => {
      await clearAvailability({ availability_id });
    },
    [clearAvailability],
  );

  return {
    addWeeklyTemplate,
    deleteWeeklyTemplate,
    setDayStatus,
    clearAvailabilityById,
    setAcuteAvailable,
    isSubmitting: isSetting || isClearing || isAcute,
  };
}
