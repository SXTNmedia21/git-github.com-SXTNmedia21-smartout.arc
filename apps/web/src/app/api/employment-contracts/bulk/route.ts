/**
 * POST /api/employment-contracts/bulk — Bulk compose + send draft contracts for a batch
 * of employees from a single published template.
 *
 * Phase 3 scope (sync batch, no streaming):
 *   1. Validate shape — workspace_id, template_id, profile_ids[]. Cap at 100.
 *   2. Auth — admin or owner gate (same as the single-contract POST).
 *   3. C4 governance — call `gate_action` ONCE (capability=`contract`,
 *      action_type=`bulk_send`) BEFORE the per-profile loop so the batch
 *      lands as a single `gate_evaluation` row. Per-profile gating would
 *      duplicate audit and break ADR-0099 "one decision per admin action".
 *   4. Emit `contract.bulk_send_initiated` BEFORE the loop. This batch-level
 *      event lets downstream consumers correlate per-profile
 *      `contract created` / `contract sent` events back to a single
 *      admin action via batch_id.
 *   5. For each profile_id (serial iteration — respects contract-service rate limits):
 *      a. Call resolveComposition (ADR-0076 — cascade derivation).
 *      b. Insert draft employment_contract (status='draft').
 *      c. Call the existing per-id send endpoint (same-origin fetch, cookie
 *         forwarded) to trigger the DocuSeal signing contract row + send.
 *      d. Collect per-profile outcome — success | failure with message.
 *   6. Return { batch_id, results: [{ profile_id, status, contract_id?, error? }], counts }.
 *
 * Notes:
 *  - No `metadata.batch_id` is written to employment_contract rows — that column
 *    does not exist on this table and migrations are frozen for Phase 3 (see
 *    constraints in JOURNEY-contract-bulk-send). batch_id lives only on the
 *    response and on the `contract.bulk_send_initiated` event payload.
 *  - Per-profile `contract created` and `contract sent` are emitted by the
 *    downstream single-contract endpoints as they already do; this route only
 *    emits the batch-level wrapper event.
 *  - Serial iteration is intentional: DocuSeal and the contract-service
 *    rate-limit parallel sends.
 *
 * Forbidden-template guard:
 *  - Template must be `published_at IS NOT NULL AND deprecated_at IS NULL`.
 *
 * Input-validation:
 *  - profile_ids max 100. UUID-validated each.
 */

import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { emit, nonEmpty } from "@smartout/telemetry";
import { z } from "zod";
import { resolveComposition, type EmploymentCategory } from "@smartout/utils";
import { randomUUID } from "node:crypto";

const bulkSchema = z.object({
  workspace_id: z.string().uuid(),
  template_id: z.string().uuid(),
  profile_ids: z.array(z.string().uuid()).min(1).max(100),
});

type PerProfileResult = {
  profile_id: string;
  status: "created_and_sent" | "created_pending_data" | "failed";
  contract_id?: string;
  signing_contract_id?: string;
  error?: string;
};

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = bulkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { workspace_id, template_id, profile_ids } = parsed.data;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Role gate: admin or owner ──────────────────────────────────────
    const { data: actorProfile } = await supabase
      .from("profile")
      .select("profile_id, role")
      .eq("user_id", user.id)
      .eq("workspace_id", workspace_id)
      .single();

    if (!actorProfile || !["admin", "owner"].includes(actorProfile.role)) {
      return NextResponse.json(
        { error: "Forbidden: admin or owner role required" },
        { status: 403 },
      );
    }

    // ── Template gate: must be published + not deprecated ──────────────
    const { data: template, error: templateError } = await supabase
      .from("contract_template")
      .select("template_id, published_at, deprecated_at, workspace_id")
      .eq("template_id", template_id)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    if (!template.published_at) {
      return NextResponse.json(
        { error: "Template is not published — publish it before bulk-sending" },
        { status: 400 },
      );
    }

    if (template.deprecated_at) {
      return NextResponse.json(
        { error: "Template is deprecated — pick a current template" },
        { status: 400 },
      );
    }

    // ── C4 governance gate (ADR-0099) ──────────────────────────────────
    // ONE gate decision per batch — not per profile. capability="contract"
    // matches existing engine_authority_config rows for contract operations;
    // action_type="bulk_send" distinguishes this from single-contract send
    // in `gate_evaluation` audit. p_entity_id=template_id scopes the
    // approval to this template (ADR-0101 per-entity four-eyes). Channel
    // is "system" because this route is invoked from the dashboard with a
    // user session, not via a voice/chat agent channel.
    const { data: gateRaw, error: gateErr } = await supabase.rpc("gate_action", {
      p_workspace_id: workspace_id,
      p_capability: "contract",
      p_channel: "system",
      p_actor_profile_id: actorProfile.profile_id,
      p_action_type: "bulk_send",
      p_entity_id: template_id,
    });

    if (gateErr) {
      return NextResponse.json(
        { error: `gate_action failed: ${gateErr.message}` },
        { status: 500 },
      );
    }

    const gate = (gateRaw ?? {}) as {
      allow?: boolean;
      reason?: string | null;
      min_role_required?: string | null;
    };

    if (!gate.allow) {
      return NextResponse.json(
        {
          error: "gate_denied",
          reason: gate.reason ?? "denied",
          min_role_required: gate.min_role_required ?? null,
        },
        { status: 403 },
      );
    }

    // Cookie header is forwarded to the same-origin per-id send route so the
    // user session propagates. In Next.js route handlers we can rebuild the
    // origin from the incoming request URL.
    const cookieHeader = request.headers.get("cookie") ?? "";
    const origin = new URL(request.url).origin;
    const batchId = randomUUID();
    const results: PerProfileResult[] = [];

    // ── Batch-level telemetry (Council Gate 4 R2 — Fix #4) ─────────────
    // Emitted BEFORE the loop so consumers can correlate per-profile
    // `contract created` / `contract sent` events back to one admin action
    // via batch_id. Entity is the workspace itself (the hub surface) —
    // matches the ContractHubViewed pattern. writeActivityTrail requires
    // `properties.entity` or it silently drops the row.
    await emit({
      event: "contract.bulk_send_initiated",
      workspace_id: nonEmpty(workspace_id, "workspace_id"),
      actor_id: nonEmpty(actorProfile.profile_id, "actor_id"),
      properties: {
        entity: {
          entity_type: "workspace",
          entity_id: workspace_id,
          entity_label: "Contracts Hub",
        },
        data: {
          batch_id: batchId,
          template_id,
          profile_count: profile_ids.length,
        },
      },
    });

    // Serial iteration — no Promise.all. Each profile is composed+persisted,
    // then the existing single-contract send endpoint is called.
    for (const profile_id of profile_ids) {
      try {
        // Compose — derive terms from cascade (defaults for category/percentage
        // since bulk-send does not expose per-profile overrides in Phase 3; the
        // composition engine picks up whatever is already on the profile).
        const proposal = await resolveComposition(supabase, workspace_id, profile_id, {
          employment_category: "fast" as EmploymentCategory,
          employment_percentage: 100,
          position_title: "",
        });

        const { employment_terms } = proposal;

        const { data: contract, error: insertError } = await supabase
          .from("employment_contract")
          .insert({
            workspace_id,
            profile_id,
            status: "draft",
            position_title: employment_terms.position_title,
            employment_category: employment_terms.employment_category,
            employment_percentage: employment_terms.employment_percentage,
            hourly_rate: employment_terms.hourly_rate,
            monthly_salary: employment_terms.monthly_salary,
            start_date: employment_terms.start_date,
            created_by: actorProfile.profile_id,
          })
          .select("contract_id")
          .single();

        if (insertError || !contract) {
          results.push({
            profile_id,
            status: "failed",
            error: `insert failed: ${insertError?.message ?? "unknown"}`,
          });
          continue;
        }

        // Call the existing per-id send endpoint via same-origin fetch so all
        // the heavy send logic (framework snapshot, PII check, template
        // resolution, DocuSeal) stays in one place. The incoming cookie header
        // carries the user session.
        const sendRes = await fetch(
          `${origin}/api/employment-contracts/${contract.contract_id}/send`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              cookie: cookieHeader,
            },
            body: JSON.stringify({ idempotency_key: `${batchId}:${profile_id}` }),
          },
        );

        if (!sendRes.ok) {
          const errBody = (await sendRes.json().catch(() => ({}))) as { error?: string };
          results.push({
            profile_id,
            status: "failed",
            contract_id: contract.contract_id,
            error: errBody.error ?? `send failed with status ${sendRes.status}`,
          });
          continue;
        }

        const sendJson = (await sendRes.json()) as {
          sent: boolean;
          status: string;
          contract_id: string;
          signing_contract_id?: string;
          pii_complete?: boolean;
        };

        results.push({
          profile_id,
          status: sendJson.pii_complete ? "created_and_sent" : "created_pending_data",
          contract_id: contract.contract_id,
          signing_contract_id: sendJson.signing_contract_id,
        });
      } catch (err) {
        results.push({
          profile_id,
          status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const counts = results.reduce(
      (acc, r) => {
        if (r.status === "created_and_sent") acc.sent++;
        else if (r.status === "created_pending_data") acc.pending++;
        else acc.failed++;
        return acc;
      },
      { sent: 0, pending: 0, failed: 0 },
    );

    return NextResponse.json({
      batch_id: batchId,
      template_id,
      counts,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
