/**
 * GET /api/admin/pipeline
 *
 * Read-only BFF route: list pipeline instances for the admin override dashboard.
 *
 * Returns paginated engine_state rows filtered to the two swap/marketplace
 * blueprints, scoped to the caller's workspace. No mutations — all override
 * actions go via Botsson chat per ADR-0240.
 *
 * Design decisions:
 *   - workspace_id + profile_id derived server-side (ADR-0151, L-0177).
 *   - Role gate: admin or owner only (ADR-0099). Fail fast at BFF before DB.
 *   - Admin client for all reads: RLS on engine_state allows workspace members,
 *     but we belt-and-suspenders with an explicit workspace_id filter.
 *   - actor_profile_id extracted from context JSONB — no separate join needed.
 *   - Pagination: limit + offset (cursor not needed for V2 at ≤200 rows).
 *
 * Query params:
 *   status    — IN (pending, active, waiting, complete, failed, escalated, blocked)
 *   blueprint — IN (shift_swap_lifecycle, marketplace_lifecycle)
 *   limit     — 1–200, default 50
 *   offset    — default 0
 *
 * ADR compliance:
 *   ADR-0151 — workspace_id + profile_id server-derived, never body-supplied
 *   ADR-0099 — admin/owner role gate enforced at BFF
 *   L-0177   — fail fast on missing identity (no silent fallback)
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";

export const runtime = "nodejs";

// ─── Constants ───────────────────────────────────────────────────────────────

const PIPELINE_BLUEPRINTS = ["shift_swap_lifecycle", "marketplace_lifecycle"] as const;
type PipelineBlueprint = (typeof PIPELINE_BLUEPRINTS)[number];

const VALID_STATUSES = [
  "pending",
  "active",
  "waiting",
  "complete",
  "failed",
  "escalated",
  "blocked",
] as const;

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const QuerySchema = z.object({
  status: z.enum(VALID_STATUSES).optional(),
  blueprint: z.enum(PIPELINE_BLUEPRINTS).optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 50))
    .pipe(z.number().int().min(1).max(200)),
  offset: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 0))
    .pipe(z.number().int().min(0)),
});

const PipelineItemSchema = z.object({
  pipeline_instance_id: z.string(),
  blueprint_id: z.string(),
  status: z.string(),
  current_step: z.number().nullable(),
  entity_id: z.string().nullable(),
  entity_type: z.string().nullable(),
  started_at: z.string(),
  completed_at: z.string().nullable(),
  actor_profile_id: z.string().nullable(),
});

const PipelineListResponseSchema = z.object({
  pipelines: z.array(PipelineItemSchema),
  total_count: z.number(),
  has_more: z.boolean(),
});

export type PipelineListResponse = z.infer<typeof PipelineListResponseSchema>;

// ─── GET handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ─── Parse + validate query params ───────────────────────────────────────
  const searchParams = request.nextUrl.searchParams;
  const rawParams = {
    status: searchParams.get("status") ?? undefined,
    blueprint: searchParams.get("blueprint") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
  };

  const parsedParams = QuerySchema.safeParse(rawParams);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsedParams.error.flatten() },
      { status: 400 },
    );
  }

  const { status: statusFilter, blueprint: blueprintFilter, limit, offset } = parsedParams.data;

  // ─── Identity — server-derived (ADR-0151) ────────────────────────────────
  // Cookie-auth only: admin override dashboard is a web-only Compose surface
  // (ADR-0133). workspace_id + profile_id are NEVER accepted from the client.
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Resolve workspace + profile, scoped to admin/owner roles.
  // If no matching active profile exists → caller lacks required role → 403.
  // No silent fallback to employee profile (L-0177 + ADR-0151).
  const { data: profile, error: profileErr } = await admin
    .from("profile")
    .select("profile_id, workspace_id, role")
    .eq("user_id", userData.user.id)
    .in("role", ["admin", "owner"])
    .eq("status", "active")
    .order("profile_id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (profileErr || !profile) {
    return NextResponse.json(
      { error: "Forbidden. Admin or owner role required." },
      { status: 403 },
    );
  }

  // Fail fast on empty IDs (L-0177).
  const workspaceId = profile.workspace_id;
  if (!workspaceId || workspaceId.trim() === "") {
    return NextResponse.json(
      { error: "Identity resolution failed: workspace_id is empty" },
      { status: 500 },
    );
  }

  // ─── Query engine_state ──────────────────────────────────────────────────
  // Belt-and-suspenders workspace filter even though RLS covers it.
  // process_id IN the two pipeline blueprints is load-bearing: engine_state
  // holds ALL process types; without this filter we'd leak unrelated rows.

  // Determine which blueprints to query.
  const blueprints: PipelineBlueprint[] = blueprintFilter
    ? [blueprintFilter]
    : [...PIPELINE_BLUEPRINTS];

  // Build paginated query with count.
  let query = admin
    .from("engine_state")
    .select(
      "id, process_id, status, current_step, entity_id, entity_type, started_at, completed_at, context",
      { count: "exact" },
    )
    .eq("workspace_id", workspaceId)
    .in("process_id", blueprints)
    .order("started_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data: rows, error: queryErr, count } = await query;

  if (queryErr) {
    return NextResponse.json(
      { error: "Database error", detail: queryErr.message },
      { status: 500 },
    );
  }

  // ─── Shape response ──────────────────────────────────────────────────────
  const totalCount = count ?? 0;

  const pipelines = (rows ?? []).map((row) => {
    // Extract actor_profile_id from context JSONB. Context shape varies by
    // blueprint; both shift_swap_lifecycle and marketplace_lifecycle store the
    // initiating profile under context.actor_profile_id. Fall back to null if
    // the field is absent or context is not an object.
    let actorProfileId: string | null = null;
    if (
      row.context !== null &&
      typeof row.context === "object" &&
      !Array.isArray(row.context) &&
      "actor_profile_id" in row.context &&
      typeof (row.context as Record<string, unknown>).actor_profile_id === "string"
    ) {
      actorProfileId = (row.context as Record<string, unknown>).actor_profile_id as string;
    }

    return {
      pipeline_instance_id: row.id,
      blueprint_id: row.process_id,
      status: row.status,
      current_step: row.current_step ?? null,
      entity_id: row.entity_id ?? null,
      entity_type: row.entity_type ?? null,
      started_at: row.started_at,
      completed_at: row.completed_at ?? null,
      actor_profile_id: actorProfileId,
    };
  });

  return NextResponse.json(
    {
      pipelines,
      total_count: totalCount,
      has_more: offset + limit < totalCount,
    } satisfies PipelineListResponse,
    { status: 200 },
  );
}
