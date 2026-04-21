"use server";

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit } from "@smartout/telemetry";
import type { SmartoutEvent } from "@smartout/telemetry";
import { resolveCurrentProfile, gateAction } from "./_shared";

/**
 * transitionSessionAction — move a `department_session` through the lifecycle
 *   upcoming → active → pending_signoff → closed (+ reverts + missed).
 *
 * Each transition is gated separately (`session.transition` for most hops,
 * `session.signoff` for closed) and validated against a legal-transitions map.
 * Invariant #13: admin may revert or rescue (e.g. closed → pending_signoff,
 * missed → active) to avoid dead-end states.
 */

const TARGETS = ["active", "pending_signoff", "closed", "missed"] as const;
type TargetStatus = (typeof TARGETS)[number];

const InputSchema = z.object({
  sessionId: z.string().uuid(),
  target: z.enum(TARGETS),
});

export type TransitionSessionInput = z.infer<typeof InputSchema>;
export type TransitionSessionResult = { ok: true } | { ok: false; error: string };

type SessionStatus = "upcoming" | "active" | "pending_signoff" | "closed" | "missed";

const LEGAL_TRANSITIONS: Record<SessionStatus, ReadonlyArray<TargetStatus>> = {
  upcoming: ["active", "missed"],
  active: ["pending_signoff", "closed"],
  pending_signoff: ["closed", "active"], // admin may revert
  closed: ["pending_signoff"], // admin may re-open
  missed: ["active"], // admin may rescue retroactively
};

export async function transitionSessionAction(
  input: TransitionSessionInput,
): Promise<TransitionSessionResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ugyldig input.",
    };
  }

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Ikke autentisert." };

  const admin = createAdminClient();

  const { data: session } = await admin
    .from("department_session")
    .select("workspace_id, status, department_id, session_date")
    .eq("department_session_id", parsed.data.sessionId)
    .single();
  if (!session) return { ok: false, error: "Fant ikke session." };
  if (session.workspace_id !== profile.workspaceId) {
    return { ok: false, error: "Session hører til annet workspace." };
  }

  const fromStatus = session.status as SessionStatus;
  const allowed = LEGAL_TRANSITIONS[fromStatus] ?? [];
  if (!allowed.includes(parsed.data.target)) {
    return {
      ok: false,
      error: `Kan ikke gå fra ${fromStatus} til ${parsed.data.target}.`,
    };
  }

  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: parsed.data.target === "closed" ? "session.signoff" : "session.transition",
    channel: "chat",
    actorProfileId: profile.profileId,
    actionType: "update",
    entityId: parsed.data.sessionId,
  });
  if (!gate.allow) {
    return { ok: false, error: gate.reason ?? "Ikke autorisert." };
  }

  const now = new Date().toISOString();
  const update: {
    status: SessionStatus;
    updated_at: string;
    opened_at?: string;
    opened_by?: string;
    closed_at?: string;
    closed_by?: string;
  } = {
    status: parsed.data.target,
    updated_at: now,
  };
  if (parsed.data.target === "active" && fromStatus !== "active") {
    update.opened_at = now;
    update.opened_by = profile.profileId;
  }
  if (parsed.data.target === "closed") {
    update.closed_at = now;
    update.closed_by = profile.profileId;
  }

  const { error: updateError } = await admin
    .from("department_session")
    .update(update)
    .eq("department_session_id", parsed.data.sessionId);
  if (updateError) return { ok: false, error: updateError.message };

  const eventName: SmartoutEvent["event"] =
    parsed.data.target === "active"
      ? "session opened"
      : parsed.data.target === "pending_signoff"
        ? "session pending_signoff"
        : parsed.data.target === "closed"
          ? "session closed"
          : "session missed";

  await emit({
    event: eventName,
    workspace_id: session.workspace_id,
    actor_id: profile.profileId,
    properties: {
      entity: {
        entity_type: "department_session",
        entity_id: parsed.data.sessionId,
      },
      data: {
        department_id: session.department_id,
        date: session.session_date,
        department_session_id: parsed.data.sessionId,
        from_status: fromStatus,
        to_status: parsed.data.target,
        manual: true,
      },
    },
  } as SmartoutEvent);

  return { ok: true };
}
