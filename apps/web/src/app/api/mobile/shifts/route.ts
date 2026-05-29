/**
 * POST /api/mobile/shifts
 *
 * Mobile BFF for manual shift creation. Wraps `addShiftAction` so mobile
 * clients receive the same server-side concerns as web (workspace tz derivation,
 * C4 authority gate, audit trail, source attribution).
 *
 * ADR-0270 (Mobile Shift Authoring via Web BFF):
 *   - Mobile is a thin form; the compose verb runs here, not on the device.
 *   - Refines ADR-0133 R2: "authoring initiated from mobile, executes on BFF"
 *     is permitted; "authoring domain logic runs on mobile" is forbidden.
 *
 * Auth (ADR-0132 + ADR-0151):
 *   - Authorization: Bearer <supabase_access_token> — mobile path.
 *   - workspace_id + actor profile_id are NEVER accepted from the request body;
 *     both are derived server-side from the validated JWT.
 *   - Cookie auth is NOT supported on this endpoint — it is exclusively for
 *     mobile clients. Web callers use `addShiftAction` directly.
 *
 * Identity (ADR-0151):
 *   - `workspace_id` — derived from JWT → profile.workspace_id.
 *   - `actor_profile_id` — derived from JWT → profile.profile_id.
 *   - `profileId` in body is the TARGET EMPLOYEE, not the actor. It is
 *     cross-workspace-checked inside `addShiftAction`.
 *
 * Channel (ADR-0078):
 *   - Pinned to "system" (server-initiated, one hop from mobile gesture).
 *   - Shift-create does not involve PII display — no voice guard needed here,
 *     but the channel signal flows to `gate_action` for future policy use.
 *
 * Telemetry (ADR-0134 + ADR-0175):
 *   - This BFF does NOT emit. It delegates entirely to `addShiftAction`, which
 *     emits "shift added_manual" (4 destinations) after successful insert.
 *   - nonEmpty() brand on workspace_id and actor_id is enforced inside the action.
 *
 * Rate-limiting (ADR-0270 R8):
 *   - If UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, a 5 req/min
 *     per-actor limit is applied. Otherwise a warning is logged and the request
 *     proceeds (dev/staging acceptable behaviour).
 *
 * ADR-0204 G4 closure note:
 *   - `addShiftAction` wraps the INSERT in `gatedMutation()` (both Pathway A +
 *     Pathway B) per ADR-0430 PLAN-3. The legacy `gateAction()` call at the
 *     top of the action provides an early-exit for role/channel checks before
 *     the full composition orchestrator runs. BFF delegates entirely — no gate
 *     evaluation here.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@smartout/supabase/admin";
import { addShiftAction } from "@/app/dashboard/_actions/add-shift-action";
import type { ResolvedActor } from "@/app/dashboard/_actions/add-shift-action";
import { env } from "@/env";

// ── Request schema ──────────────────────────────────────────────────────────
// Notably absent: workspace_id (server-derived per ADR-0151).
// `is_published`, `status`, `source` are always set server-side (ADR-0270 R9).
const RequestSchema = z.object({
  /** Target employee UUID. Cross-workspace check happens in addShiftAction. */
  profileId: z.string().uuid("profileId must be a valid UUID"),
  /** ISO-8601 datetime-UTC. Server derives workspace-local time + date. */
  startAtISO: z.string().datetime({ message: "startAtISO must be an ISO-8601 datetime" }),
  /** ISO-8601 datetime-UTC. Must be after startAtISO. */
  endAtISO: z.string().datetime({ message: "endAtISO must be an ISO-8601 datetime" }),
  /** Position label / role string. Min 1 char. */
  role: z.string().min(1, "role is required"),
  /**
   * Audit reason per Aml. §14-6 + bokføringsloven §13.
   * Min 8 chars — same contract as web AddShiftDialog.
   */
  reason: z.string().min(8, "reason must be at least 8 characters"),
  /** Optional department scope (UUID). Derived from session if omitted. */
  departmentId: z.string().uuid("departmentId must be a valid UUID").optional(),
  /** Override reason when assigned employee is unavailable/absent. */
  overrideReason: z.string().min(1).optional(),
});

export const runtime = "nodejs";

// ── Auth ────────────────────────────────────────────────────────────────────

type MobileAuth = {
  userId: string;
  profileId: string;
  workspaceId: string;
  role: string | null;
};

/**
 * Resolve Bearer JWT from Authorization header.
 * Returns null → caller should 401.
 *
 * Mirrors the Bearer path in /api/emma/chat/route.ts:resolveAuth()
 * and /api/tips/_shared.ts:resolveTipsAuth() — canonical mobile-BFF pattern.
 */
async function resolveBearerAuth(request: NextRequest): Promise<MobileAuth | null> {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearerToken) return null;

  const admin = createAdminClient();

  // Validate the JWT. Uses admin client — does NOT call getSession() (no
  // session in stateless mobile mode; null session silently corrupts
  // downstream PII writes per the emma/chat route comment).
  const { data, error } = await admin.auth.getUser(bearerToken);
  if (error || !data.user) return null;
  const userId = data.user.id;

  // Server-side identity derivation per ADR-0151.
  // profile_id and workspace_id MUST NOT come from the request body.
  const { data: profile, error: profileErr } = await admin
    .from("profile")
    .select("profile_id, workspace_id, role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (profileErr || !profile) return null;

  // Fail-fast on empty identity (ADR-0134 / ADR-0151 L-0177).
  // A missing workspace_id here would silently corrupt activity_trail routing.
  if (!profile.profile_id.trim() || !profile.workspace_id.trim()) return null;

  return {
    userId,
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
    role: profile.role ?? null,
  };
}

// ── Rate-limiting ────────────────────────────────────────────────────────────

/**
 * Optional Upstash rate-limit: 5 requests/min per actor profile (ADR-0270 R8).
 * Returns true if the request should be rejected (rate exceeded).
 * Returns false if the request is allowed (or if Upstash is not configured).
 */
async function isRateLimited(profileId: string): Promise<boolean> {
  const redisUrl = env.UPSTASH_REDIS_REST_URL;
  const redisToken = env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    // Upstash not configured — proceed without rate-limiting.
    // Acceptable in dev/staging; production should have Upstash configured.
    console.warn("[POST /api/mobile/shifts] Upstash not configured — no rate-limiting applied.");
    return false;
  }

  const key = `mobile_shifts_rl:${profileId}`;
  const windowSecs = 60;
  const limit = 5;

  try {
    // INCR + EXPIRE via Upstash REST API (no SDK dependency).
    const incrRes = await fetch(`${redisUrl}/incr/${key}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${redisToken}` },
    });
    if (!incrRes.ok) return false;
    const incrData = (await incrRes.json()) as { result?: number };
    const count = incrData.result ?? 0;

    if (count === 1) {
      // First request in window — set TTL.
      await fetch(`${redisUrl}/expire/${key}/${windowSecs}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${redisToken}` },
      });
    }

    return count > limit;
  } catch {
    // Rate-limit infrastructure failure — allow the request through.
    // gate_action is the real authority gate; rate-limiting is operational hygiene.
    return false;
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Auth — Bearer JWT only (this endpoint is mobile-exclusive).
  //    Web callers use addShiftAction directly (cookie path).
  const auth = await resolveBearerAuth(request);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 2. Role check — minimum manager (mirrors gate_action seed min_role='manager').
  //    Early-return before parsing body to avoid wasted Zod work.
  //    gate_action will enforce this again server-side — this is a fast-fail.
  const role = auth.role;
  const allowedRoles = ["manager", "admin", "owner"];
  if (!role || !allowedRoles.includes(role)) {
    return NextResponse.json(
      { ok: false, error: "insufficient_role: manager or above required" },
      { status: 403 },
    );
  }

  // 3. Rate-limit (Upstash if configured, ADR-0270 R8).
  const limited = await isRateLimited(auth.profileId);
  if (limited) {
    return NextResponse.json(
      { ok: false, error: "rate_limit_exceeded: max 5 requests per minute" },
      { status: 429 },
    );
  }

  // 4. Parse + validate body. No identity fields permitted (ADR-0151).
  let body: z.infer<typeof RequestSchema>;
  try {
    const raw = await request.json();
    body = RequestSchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? (err.errors[0]?.message ?? "Invalid request body")
        : "Invalid request body";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }

  // 5. Build actor context from server-derived auth (ADR-0151 + ADR-0270 R2).
  //    Passed to addShiftAction to bypass cookie-based resolveCurrentProfile().
  const actor: ResolvedActor = {
    profileId: auth.profileId,
    workspaceId: auth.workspaceId,
    role: auth.role,
  };

  // 6. Delegate to the canonical Server Action.
  //    channel: "system" — BFF-initiated, one hop from mobile gesture (ADR-0078).
  //    The action handles: workspace tz derivation, day_category, gate_action,
  //    schedule_shift insert, emit("shift added_manual").
  //    This BFF emits nothing of its own — all telemetry flows through the action.
  const result = await addShiftAction(
    {
      // BFF body maps directly to InputSchema fields.
      // departmentSessionId is null — mobile creates are session-less.
      departmentSessionId: null,
      profileId: body.profileId,
      startAtISO: body.startAtISO,
      endAtISO: body.endAtISO,
      role: body.role,
      reason: body.reason,
      departmentId: body.departmentId,
      overrideReason: body.overrideReason,
      // Pinned by BFF — never comes from mobile client body (ADR-0078).
      channel: "system",
      // zone_ids: [] — mobile is read-only on shift authoring (ADR-0133).
      // Emit happens inside addShiftAction. NO second emit() here (MF-F, ADR-0134).
      zone_ids: [],
    },
    actor,
  );

  // 7. Map action result to HTTP response.
  if (!result.ok) {
    // Gate denials and validation failures are 422 (unprocessable),
    // not 400 (body malformed) — the body was valid but the action refused it.
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }

  // 8. Success — return shiftId + any informational warnings (M1 pause-check).
  return NextResponse.json(
    {
      ok: true,
      shiftId: result.shiftId,
      ...(result.warnings && result.warnings.length > 0 ? { warnings: result.warnings } : {}),
    },
    { status: 200 },
  );
}
