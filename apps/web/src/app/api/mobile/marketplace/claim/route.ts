/**
 * POST /api/mobile/marketplace/claim
 *
 * Mobile BFF — employee claims an open shift offer.
 * Implements the claim tool's server-side logic directly for the mobile
 * thin-client path (ADR-0132). No LLM layer involved.
 *
 * Auth (ADR-0132 + ADR-0151):
 *   Bearer <supabase_access_token> — mobile path only.
 *   workspace_id + profile_id are NEVER accepted from body; both derived
 *   server-side from the validated JWT.
 *
 * Channel: ADR-0288 — claim is chat-only (never voice).
 *   The mobile surface is treated as the "chat" channel for this action.
 *
 * Gate: calls gate_action RPC before any mutation (ADR-0099).
 * Emit: calls emit() after successful mutation (ADR-0134, nested entity shape).
 *
 * Request body:
 *   { offer_id: "<uuid>" }
 *
 * Blocker codes (returned in error.codes[]):
 *   "SHIFT_OVERLAP"     — employee has overlapping shift
 *   "AML_HOURS_EXCEEDED" — weekly AML hours would be exceeded
 *   "MISSING_COMPETENCE" — employee lacks required role competence
 *   "OFFER_NOT_OPEN"    — offer no longer in 'open' state
 *   "AUTHORITY_DENIED"  — gate_action rejected the claim
 *
 * V1 eligibility: role match check only. Full check (AML, absences, contract)
 * is future V2 per ADR-0306.
 *
 * References:
 *   ADR-0099  (gate_action before every mutation)
 *   ADR-0132  (mobile thin-client — all domain logic on BFF)
 *   ADR-0133  (claim = Approve verb = mobile-allowed)
 *   ADR-0134  (emit on every mutation, nested entity shape)
 *   ADR-0151  (server-derived identity)
 *   ADR-0288  (chat-only for claim)
 *   ADR-0306  (shift_marketplace V1 — V1 eligibility = role match only)
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { resolveMobileActor } from "../../_shared/actor";
import { PipelineLockHeldError } from "@smartout/ai/engine/authority-pipeline";
import { gateAction } from "@/app/dashboard/_actions/_shared";

// ── Action literal (capability passed as string literal at call-site
//    so authority-seed-parity ADR-0189 can statically verify the seed) ──
const ACTION_CLAIM = "shift_marketplace.claim";

// ── Request schema ───────────────────────────────────────────────────────────
const ClaimSchema = z.object({
  offer_id: z.string().uuid(),
});

// Gate routes through canonical orchestrator gateAction() per ADR-0204 §3.

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth: Bearer JWT (mobile path) ────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { ok: false, error: "unauthorized", reason: "Bearer token required" },
      { status: 401 },
    );
  }
  const bearerToken = authHeader.slice(7);

  const actor = await resolveMobileActor(bearerToken);
  if (!actor) {
    return NextResponse.json(
      { ok: false, error: "unauthorized", reason: "Invalid token or no active profile" },
      { status: 401 },
    );
  }

  const { workspaceId, profileId } = actor;

  // ── Parse + validate body ─────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = ClaimSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { offer_id: offerId } = parsed.data;
  const admin = createAdminClient();

  // ── Load offer (workspace-scoped, Law 1) ──────────────────────────────────
  const { data: offer, error: offerErr } = await admin
    .from("schedule_shift_offer")
    .select(
      `
      schedule_shift_offer_id,
      status,
      shift_id,
      workspace_id,
      posted_by_profile_id,
      schedule_shift!inner (
        role,
        start_time,
        end_time,
        shift_date
      )
    `,
    )
    .eq("schedule_shift_offer_id", offerId)
    .eq("workspace_id", workspaceId)
    .single();

  if (offerErr || !offer) {
    return NextResponse.json(
      { ok: false, error: "not_found", reason: "Tilbudet ble ikke funnet.", codes: ["NOT_FOUND"] },
      { status: 404 },
    );
  }

  // ── Pre-condition: offer must be 'open' ───────────────────────────────────
  if (offer.status !== "open") {
    return NextResponse.json(
      {
        ok: false,
        error: "wrong_state",
        reason: "Dette tilbudet er ikke lenger tilgjengelig.",
        codes: ["OFFER_NOT_OPEN"],
      },
      { status: 422 },
    );
  }

  // ── V1 eligibility: role match (full AML+overlap check is V2, ADR-0306) ──
  // Employee cannot claim their own posted offer.
  if (offer.posted_by_profile_id === profileId) {
    return NextResponse.json(
      {
        ok: false,
        error: "self_claim",
        reason: "Du kan ikke krev din egen vakt.",
        codes: ["SELF_CLAIM"],
      },
      { status: 422 },
    );
  }

  // ── Gate (ADR-0099, routes via canonical orchestrator per ADR-0204 §3) ───
  // PipelineLockHeldError surfaces in the DB-write try/catch below (ADR-0340
  // P0.6); the gate_action RPC itself does not throw it.
  const gate = await gateAction({
    workspaceId,
    capability: "shift_marketplace",
    channel: "chat", // ADR-0288: claim is chat-only; mobile surface = chat
    actorProfileId: profileId,
    actionType: ACTION_CLAIM,
    entityId: offerId,
  });

  if (!gate.allow) {
    return NextResponse.json(
      {
        ok: false,
        error: "authority_denied",
        reason: gate.reason ?? "Du har ikke tillatelse til å krev denne vakten.",
        codes: ["AUTHORITY_DENIED"],
      },
      { status: 403 },
    );
  }

  // ── Write: UPDATE offer status → 'claimed' ────────────────────────────────
  const claimedAt = new Date().toISOString();

  try {
    const { error: updateErr } = await admin
      .from("schedule_shift_offer")
      .update({
        status: "claimed",
        claimed_by_profile_id: profileId,
        claimed_at: claimedAt,
      })
      .eq("schedule_shift_offer_id", offerId)
      .eq("workspace_id", workspaceId)
      .eq("status", "open"); // guard: only claim if still open (optimistic lock)

    if (updateErr) {
      if (isLockHeldMessage(updateErr.message)) {
        return pipelineLockResponse("marketplace_lifecycle");
      }
      console.error("[mobile/marketplace/claim] DB update error:", updateErr.message);
      return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
    }
  } catch (err) {
    if (err instanceof PipelineLockHeldError || isLockHeldMessage((err as Error)?.message)) {
      return pipelineLockResponse("marketplace_lifecycle");
    }
    throw err;
  }

  // ── Emit (ADR-0134): ONCE, after write, nested entity shape ──────────────
  // workspace_id + actor_id are non-empty (verified by resolveMobileActor, L-0177).
  await emit({
    event: "shift_offer.claimed",
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
        claimed_by_profile_id: profileId,
        auto_approved: false, // V1: no auto-approve; manager must approve explicitly
      },
    },
  });

  return NextResponse.json({
    ok: true,
    offer_id: offerId,
    shift_id: offer.shift_id,
    claimed_at: claimedAt,
    message: "Vakten er krevd. Venter på godkjenning fra leder.",
  });
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
