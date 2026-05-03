// route.ts — GET /api/avstemming/[run_id]/artifact/[type]
//
// Returns a Supabase Storage signed URL (60s TTL) for a settlement artifact.
// Redirects the browser to the signed URL so no extra proxy layer is needed.
//
// Auth: requireAccountant() + run ownership check (run.initiated_by = userId
// verified via settlement_run row RLS — user can only read runs they initiated).
// Emits "settlement artifact_downloaded" telemetry per download.
//
// Valid types: summary_pdf | detail_csv | invoice_bundle_pdf | discrepancy_pdf
//
// Status codes:
//   302 — redirect to signed URL
//   400 — invalid artifact type
//   401 — not authenticated
//   403 — no grant or run not owned by this accountant
//   404 — run or artifact not found

import { NextResponse, type NextRequest } from "next/server";
import { getAccountantUserId } from "@/lib/accountant";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";

const VALID_TYPES = ["summary_pdf", "detail_csv", "invoice_bundle_pdf", "discrepancy_pdf"] as const;
type ValidArtifactType = (typeof VALID_TYPES)[number];

const SIGNED_URL_TTL_SECONDS = 60;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ run_id: string; type: string }> },
) {
  const { run_id, type } = await params;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const userId = await getAccountantUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Validate artifact type ────────────────────────────────────────────────
  if (!VALID_TYPES.includes(type as ValidArtifactType)) {
    return NextResponse.json(
      {
        error: `Invalid artifact type. Must be one of: ${VALID_TYPES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const userClient = await createClient();

  // ── Verify run ownership via RLS-scoped query ────────────────────────────
  // settlement_run RLS policy: accountant can read runs they initiated.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: runRow, error: runErr } = await (userClient as any)
    .schema("billing")
    .from("settlement_run")
    .select("run_id, initiated_by, status")
    .eq("run_id", run_id)
    .maybeSingle();

  if (runErr || !runRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Defense-in-depth ownership check (belt + suspenders on top of RLS).
  if (runRow.initiated_by !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Look up artifact row ─────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: artifactRow, error: artifactErr } = await (userClient as any)
    .schema("billing")
    .from("settlement_artifact")
    .select("artifact_id, storage_path, artifact_type")
    .eq("run_id", run_id)
    .eq("artifact_type", type)
    .maybeSingle();

  if (artifactErr || !artifactRow) {
    return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  }

  // ── Generate signed URL (service-role required for private bucket) ────────
  const serviceClient = createAdminClient();
  const { data: urlData, error: urlErr } = await serviceClient.storage
    .from("settlement-artifacts")
    .createSignedUrl(artifactRow.storage_path as string, SIGNED_URL_TTL_SECONDS);

  if (urlErr || !urlData?.signedUrl) {
    console.error("[api/avstemming/artifact] createSignedUrl failed:", urlErr);
    return NextResponse.json({ error: "Could not generate download link" }, { status: 500 });
  }

  // ── Emit telemetry ────────────────────────────────────────────────────────
  // Fire-and-forget per ADR-0262 — download route must not await telemetry.
  // Entity is the artifact being downloaded, not the run — entity_id is
  // artifactRow.artifact_id (the settlement_artifact PK confirmed by the
  // .select("artifact_id, ...") at line 78 above).
  void emit({
    event: "settlement artifact_downloaded",
    actor_id: nonEmpty(userId, "actor_id"),
    workspace_id: null,
    properties: {
      entity: { entity_type: "settlement_artifact", entity_id: artifactRow.artifact_id as string },
      data: {
        run_id,
        // `type` is validated against VALID_TYPES above — safe to cast.
        artifact_type: type as ValidArtifactType,
      },
    },
  }).catch(console.error); // Non-fatal.

  // ── Redirect to signed URL ────────────────────────────────────────────────
  return NextResponse.redirect(urlData.signedUrl, { status: 302 });
}
