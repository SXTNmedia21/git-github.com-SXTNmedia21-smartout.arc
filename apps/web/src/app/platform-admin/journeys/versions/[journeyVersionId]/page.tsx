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

  return (
    <JourneyVersionEditor
      journeyVersionId={row.journey_version_id}
      initialStatus={row.status as JourneyVersionStatus}
      initialVersionNumber={row.version_number}
      initialIr={ir}
    />
  );
}
