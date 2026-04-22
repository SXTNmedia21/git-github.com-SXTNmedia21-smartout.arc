"use server";

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { runDevTool } from "@smartout/ai/capabilities/journey";
import type { AgentToolContext } from "@smartout/ai/capabilities/types";
import { resolveAdminProfile, assertPlatformAdmin } from "../../../actions/_shared";
import { gateAction } from "@/app/dashboard/_actions/_shared";

/**
 * startDevRunAction — N-C Server Action invoking the `journey.run_dev`
 * capability (ADR-0173 / ADR-0176).
 *
 * This is the Start-button hook for the admin test-run page. The capability
 * itself records a run intent in `engine_state` (status='queued') +
 * `engine_state_step` rows — Playwright is invoked out-of-band by a worker
 * that polls queued rows. The action returns `{ok, runId}` so the Fjernkontroll
 * can subscribe to `engine_event` realtime filtered by `run_id`.
 *
 * Actor resolution (ADR-0176 appendix §Dev):
 *   admin session JWT → resolveAdminProfile() → profileId + workspaceId.
 *   The capability body re-checks ADR-0134 non-empty as defense-in-depth.
 *
 * Authority (dual gate, matches publish-mission.ts):
 *   1. OUTER — `assertPlatformAdmin()` (godmode only).
 *   2. INNER — `gate_action` RPC (ADR-0099 / ADR-0176). The seeded default
 *      for `journey.run_dev` is `suggest` / workspace_admin; a Server Action
 *      has no confirm-loop, so a `suggest` downgrade is treated as denied.
 *      Godmode is NOT a substitute for the C4 layer (code-reviewer 2026-04-22).
 *
 * Channel: hard-pinned to "chat" (ADR-0078 — journey capabilities are
 * chat-only). No caller-controllable channel field.
 */
const InputSchema = z.object({
  journeyVersionId: z.string().uuid(),
});

export type StartDevRunResult = { ok: true; runId: string } | { ok: false; error: string };

export async function startDevRunAction(
  input: z.infer<typeof InputSchema>,
): Promise<StartDevRunResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const profile = await resolveAdminProfile();
  if (!profile) return { ok: false, error: "Not authenticated." };
  if (!(await assertPlatformAdmin(profile.userId))) {
    return { ok: false, error: "Platform-admin required." };
  }

  const admin = createAdminClient();

  // Pre-flight: journey_version must exist and be workspace-owned by the
  // admin's profile workspace. Dev runs accept ANY lifecycle status (draft,
  // ready_test, testing, ready_publish, published, archived) — only
  // publish_* capabilities gate on status.
  const { data: row, error: fetchErr } = await admin
    .from("journey_version")
    .select("status, workspace_id")
    .eq("journey_version_id", parsed.data.journeyVersionId)
    .single();
  if (fetchErr || !row) return { ok: false, error: `Not found: ${fetchErr?.message}` };
  if (row.workspace_id !== profile.workspaceId) {
    return { ok: false, error: "Cross-workspace dev-run forbidden." };
  }

  // ADR-0099 / ADR-0176 — canonical C4 gate.
  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "journey.run_dev",
    channel: "chat", // ADR-0078 — journey capability is chat-only
    actorProfileId: profile.profileId,
    actionType: "run_dev",
    entityId: parsed.data.journeyVersionId,
  });
  if (!gate.allow) {
    return {
      ok: false,
      error: `capability_disabled: ${gate.reason ?? "forbidden"}`,
    };
  }
  if (gate.downgrade_to === "suggest") {
    return {
      ok: false,
      error: "capability_disabled: run_dev downgraded to suggest; no confirm path in admin UI.",
    };
  }

  const ctx: AgentToolContext = {
    workspaceId: profile.workspaceId,
    profileId: profile.profileId,
    userId: profile.userId,
    sessionId: `platform-admin:run_dev:${profile.userId}`,
    supabaseAdmin: admin,
    channel: "chat", // ADR-0078
  };

  const raw = await runDevTool.execute({ journey_version_id: parsed.data.journeyVersionId }, ctx);

  let capResult: {
    ok?: boolean;
    run_id?: string;
    error?: string;
    message?: string;
    reason?: string;
    note?: string;
  };
  try {
    capResult = JSON.parse(raw) as typeof capResult;
  } catch {
    return { ok: false, error: "Capability returned non-JSON response." };
  }

  if (!capResult.ok || !capResult.run_id) {
    return {
      ok: false,
      error:
        capResult.message ??
        capResult.reason ??
        capResult.error ??
        "Capability rejected invocation.",
    };
  }

  return { ok: true, runId: capResult.run_id };
}
