/**
 * BFF /api/journey/guided/start — starts an agent-guided journey run.
 *
 * ADR-0132 (Mobile AI Routing): mobile MUST go through this BFF.
 * ADR-0133 (web composes, mobile executes): mobile never imports capabilities.
 * ADR-0134 (Mobile Telemetry Contract): actor_id + workspace_id resolve
 *          SERVER-SIDE from the authenticated session — never reflect the
 *          client body. Empty-string fallback is banned.
 * ADR-0176 (Actor ID Resolution, Invariant 3): server-side BFF re-derivation
 *          is the CVE-class red line. A client-supplied workspace_id or
 *          actor_id is a security bug — NEVER accept one.
 * ADR-0078 (voice forbidden for critical data): journey runs are chat-only;
 *          we hard-pin channel server-side.
 * L-0094  phantom emit contracts — the capability emits `journey run_started`
 *          which is pre-registered in packages/telemetry/src/registry.ts.
 *
 * Auth (per ADR-0132): dual path — cookie (web) OR Bearer (mobile).
 * - Cookie path: standard Supabase SSR, surface = "runtime_web".
 * - Bearer path: admin.auth.getUser(token), surface = "runtime_mobile".
 *
 * CORS: same-origin only. Cross-origin requests are rejected pre-auth.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { runGuidedTool } from "@smartout/ai/capabilities/journey";
import type { AgentToolContext } from "@smartout/ai/capabilities/types";
import { gateAction } from "@/app/dashboard/_actions/_shared";
import { emit } from "@smartout/telemetry";

// NOTE: the schema deliberately does NOT accept workspace_id / actor_id /
// profile_id. Any client-supplied identity field is an ADR-0176 Invariant 3
// violation and a CVE-class red line (R5.2-1). Server derives from session.
const RequestSchema = z.object({
  journey_version_id: z.string().uuid(),
});

type AuthResult = {
  userId: string;
  workspaceId: string;
  profileId: string;
  surface: "runtime_mobile" | "runtime_web";
};

/**
 * Same-origin CORS guard. Reject if the Origin header is set and does not
 * match the request host. Mobile native requests have no Origin and pass.
 */
function rejectCrossOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return null; // native / server-to-server — no Origin header
  const host = request.headers.get("host");
  if (!host) return NextResponse.json({ error: "Missing host header" }, { status: 400 });
  try {
    const originHost = new URL(origin).host;
    if (originHost !== host) {
      return NextResponse.json({ error: "Cross-origin forbidden" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid origin" }, { status: 400 });
  }
  return null;
}

/**
 * Resolve auth from cookie (web) or Bearer (mobile) per ADR-0132.
 * Fails fast on any empty workspace_id / actor_id (ADR-0134 Invariant 2).
 */
async function resolveAuth(request: NextRequest): Promise<AuthResult | null> {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  const admin = createAdminClient();
  let userId: string | null = null;
  let surface: "runtime_mobile" | "runtime_web";

  if (bearerToken) {
    // Mobile (ADR-0132) — stateless Bearer auth.
    const { data, error } = await admin.auth.getUser(bearerToken);
    if (error || !data.user) return null;
    userId = data.user.id;
    surface = "runtime_mobile";
  } else {
    // Web — Supabase SSR cookie session.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    userId = user.id;
    surface = "runtime_web";
  }

  // Derive workspace_id + profile_id from the authenticated user row.
  // ADR-0176 Invariant 3: the BFF is the server-side re-derivation point.
  const { data: profile, error: profileErr } = await admin
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (profileErr || !profile) return null;
  // ADR-0134: fail fast — an empty string here would corrupt telemetry.
  if (!profile.profile_id || !profile.workspace_id) return null;

  return {
    userId,
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
    surface,
  };
}

export async function POST(request: NextRequest) {
  // 0. CORS — reject cross-origin before reading body or touching DB.
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // 1. Auth — cookie or Bearer.
  const auth = await resolveAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Validate body (no identity fields allowed — see schema comment).
  let body: z.infer<typeof RequestSchema>;
  try {
    const raw = await request.json();
    body = RequestSchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
        : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // 3. Workspace-scoped read: the journey_version must belong to the user's
  // workspace. Cross-workspace = 404 (not 403) to prevent enumeration.
  const admin = createAdminClient();
  const { data: version, error: versionErr } = await admin
    .from("journey_version")
    .select("journey_version_id, status, workspace_id")
    .eq("journey_version_id", body.journey_version_id)
    .maybeSingle();
  if (versionErr || !version || version.workspace_id !== auth.workspaceId) {
    return NextResponse.json({ error: "Journey version not found" }, { status: 404 });
  }
  if (version.status !== "published") {
    return NextResponse.json(
      { error: `Journey version must be published; current status is ${version.status}` },
      { status: 409 },
    );
  }

  // 4. C4 authority gate — ADR-0099 / ADR-0176. Seeded default for
  // journey.run_guided is `autonomous` / employee min_role; a workspace
  // may disable or restrict. channel hard-pinned to "chat" (ADR-0078 / R5.2-5).
  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "journey.run_guided",
    channel: "chat", // server-pinned per ADR-0078 (R5.2-5)
    actorProfileId: auth.profileId,
    actionType: "run_guided",
    entityId: body.journey_version_id,
  });
  if (!gate.allow) {
    return NextResponse.json(
      { error: `capability_disabled: ${gate.reason ?? "forbidden"}` },
      { status: 403 },
    );
  }

  // 5. Build AgentToolContext — identity fields come from SERVER-derived auth,
  // never from request body. Channel hard-pinned to "chat" (ADR-0078).
  const ctx: AgentToolContext = {
    workspaceId: auth.workspaceId, // server-derived (ADR-0176 Invariant 3)
    profileId: auth.profileId, // server-derived (ADR-0176 Invariant 3)
    userId: auth.userId,
    sessionId: `guided:${auth.userId}:${Date.now()}`,
    supabaseAdmin: admin,
    channel: "chat", // server-pinned (ADR-0078 / R5.2-5)
  };

  // 6. Invoke journey.run_guided. The capability emits `journey run_started`
  // against the registry (packages/telemetry/src/registry.ts) — no phantom
  // contracts (L-0094).
  let raw: string;
  try {
    raw = await runGuidedTool.execute({ journey_version_id: body.journey_version_id }, ctx);
  } catch (err) {
    // Capability threw — emit run_failed and surface 502.
    await emit({
      event: "journey run_failed",
      workspace_id: auth.workspaceId,
      actor_id: auth.profileId,
      properties: {
        run_id: `unknown:${auth.userId}:${Date.now()}`,
        step_key: "capability_invocation",
        error_code: "capability_threw",
        error_message: err instanceof Error ? err.message : String(err),
        actor_id: auth.profileId,
        workspace_id: auth.workspaceId,
        entity: {
          entity_type: "journey_run",
          entity_id: body.journey_version_id,
          entity_label: `run_guided/${body.journey_version_id}`,
        },
      },
    });
    return NextResponse.json({ error: "Capability invocation failed" }, { status: 502 });
  }

  let capResult: { ok?: boolean; run_id?: string; error?: string; message?: string };
  try {
    capResult = JSON.parse(raw) as typeof capResult;
  } catch {
    return NextResponse.json({ error: "Capability returned non-JSON" }, { status: 502 });
  }

  if (!capResult.ok || !capResult.run_id) {
    // Capability refused — emit run_failed with the reason and surface 422.
    await emit({
      event: "journey run_failed",
      workspace_id: auth.workspaceId,
      actor_id: auth.profileId,
      properties: {
        run_id: `refused:${auth.userId}:${Date.now()}`,
        step_key: "capability_rejection",
        error_code: "capability_refused",
        error_message: capResult.message ?? capResult.error ?? "capability refused",
        actor_id: auth.profileId,
        workspace_id: auth.workspaceId,
        entity: {
          entity_type: "journey_run",
          entity_id: body.journey_version_id,
          entity_label: `run_guided/${body.journey_version_id}`,
        },
      },
    });
    return NextResponse.json(
      { error: capResult.message ?? capResult.error ?? "Capability rejected" },
      { status: 422 },
    );
  }

  // Note: the capability tagged `surface: "runtime_web"` in its emit. The
  // BFF surface (runtime_mobile vs runtime_web) is returned to the client
  // so the caller can distinguish — but telemetry surface is owned by the
  // capability body and will be refined in M5.1.
  return NextResponse.json({
    run_id: capResult.run_id,
    status: "running",
    surface: auth.surface,
  });
}
