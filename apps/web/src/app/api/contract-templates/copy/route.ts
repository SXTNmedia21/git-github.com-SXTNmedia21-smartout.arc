/**
 * POST /api/contract-templates/copy — Clone a system (K1a) template into a
 * workspace (K1b fork).
 *
 * Creates a workspace-owned copy of an immutable system template.
 * The copy gets is_system=false, the caller's workspace_id, and the full
 * lineage set (source_template_id, source_template_version, forked_at)
 * populated atomically on insert — Council 2026-04-22 Gate G4/G5.
 *
 * Telemetry — Fix #3 (ADR-0191): each fork operation emits exactly ONE
 * `contract_template forked` event in activity_trail. This route is the
 * canonical emit site for the UI fork path (called from MalerTab via
 * `useCopySystemTemplate`). The agent fork path is canonical from
 * `packages/ai/src/capabilities/contract/tools.ts:forkTemplate` (which now
 * writes directly via supabaseAdmin and emits there).
 *
 * The legacy `contract_template copied` event is DEPRECATED and removed
 * here. Consumers must migrate to `contract_template forked` (G2 registry
 * — `packages/telemetry/src/registry.ts`). The previous duplicate emit
 * from the agent tool has been dropped.
 */

import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { z } from "zod";
import { emit } from "@smartout/telemetry";

const copySchema = z.object({
  workspace_id: z.string().uuid(),
  system_template_id: z.string().uuid(),
  // Accepted as `name` (legacy) or `name_override` (capability-tool caller).
  // At least one must resolve to a non-empty string; if both are absent the
  // server derives one from the source name (`<name> (kopi)`).
  name: z.string().min(1).max(200).optional(),
  name_override: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = copySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { workspace_id, system_template_id, name, name_override, description } = parsed.data;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role gate
    const { data: actorProfile } = await supabase
      .from("profile")
      .select("profile_id, role")
      .eq("user_id", user.id)
      .eq("workspace_id", workspace_id)
      .single();

    if (!actorProfile || !["admin", "owner"].includes(actorProfile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Load source template (must be a system/K1a row — Gate G3 trigger also
    // guards the is_system flag from later flips, but we assert here for a
    // precise 404 vs 400 distinction).
    const { data: source, error: sourceError } = await supabase
      .from("contract_template")
      .select("*")
      .eq("template_id", system_template_id)
      .eq("is_system", true)
      .single();

    if (sourceError || !source) {
      return NextResponse.json({ error: "System template not found" }, { status: 404 });
    }

    // Resolve the display name: explicit override > legacy name > derived.
    const resolvedName = name_override ?? name ?? `${source.name} (kopi)`;

    // Lineage stamp — atomic with the INSERT so partial-forks never exist.
    // `source.version` is a numeric column; the lineage column is text to
    // accommodate future semver-style versioning, so we stringify here.
    const forkedAt = new Date().toISOString();
    const sourceVersion = source.version !== null ? String(source.version) : null;

    // Insert workspace copy with lineage columns populated atomically.
    // is_system is hardcoded to false as belt-and-suspenders — the Gate G3
    // trigger would block any later flip, but insert-side we assert the
    // initial value too.
    const { data: copy, error: copyError } = await supabase
      .from("contract_template")
      .insert({
        name: resolvedName,
        description: description ?? source.description,
        workspace_id,
        contract_type: source.contract_type,
        language: source.language,
        content_html: source.content_html,
        content_css: source.content_css,
        header_html: source.header_html,
        footer_html: source.footer_html,
        placeholders: source.placeholders,
        employment_category: source.employment_category,
        is_system: false,
        is_active: true,
        version: 1,
        created_by: user.id,
        // ── Gate G5 lineage columns ──
        source_template_id: system_template_id,
        source_template_version: sourceVersion,
        forked_at: forkedAt,
        // Explicitly null for a fresh fork — caller can publish later.
        published_at: null,
        deprecated_at: null,
      })
      .select("template_id, name, source_template_id, source_template_version, forked_at")
      .single();

    if (copyError || !copy) {
      return NextResponse.json(
        { error: `Failed to copy: ${copyError?.message ?? "unknown"}` },
        { status: 500 },
      );
    }

    // Fix #3 (ADR-0191): canonical emit for the UI fork path. Exactly one
    // `contract_template forked` event per fork operation. The legacy
    // `contract_template copied` event was removed in this same fix —
    // downstream consumers must read `forked` from the G2 registry instead.
    // The agent fork path emits its own `forked` from
    // `packages/ai/src/capabilities/contract/tools.ts:forkTemplate`.
    await emit({
      event: "contract_template forked",
      workspace_id,
      actor_id: actorProfile.profile_id,
      properties: {
        entity: { entity_type: "contract_template", entity_id: copy.template_id },
        data: {
          source_template_id: system_template_id,
          source_scope: "system",
          name: copy.name,
        },
      },
    });

    return NextResponse.json(copy, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
