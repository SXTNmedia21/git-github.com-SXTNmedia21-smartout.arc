// ============================================
// page.tsx — Journey Version list (M4)
//
// Server component. Fetches all journey_version rows with their parent
// journey metadata (title, module), maps to the M4 list view, and hands
// off to the client component for filtering.
//
// This page is the NEW authoring surface for journey_version. The sibling
// page at /platform-admin/journeys/page.tsx is the LEGACY tracking portal
// on the `journey` table — preserved verbatim. M4 sits alongside.
// ============================================

import Link from "next/link";
import { Plus } from "lucide-react";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { JourneyVersionStatus } from "./_lib/version-status";
import { JourneyVersionListClient, type JourneyVersionRow } from "./_components/JourneyVersionList";

export default async function JourneyVersionsListPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const { data } = await admin
    .from("journey_version")
    .select(
      "journey_version_id, workspace_id, journey_id, version_number, status, ir_json, created_at, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  // Flatten IR's slug/title/module into the row so the list view doesn't
  // need to parse JSON client-side. Invalid IR rows surface as "(invalid)".
  const rows: JourneyVersionRow[] = (data ?? []).map((r) => {
    const ir = (r.ir_json ?? {}) as { slug?: string; title?: string; module?: string };
    return {
      journeyVersionId: r.journey_version_id,
      journeyId: r.journey_id,
      workspaceId: r.workspace_id,
      versionNumber: r.version_number,
      status: r.status as JourneyVersionStatus,
      slug: typeof ir.slug === "string" ? ir.slug : "(invalid)",
      title: typeof ir.title === "string" ? ir.title : "(invalid)",
      module: typeof ir.module === "string" ? ir.module : "(invalid)",
      updatedAt: r.updated_at,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-foreground text-2xl">Journey Versions</h1>
          <p className="text-muted-foreground text-sm">
            Authoring surface for JourneyIR — {rows.length} version{rows.length === 1 ? "" : "s"}.
          </p>
        </div>
        <Link href="/platform-admin/journeys/versions/new">
          <Button className="min-h-11">
            <Plus className="mr-1.5 h-4 w-4" />
            New Journey Version
          </Button>
        </Link>
      </div>

      <JourneyVersionListClient rows={rows} />
    </div>
  );
}
