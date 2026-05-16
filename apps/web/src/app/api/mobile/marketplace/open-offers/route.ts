/**
 * GET /api/mobile/marketplace/open-offers
 *
 * Mobile pull-poll BFF — open shift offers for the authenticated employee.
 * V1: pull-poll only. Push fanout (Edge Function shift-offer-notify) deferred to V2.
 * See HANDOFF note: "Pull-poll V1; push fanout V2 ADR-0136".
 *
 * Returns up to 50 open offers for the caller's workspace. Offers are pre-filtered
 * to `status='open'` with optional workspace-level eligibility pre-filter
 * (role match only — full eligibility check happens at claim time in the capability tool).
 *
 * Auth (ADR-0132 + ADR-0151):
 *   - Authorization: Bearer <supabase_access_token> — mobile path only.
 *   - workspace_id + profile_id are NEVER accepted from query params or body;
 *     both are derived server-side from the validated JWT.
 *   - Cookie auth is NOT supported — exclusively for mobile clients.
 *
 * Identity (ADR-0151):
 *   - workspace_id: JWT → profile.workspace_id
 *   - profile_id:   JWT → profile.profile_id
 *
 * Channel: read-only GET. No mutations, no gate_action call. No emit() needed.
 *
 * Response shape (per OpenOffer client type):
 *   { offers: OpenOffer[], total: number }
 *
 * Rate: mobile clients refetch on 30_000ms interval (TanStack Query refetchInterval).
 *   LIMIT 50 hard cap in query.
 *
 * ADR-0306: V1 eligibility pre-filter = role match only.
 *   Full check (AML hours, absences, contract) runs at claim time inside the
 *   capability tool. Pre-filter reduces noise for employees who obviously
 *   can't fill a kitchen role (server competence only) — not a correctness gate.
 *
 * References:
 *   ADR-0132 (mobile thin-client — all domain logic on BFF)
 *   ADR-0133 (claim = Approve verb = mobile-allowed)
 *   ADR-0151 (server-derived identity)
 *   ADR-0306 (shift_marketplace V1 — pull-poll only, no push EF)
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { resolveMobileActor } from "../../_shared/actor";

// ── Response types ───────────────────────────────────────────────────────────

export type OpenOffer = {
  schedule_shift_offer_id: string;
  shift_id: string;
  /** ISO 8601. */
  posted_at: string;
  /** ISO 8601 or null. */
  expires_at: string | null;
  posted_by_profile_id: string;
  /** Joined from schedule_shift. */
  shift: {
    shift_date: string;
    start_time: string;
    end_time: string;
    role: string | null;
    department_id: string | null;
    position_id: string | null;
  } | null;
};

export type OpenOffersResponse = {
  offers: OpenOffer[];
  total: number;
};

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth: Bearer JWT (mobile path) ────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "unauthorized", reason: "Bearer token required" },
      { status: 401 },
    );
  }
  const bearerToken = authHeader.slice(7);

  const actor = await resolveMobileActor(bearerToken);
  if (!actor) {
    return NextResponse.json(
      { error: "unauthorized", reason: "Invalid token or no active profile" },
      { status: 401 },
    );
  }

  // ── Pre-filter: optional role param (reduces noise, not a correctness gate) ─
  // If caller passes ?role=server, only offers for shifts with that role are returned.
  // Full eligibility check runs at claim time inside the capability tool (ADR-0306).
  const roleFilter = req.nextUrl.searchParams.get("role");

  const admin = createAdminClient();

  // ── Query: open offers for this workspace ─────────────────────────────────
  // workspace_id is server-derived from JWT — NEVER from query params (ADR-0151).
  // LIMIT 50 hard cap (V1 pull-poll contract).
  let query = admin
    .from("schedule_shift_offer")
    .select(
      `
      schedule_shift_offer_id,
      shift_id,
      posted_at,
      expires_at,
      posted_by_profile_id,
      schedule_shift!inner (
        shift_date,
        start_time,
        end_time,
        role,
        department_id,
        position_id
      )
    `,
    )
    .eq("workspace_id", actor.workspaceId)
    .eq("status", "open")
    .order("posted_at", { ascending: false })
    .limit(50);

  // Optional role pre-filter (reduces noise for clearly-ineligible employees).
  if (roleFilter) {
    query = query.eq("schedule_shift.role", roleFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[marketplace/open-offers] DB error:", error.message);
    return NextResponse.json(
      { error: "db_error", reason: "Failed to load open offers" },
      { status: 500 },
    );
  }

  // ── Shape response ────────────────────────────────────────────────────────
  const offers: OpenOffer[] = (data ?? []).map((row) => {
    const shift = row.schedule_shift as {
      shift_date: string;
      start_time: string;
      end_time: string;
      role: string | null;
      department_id: string | null;
      position_id: string | null;
    } | null;

    return {
      schedule_shift_offer_id: row.schedule_shift_offer_id as string,
      shift_id: row.shift_id as string,
      posted_at: row.posted_at as string,
      expires_at: (row.expires_at as string | null) ?? null,
      posted_by_profile_id: row.posted_by_profile_id as string,
      shift,
    };
  });

  const response: OpenOffersResponse = {
    offers,
    total: offers.length,
  };

  // V1: No Cache-Control. Clients pull at refetchInterval=30_000ms.
  // V2: Add short Cache-Control (max-age=15) when push fanout lands.
  return NextResponse.json(response);
}
