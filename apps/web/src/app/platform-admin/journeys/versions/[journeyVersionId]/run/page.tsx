// ============================================
// page.tsx — Journey Version Test-Run (M5.1)
//
// Server component. Embeds the Fjernkontroll runtime UI for a single
// journey_version row. Godmode-only — `getSuperAdminId()` gates access
// before any render; non-admin traffic is redirected to /dashboard.
//
// Scope (M5.1):
//   - Read journey_version via the admin client so the row exists
//     regardless of the admin's workspace_id.
//   - Do NOT start a run from this page. The Fjernkontroll itself
//     defaults to `idle` when no `runId` is supplied; the user hits
//     Start, which in M5.2 triggers the `journey.run_guided` server
//     action. Keeping page + runtime split lets us swap the starter
//     later without re-auditing the page.
//
// Why a fresh /run route instead of embedding in the edit page:
//   - Separation of concerns — the edit page is for authoring; the run
//     page is for verification. Linking between them keeps each
//     surface focused.
//   - Future sub-sortie lands a per-run detail page at .../run/[runId]
//     — the same component takes both the idle and running paths.
// ============================================

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@smartout/supabase/admin";
import { Fjernkontroll } from "@/components/journey/Fjernkontroll";
import { getSuperAdminId } from "@/lib/platform-admin";
import { platformAdminRoutes } from "@/lib/platform-admin-routes";

type Props = {
  params: Promise<{ journeyVersionId: string }>;
};

export default async function JourneyVersionRunPage({ params }: Props) {
  const { journeyVersionId } = await params;
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("journey_version")
    .select("journey_version_id, version_number, status")
    .eq("journey_version_id", journeyVersionId)
    .maybeSingle();

  if (error || !row) notFound();

  // Link back to edit — the edit page already validates ir_json via
  // JourneyIRSchema, so the admin can chase IR issues from one place.
  const editHref = `${platformAdminRoutes.root}/journeys/versions/${journeyVersionId}`;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={editHref}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Tilbake til redigering
          </Link>
          <h1 className="font-heading text-foreground mt-2 text-2xl">Test-kjøring</h1>
          <p className="text-muted-foreground text-sm">
            Kjør denne versjonen gjennom Fjernkontrollen. Start-knappen kobler seg til
            <code className="bg-muted border-border mx-1 rounded border px-1 py-0.5 font-mono text-xs">
              journey.run_guided
            </code>
            når M5.2-serveraksjonen lander.
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            Status: <code className="font-mono">{row.status}</code> · v{row.version_number}
          </p>
        </div>
      </header>

      <Fjernkontroll journeyVersionId={row.journey_version_id} />
    </div>
  );
}
