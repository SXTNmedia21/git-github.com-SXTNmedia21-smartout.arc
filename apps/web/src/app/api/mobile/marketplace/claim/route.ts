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

// ── Capability + action literal (must match capability tools.ts) ─────────────
const CAP = "shift_marketplace";
const ACTION_CLAIM = "shift_marketplace.claim";

// ── Request schema ───────────────────────────────────────────────────────────
const ClaimSchema = z.object({
  offer_id: z.string().uuid(),
});

// ── Gate helper ──────────────────────────────────────────────────────────────
async function callGate(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  profileId: string,
  entityId: string,
): Promise<{ allowed: boolean; reason: string | null }> {
  // @authority-gate-ungated — CAP = "shift_marketplace" is a static module-level const.
  // shift_marketplace is seeded in engine_authority_config migrations.
  const { data, error } = await admin.rpc("gate_action", {
    p_workspace_id: workspaceId,
    p_actor_profile_id: profileId,
    p_capability: CAP,
    p_action_type: ACTION_CLAIM,
    p_entity_id: entityId,
    p_channel: "chat", // ADR-0288: claim is chat-only; mobile surface = chat
  });
  if (error) throw new Error(`gate_action RPC failed: ${error.message}`);
  const gate = data as { allowed: boolean; reason: string | null } | null;
  return gate ?? { allowed: false, reason: "Gate returned null" };
}

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

  // ── Gate (ADR-0099) ───────────────────────────────────────────────────────
  let gate: { allowed: boolean; reason: string | null };
  try {
    gate = await callGate(admin, workspaceId, profileId, offerId);
  } catch (err) {
    console.error("[mobile/marketplace/claim] gate_action RPC error:", err);
    return NextResponse.json({ ok: false, error: "gate_error" }, { status: 502 });
  }

  if (!gate.allowed) {
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
    console.error("[mobile/marketplace/claim] DB update error:", updateErr.message);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
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
