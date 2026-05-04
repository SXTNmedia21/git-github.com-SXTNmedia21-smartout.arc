// ============================================
// page.tsx — Journey Version Detail / Edit (M4)
//
// Server component. Fetches one journey_version row, validates the
// stored IR against the canonical Zod schema, and hands off to the
// client editor. Returns 404 if not found, redirects non-godmode.
// ============================================

import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@smartout/supabase/admin";
import { JourneyIRSchema, type JourneyIR } from "@smartout/journey-ir";
import { getSuperAdminId } from "@/lib/platform-admin";
import type { JourneyVersionStatus } from "../_lib/version-status";
import { JourneyVersionEditor } from "./_components/JourneyVersionEditor";
import type { MissionStageRow } from "./_components/MissionEnrichPanel";

type Props = {
  params: Promise<{ journeyVersionId: string }>;
};

/**
 * Why we parse with Zod server-side:
 * the `journey_version.ir_json` column is `jsonb` — shape is not enforced
 * at the DB layer. A corrupt row (from a legacy insert, hand-fix, or
 * future migration slip) would crash the client. Returning a 404 is
 * unhelpful; instead we surface a minimal error card and let the admin
 * see the raw status / decide to archive.
 */
export default async function JourneyVersionDetailPage({ params }: Props) {
  const { journeyVersionId } = await params;
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("journey_version")
    .select(
      "journey_version_id, status, version_number, ir_json, workspace_id, created_at, updated_at",
    )
    .eq("journey_version_id", journeyVersionId)
    .single();

  if (error || !row) notFound();

  const parsed = JourneyIRSchema.safeParse(row.ir_json);

  if (!parsed.success) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-foreground text-2xl">Corrupt journey version</h1>
        <p className="text-muted-foreground text-sm">
          The <code>ir_json</code> payload for this row does not match <code>JourneyIRSchema</code>.
          This usually means a hand-edit or a mid-migration state. Archive + recreate is the safest
          path.
        </p>
        <pre className="border-border bg-muted text-foreground overflow-x-auto rounded-md border p-3 font-mono text-xs">
          {parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n")}
        </pre>
        <p className="text-muted-foreground text-xs">
          Status: <code>{row.status}</code> · v{row.version_number}
        </p>
      </div>
    );
  }

  const ir: JourneyIR = parsed.data;

  // ── M4: fetch linked engine_mission + stages ───────────────────────────────
  // `publish_mission` derives the mission id as `journey_<slug>_v<version>`.
  // We look up by workspace_id + journey_id match; for v1 the mission FK to
  // journey is nullable so we also filter by workspace to scope correctly.
  // If no mission row exists (not yet published) we skip the enrich panel.
  let missionData: {
    id: string;
    name: string;
    is_active: boolean;
    stages: MissionStageRow[];
  } | null = null;

  if (row.status === "published") {
    const { data: missions } = await admin
      .from("engine_missions")
      .select("id, name, is_active, workspace_id")
      .eq("workspace_id", row.workspace_id ?? "")
      .order("created_at", { ascending: false })
      .limit(20);

    // The mission id convention per ADR-0194: `journey_<slug>_v<version>`.
    // We match the slug from the parsed IR.
    const expectedId = `journey_${ir.slug}_v${row.version_number}`;
    const mission = (missions ?? []).find((m) => m.id === expectedId) ?? (missions ?? [])[0];

    if (mission) {
      const { data: stages } = await admin
        .from("engine_stages")
        .select("stage_id, stage_order, goal, instructions, success_criteria, creative_freedom")
        .eq("mission_id", mission.id)
        .order("stage_order", { ascending: true });

      // Derive starter values from IR steps (same derivation rule as publish_mission body:
      //   goal := step.title, instructions := step.action, success_criteria := step.assertion)
      // so the diff-highlight in the panel knows what the auto-derived baseline was.
      const irSteps = ir.steps;
      const enrichedStages: MissionStageRow[] = (stages ?? []).map((s, idx) => {
        const irStep = irSteps[idx];
        return {
          stage_id: s.stage_id,
          stage_order: s.stage_order,
          goal: s.goal,
          instructions: s.instructions,
          success_criteria: s.success_criteria,
          creative_freedom: s.creative_freedom ?? 0.3,
          derived_goal: irStep?.title,
          derived_instructions: irStep?.action,
          derived_success_criteria: irStep?.assertion,
        };
      });

      missionData = {
        id: mission.id,
        name: mission.name,
        is_active: mission.is_active,
        stages: enrichedStages,
      };
    }
  }

  return (
    <JourneyVersionEditor
      journeyVersionId={row.journey_version_id}
      initialStatus={row.status as JourneyVersionStatus}
      initialVersionNumber={row.version_number}
      initialIr={ir}
      missionData={missionData}
    />
  );
}
