/**
 * POST /api/marketplace/action
 *
 * Web manager BFF for marketplace mutation actions: approve_claim + cancel_offer.
 * Implements the same gate + write + emit chain as the capability tools (ADR-0287),
 * invoked directly from the web manager UI without going through the LLM layer.
 *
 * Auth (ADR-0151):
 *   Cookie session only (web dashboard). workspace_id + profile_id are
 *   server-derived — NEVER accepted from request body.
 *
 * Channel: forced to "chat" — this BFF is a web dashboard action (ADR-0288).
 *
 * Gate: calls gate_action RPC before any mutation (ADR-0099).
 * Emit: calls emit() after successful mutation (ADR-0134). Nested entity shape.
 *
 * Role guard (in addition to gate_action RPC):
 *   approve_claim: manager/admin/owner only (pre-gate fast-fail).
 *   cancel_offer: poster or manager/admin/owner (gate_action enforces authz).
 *
 * Request body:
 *   { action: "approve_claim", offer_id: "<uuid>" }
 *   { action: "cancel_offer",  offer_id: "<uuid>", reason: "<string, min 5>" }
 *
 * References:
 *   ADR-0099  (gate_action before every mutation)
 *   ADR-0133  (approve = Approve verb; web BFF = chat surface)
 *   ADR-0134  (emit on every mutation, nested entity shape)
 *   ADR-0151  (server-derived identity)
 *   ADR-0288  (chat-only for approve_claim)
 *   ADR-0306  (shift_marketplace V1)
 */

import { randomUUID } from "crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { PipelineLockHeldError } from "@smartout/ai/engine/authority-pipeline";

// ── Capability + action literals (must match capability tools.ts) ────────────
const CAP = "shift_marketplace";
const ACTION_APPROVE = "shift_marketplace.approve_claim";
const ACTION_CANCEL = "shift_marketplace.cancel_offer";

// ── Manager roles ────────────────────────────────────────────────────────────
const MANAGER_ROLES = new Set(["manager", "admin", "owner"]);

// ── Request schema ───────────────────────────────────────────────────────────
const ActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve_claim"),
    offer_id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("cancel_offer"),
    offer_id: z.string().uuid(),
    reason: z.string().min(5),
  }),
]);

// ── Gate action helper ───────────────────────────────────────────────────────
// Calls the gate_action RPC (ADR-0099). Returns { allowed, reason }.
async function callGate(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  profileId: string,
  capability: string,
  actionType: string,
  entityId: string,
): Promise<{ allowed: boolean; reason: string | null }> {
  const { data, error } = await admin.rpc("gate_action", {
    p_workspace_id: workspaceId,
    p_actor_profile_id: profileId,
    p_capability: capability,
    p_action_type: actionType,
    p_entity_id: entityId,
    p_channel: "chat",
  });
  if (error) throw new Error(`gate_action RPC failed: ${error.message}`);
  const gate = data as { allowed: boolean; reason: string | null } | null;
  return gate ?? { allowed: false, reason: "Gate returned null" };
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth: cookie session ──────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── Server-derive workspace_id + profile_id (ADR-0151) ───────────────────
  const admin = createAdminClient();
  const { data: profile, error: profileErr } = await admin
    .from("profile")
    .select("profile_id, workspace_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (profileErr || !profile) {
    return NextResponse.json({ error: "no_active_profile" }, { status: 401 });
  }

  // Fail-fast on empty identity (L-0177).
  if (!profile.profile_id?.trim() || !profile.workspace_id?.trim()) {
    return NextResponse.json({ error: "identity_incomplete" }, { status: 401 });
  }

  const workspaceId = profile.workspace_id as string;
  const profileId = profile.profile_id as string;

  // ── Parse + validate body ─────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const action = parsed.data;

  // ── Role guard: approve_claim requires manager+ ───────────────────────────
  if (action.action === "approve_claim" && !MANAGER_ROLES.has(profile.role ?? "")) {
    return NextResponse.json(
      { error: "forbidden", reason: "Kun manager, admin og eier kan godkjenne krav." },
      { status: 403 },
    );
  }

  // ── Dispatch action ───────────────────────────────────────────────────────
  // Wrap in try/catch so PipelineLockHeldError thrown by the capability layer
  // surfaces as 409 PIPELINE_LOCK_HELD (ADR-0328 / ADR-0340).
  try {
    if (action.action === "approve_claim") {
      return await handleApproveClaim(admin, workspaceId, profileId, action.offer_id);
    } else {
      return await handleCancelOffer(admin, workspaceId, profileId, action.offer_id, action.reason);
    }
  } catch (err) {
    if (err instanceof PipelineLockHeldError || isLockHeldMessage((err as Error)?.message)) {
      return pipelineLockResponse("marketplace_lifecycle");
    }
    throw err;
  }
}

// ── Pipeline lock helpers (ADR-0328) ─────────────────────────────────────────

/** Returns true for error messages that signal a held pipeline lock. */
function isLockHeldMessage(msg: string | undefined): boolean {
  if (!msg) return false;
  return (
    msg.includes("PIPELINE_LOCK_HELD") ||
    msg.includes("pipeline_lock_held") ||
    msg.includes("Pipeline lock is already held")
  );
}

/** Structured 409 response for pipeline lock contention (ADR-0328). */
function pipelineLockResponse(lockingBlueprintId: string): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: "PIPELINE_LOCK_HELD",
      locking_blueprint_id: lockingBlueprintId,
    },
    { status: 409 },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// approve_claim handler
// ─────────────────────────────────────────────────────────────────────────────

async function handleApproveClaim(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  profileId: string,
  offerId: string,
): Promise<NextResponse> {
  // Load offer (workspace-scoped, Law 1).
  const { data: offer, error: offerErr } = await admin
    .from("schedule_shift_offer")
    .select("schedule_shift_offer_id, status, shift_id, workspace_id, claimed_by_profile_id")
    .eq("schedule_shift_offer_id", offerId)
    .eq("workspace_id", workspaceId)
    .single();

  if (offerErr || !offer) {
    return NextResponse.json(
      { ok: false, error: "not_found", reason: "Tilbudet ble ikke funnet." },
      { status: 404 },
    );
  }

  if (offer.status !== "claimed") {
    return NextResponse.json(
      {
        ok: false,
        error: "wrong_state",
        reason: `Tilbudet kan ikke godkjennes — status er '${offer.status}'.`,
      },
      { status: 422 },
    );
  }

  if (!offer.claimed_by_profile_id) {
    return NextResponse.json(
      { ok: false, error: "no_claimer", reason: "Tilbudet har ingen krevende ansatt." },
      { status: 422 },
    );
  }

  const claimedBy = offer.claimed_by_profile_id as string;
  const shiftId = offer.shift_id as string;

  // ── Gate (ADR-0099) ───────────────────────────────────────────────────────
  let gate: { allowed: boolean; reason: string | null };
  try {
    gate = await callGate(admin, workspaceId, profileId, CAP, ACTION_APPROVE, offerId);
  } catch (err) {
    console.error("[marketplace/action] gate_action RPC error:", err);
    return NextResponse.json({ ok: false, error: "gate_error" }, { status: 502 });
  }

  if (!gate.allowed) {
    return NextResponse.json(
      { ok: false, error: "authority_denied", reason: gate.reason ?? "Ikke tillatt." },
      { status: 403 },
    );
  }

  // ── Transactional write (ADR-0306: both in single gate eval) ─────────────
  const approvedAt = new Date().toISOString();

  const { error: shiftErr } = await admin
    .from("schedule_shift")
    .update({ employee_id: claimedBy })
    .eq("schedule_shift_id", shiftId)
    .eq("workspace_id", workspaceId);

  if (shiftErr) {
    console.error("[marketplace/action] approve_claim shift update error:", shiftErr.message);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }

  const { error: offerUpdateErr } = await admin
    .from("schedule_shift_offer")
    .update({
      status: "approved",
      approved_by_profile_id: profileId,
      approved_at: approvedAt,
    })
    .eq("schedule_shift_offer_id", offerId)
    .eq("workspace_id", workspaceId)
    .eq("status", "claimed"); // guard: only close if still claimed

  if (offerUpdateErr) {
    console.error("[marketplace/action] approve_claim offer update error:", offerUpdateErr.message);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }

  // ── Emit (ADR-0134): ONCE, after both writes succeed, nested entity shape ──
  await emit({
    event: "shift_offer.approved",
    workspace_id: nonEmpty(workspaceId, "workspaceId"),
    actor_id: nonEmpty(profileId, "profileId"),
    properties: {
      entity: {
        entity_type: "schedule_shift_offer",
        entity_id: offerId,
      },
      data: {
        schedule_shift_offer_id: offerId,
        shift_id: shiftId,
        approved_by_profile_id: profileId,
        claimed_by_profile_id: claimedBy,
        gate_evaluation_id: randomUUID(),
      },
    },
  });

  return NextResponse.json({
    ok: true,
    offer_id: offerId,
    shift_id: shiftId,
    assigned_to: claimedBy,
    message: "Krav godkjent. Vakten er nå tildelt den ansatte.",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// cancel_offer handler
// ─────────────────────────────────────────────────────────────────────────────

async function handleCancelOffer(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  profileId: string,
  offerId: string,
  reason: string,
): Promise<NextResponse> {
  // Load offer (workspace-scoped, Law 1).
  const { data: offer, error: offerErr } = await admin
    .from("schedule_shift_offer")
    .select("schedule_shift_offer_id, status, workspace_id, posted_by_profile_id, shift_id")
    .eq("schedule_shift_offer_id", offerId)
    .eq("workspace_id", workspaceId)
    .single();

  if (offerErr || !offer) {
    return NextResponse.json(
      { ok: false, error: "not_found", reason: "Tilbudet ble ikke funnet." },
      { status: 404 },
    );
  }

  const cancelableStatuses = ["open", "claimed"] as const;
  if (!(cancelableStatuses as readonly string[]).includes(offer.status as string)) {
    return NextResponse.json(
      {
        ok: false,
        error: "wrong_state",
        reason: `Kan ikke kansellere et tilbud med status '${offer.status}'.`,
      },
      { status: 422 },
    );
  }

  // ── Gate (ADR-0099) ───────────────────────────────────────────────────────
  let gate: { allowed: boolean; reason: string | null };
  try {
    gate = await callGate(admin, workspaceId, profileId, CAP, ACTION_CANCEL, offerId);
  } catch (err) {
    console.error("[marketplace/action] gate_action RPC error:", err);
    return NextResponse.json({ ok: false, error: "gate_error" }, { status: 502 });
  }

  if (!gate.allowed) {
    return NextResponse.json(
      { ok: false, error: "authority_denied", reason: gate.reason ?? "Ikke tillatt." },
      { status: 403 },
    );
  }

  // ── Write ─────────────────────────────────────────────────────────────────
  const { error: updateErr } = await admin
    .from("schedule_shift_offer")
    .update({
      status: "cancelled",
      cancel_reason: reason,
    })
    .eq("schedule_shift_offer_id", offerId)
    .eq("workspace_id", workspaceId)
    .in("status", [...cancelableStatuses]);

  if (updateErr) {
    console.error("[marketplace/action] cancel_offer update error:", updateErr.message);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }

  // ── Emit (ADR-0134) ───────────────────────────────────────────────────────
  await emit({
    event: "shift_offer.cancelled",
    workspace_id: nonEmpty(workspaceId, "workspaceId"),
    actor_id: nonEmpty(profileId, "profileId"),
    properties: {
      entity: {
        entity_type: "schedule_shift_offer",
        entity_id: offerId,
      },
      data: {
        schedule_shift_offer_id: offerId,
        shift_id: offer.shift_id as string,
        cancelled_by_profile_id: profileId,
        cancel_reason: reason,
        gate_evaluation_id: null,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    offer_id: offerId,
    message: "Tilbudet er kansellert.",
  });
}
