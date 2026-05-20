/**
 * GET /api/marketplace/offers
 *
 * Manager web BFF — fetches all shift offers for the workspace, grouped by status.
 * Used by the /dashboard/schedule/marketplace manager UI.
 *
 * Auth (ADR-0151):
 *   Cookie session (web dashboard). workspace_id derived server-side — never from query.
 *   Manager+ role required (managers oversee all offers).
 *
 * Response: offers with joined shift + profile data for display.
 *
 * References:
 *   ADR-0133 (web manager composes / approves; no mobile authoring)
 *   ADR-0151 (server-derived identity)
 *   ADR-0306 (shift_marketplace V1)
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";

const MANAGER_ROLES = new Set(["manager", "admin", "owner"]);

export type ManagerOffer = {
  schedule_shift_offer_id: string;
  shift_id: string;
  status: string;
  posted_at: string;
  expires_at: string | null;
  posted_by_profile_id: string;
  claimed_by_profile_id: string | null;
  approved_by_profile_id: string | null;
  approved_at: string | null;
  shift: {
    schedule_shift_id: string;
    shift_date: string;
    start_time: string;
    end_time: string;
    role: string | null;
    department_id: string | null;
    position_id: string | null;
  } | null;
};

export type ManagerOffersResponse = {
  open: ManagerOffer[];
  claimed: ManagerOffer[];
  approved: ManagerOffer[];
};

export async function GET(_req: NextRequest): Promise<NextResponse> {
  // ── Auth: cookie session ──────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── Server-derive identity (ADR-0151) ─────────────────────────────────────
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

  if (!profile.profile_id?.trim() || !profile.workspace_id?.trim()) {
    return NextResponse.json({ error: "identity_incomplete" }, { status: 401 });
  }

  // Manager+ only — employees use /api/mobile/marketplace/open-offers.
  if (!MANAGER_ROLES.has(profile.role ?? "")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const workspaceId = profile.workspace_id as string;

  // ── Fetch all non-cancelled offers (Law 1: workspace_id on every query) ───
  const { data, error } = await admin
    .from("schedule_shift_offer")
    .select(
      `
      schedule_shift_offer_id,
      shift_id,
      status,
      posted_at,
      expires_at,
      posted_by_profile_id,
      claimed_by_profile_id,
      approved_by_profile_id,
      approved_at,
      schedule_shift!inner (
        schedule_shift_id,
        shift_date,
        start_time,
        end_time,
        role,
        department_id,
        position_id
      )
    `,
    )
    .eq("workspace_id", workspaceId)
    .in("status", ["open", "claimed", "approved"])
    .order("posted_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[marketplace/offers] DB error:", error.message);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // ── Shape + bucket by status ──────────────────────────────────────────────
  const open: ManagerOffer[] = [];
  const claimed: ManagerOffer[] = [];
  const approved: ManagerOffer[] = [];

  for (const row of data ?? []) {
    const shift = row.schedule_shift as ManagerOffer["shift"];
    const offer: ManagerOffer = {
      schedule_shift_offer_id: row.schedule_shift_offer_id as string,
      shift_id: row.shift_id as string,
      status: row.status as string,
      posted_at: row.posted_at as string,
      expires_at: (row.expires_at as string | null) ?? null,
      posted_by_profile_id: row.posted_by_profile_id as string,
      claimed_by_profile_id: (row.claimed_by_profile_id as string | null) ?? null,
      approved_by_profile_id: (row.approved_by_profile_id as string | null) ?? null,
      approved_at: (row.approved_at as string | null) ?? null,
      shift,
    };

    if (row.status === "open") open.push(offer);
    else if (row.status === "claimed") claimed.push(offer);
    else if (row.status === "approved") approved.push(offer);
  }

  const response: ManagerOffersResponse = { open, claimed, approved };
  return NextResponse.json(response);
}
