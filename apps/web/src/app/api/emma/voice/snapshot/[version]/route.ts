/**
 * GET /api/emma/voice/snapshot/[version]
 *
 * Resolution endpoint for the size-guard payload_url produced by
 * POST /api/emma/voice/transcript when a snapshot payload exceeds
 * SNAPSHOT_SIZE_GUARD_BYTES (14 KB).
 *
 * Mobile fetches this URL to retrieve the full workforce context snapshot
 * that was too large to inline in the transcript response body.
 *
 * Auth: dual-mode — Bearer JWT (mobile) OR session cookie (web).
 * Mirrors the auth pattern in /api/emma/voice/transcript exactly.
 *
 * Version param: decoded prefix `${workspaceId}:${profileId}:${unix_ms}`.
 * The version is opaque to the client (ADR-0297); we decode it for:
 *   1. Deriving the workspace_id to scope the re-assembly query.
 *   2. Cross-checking that the authenticated user has a profile in that workspace
 *      (L-0177 fail-fast: 403 on missing profile, no silent fallback).
 *
 * ADR-0078 PII whitelist: identical column projection to transcript route.
 * Re-assembly uses the same assembleBotssonContext() call path — never loosened.
 *
 * ADR-0151: workspace_id and profile_id are derived server-side from JWT + DB.
 * The workspace_id embedded in the version string is cross-checked, not trusted.
 *
 * Staleness: if the workspace/profile can no longer be assembled (workspace
 * deleted, user removed), 410 Gone is returned. Mobile should clear its cached
 * version token and start a fresh session.
 *
 * Error codes:
 *   401 — no valid auth token / session
 *   400 — version param cannot be decoded (malformed)
 *   403 — authenticated user has no profile in the workspace encoded in version
 *   410 — snapshot cannot be re-assembled (context gone or version too stale)
 *   200 — { version, hash, payload }
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createAdminClient } from "@smartout/supabase/admin";
import { createClient } from "@smartout/supabase/server";
import { emit, nonEmpty } from "@smartout/telemetry";
import {
  assembleBotssonContext,
  computeSnapshotHash,
  computeSnapshotVersion,
  isBotssonContextError,
} from "@/lib/botsson-context-snapshot";

type AuthResult = {
  user: { id: string };
  authMethod: "bearer" | "cookie";
};

async function resolveAuth(request: NextRequest): Promise<AuthResult | null> {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (bearerToken) {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.getUser(bearerToken);
    if (error || !data.user) return null;
    return { user: data.user, authMethod: "bearer" };
  }

  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return null;
  return { user: userData.user, authMethod: "cookie" };
}

/**
 * Decode the version token produced by computeSnapshotVersion().
 * Format: `${workspaceId}:${profileId}:${unix_ms}` — three colon-separated segments.
 * UUIDs contain hyphens but no colons, so split on first two colons only.
 */
function decodeVersion(
  encoded: string,
): { workspaceId: string; profileId: string; unixMs: number } | null {
  // UUIDs are 36 chars each. Format: <uuid>:<uuid>:<digits>
  // Split on ":" up to 3 parts.
  const parts = encoded.split(":");
  // UUID-formatted segments contain 5 sub-parts separated by "-" (8-4-4-4-12).
  // We reconstruct from parts: workspace = parts[0..4], profile = parts[5..9], ts = parts[10].
  // Simpler: the version has exactly three "top-level" segments separated by a colon that
  // follows a UUID. Since UUIDs don't contain ":", a split on ":" yields:
  //   [0]  first UUID segment 1 (8 hex)
  //   [1]  UUID segment 2 (4 hex)
  //   [2]  UUID segment 3 (4 hex)
  //   [3]  UUID segment 4 (4 hex)
  //   [4]  UUID segment 5 (12 hex) — end of first UUID
  //   [5]  second UUID segment 1 (8 hex)
  //   [6]  UUID segment 2 (4 hex)
  //   [7]  UUID segment 3 (4 hex)
  //   [8]  UUID segment 4 (4 hex)
  //   [9]  UUID segment 5 (12 hex) — end of second UUID
  //   [10] unix_ms (digits)
  if (parts.length !== 11) return null;

  const workspaceId = parts.slice(0, 5).join(":");
  const profileId = parts.slice(5, 10).join(":");
  const tsStr = parts[10];

  if (!tsStr || !/^\d+$/.test(tsStr)) return null;

  // Validate UUID shape (8-4-4-4-12 hex with hyphens).
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(workspaceId) || !uuidRe.test(profileId)) return null;

  return { workspaceId, profileId, unixMs: parseInt(tsStr, 10) };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ version: string }> },
) {
  // 1. Auth — dual mode (Bearer for mobile, cookie for web).
  const auth = await resolveAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { user } = auth;

  // 2. Decode version param.
  const { version: rawVersion } = await params;
  const encodedVersion = decodeURIComponent(rawVersion);
  const decoded = decodeVersion(encodedVersion);

  if (!decoded) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "Malformed version token." },
      { status: 400 },
    );
  }

  const { workspaceId, profileId: versionProfileId } = decoded;

  // 3. Cross-check: authenticated user must have a profile in the workspace
  //    encoded in the version token. This prevents a user from fetching another
  //    workspace's snapshot by forging a version string (ADR-0151 + L-0177).
  //    Fail-fast: 403 if no profile found — no silent fallback to JWT workspace.
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profile")
    .select("profile_id, role, status")
    .eq("user_id", user.id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "No profile found in the requested workspace." },
      { status: 403 },
    );
  }

  // Extra safety: the profile_id derived from JWT must match the one in the version
  // token. If someone passes a valid workspace_id but a different profileId segment,
  // they would be fetching another employee's snapshot.
  if (profile.profile_id !== versionProfileId) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "Version token profile mismatch." },
      { status: 403 },
    );
  }

  // 4. Re-assemble the snapshot. We re-assemble fresh rather than caching the
  //    original payload — the size guard was triggered because the payload was large,
  //    and server-side cache for transient payloads would require Redis/KV infra we
  //    don't have in this path. Re-assembly is idempotent and bounded (same DB queries
  //    as transcript route). If the workspace state has changed since the version was
  //    issued, the new snapshot is still correct — the client's cache token becomes
  //    stale but that's handled by the drift-detection logic in the transcript route.
  const ctxResult = await assembleBotssonContext(admin, user.id, workspaceId);

  if (isBotssonContextError(ctxResult)) {
    // Workspace or profile no longer assemblable — version is too stale to resolve.
    return NextResponse.json(
      {
        error: "GONE",
        message:
          "Snapshot context no longer available. Start a fresh session to obtain a new snapshot.",
      },
      { status: 410 },
    );
  }

  // 5. Compute version + hash. We issue a fresh version token so the client can
  //    update its cache — the unix_ms component advances, signalling a re-assembly.
  const newVersion = computeSnapshotVersion(workspaceId, profile.profile_id as string);
  const hash = computeSnapshotHash(ctxResult);
  const payloadBytes = Buffer.byteLength(JSON.stringify(ctxResult), "utf8");

  // 6. Emit voice.bootstrap.snapshot_sent with trigger discriminator.
  //    L-0298: emit() call-site in same commit as registry extension.
  await emit({
    event: "voice.bootstrap.snapshot_sent",
    workspace_id: nonEmpty(workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profile_id as string, "actor_id"),
    properties: {
      entity: {
        entity_type: "agent_session",
        // No session_id available at this endpoint — use workspaceId:profileId as stable ref.
        entity_id: `${workspaceId}:${profile.profile_id as string}`,
      },
      data: {
        session_id: "",
        livekit_room_id: "",
        snapshot_version: newVersion,
        snapshot_hash: hash,
        payload_bytes: payloadBytes,
        size_guard_triggered: false,
        trigger: "payload_url_fetch",
      },
    },
  });

  return NextResponse.json({
    version: newVersion,
    hash,
    payload: ctxResult,
  });
}
