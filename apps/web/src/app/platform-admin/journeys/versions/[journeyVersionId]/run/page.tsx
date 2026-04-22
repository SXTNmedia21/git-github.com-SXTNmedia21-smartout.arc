// ============================================
// page.tsx — Journey Version Test-Run (M5.1 + N-C + N-D)
//
// Server component. Embeds the Fjernkontroll runtime UI for a single
// journey_version row. Godmode-only — `getSuperAdminId()` gates access
// before any render; non-admin traffic is redirected to /dashboard.
//
// M5.1 scope: render Fjernkontroll(idle).
// N-C extension: wrap Fjernkontroll in DevRunLauncher so the Start click
// invokes `startDevRunAction` (Server Action → `journey.run_dev` capability
// → engine_state insert → run_started + step_reached emits), then passes
// the returned run_id back into Fjernkontroll so its engine_event realtime
// subscription picks up out-of-band worker updates.
// N-D extension: accept `?run=<uuid>` URL param. When present AND valid,
// skip the Start-button flow and render Fjernkontroll directly with the
// provided runId — this is the entry point J7/J8 Playwright tests use
// after seeding an engine_state row out-of-band.
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
import { DevRunLauncher } from "./_components/DevRunLauncher";

type Props = {
  params: Promise<{ journeyVersionId: string }>;
  searchParams: Promise<{ run?: string }>;
};

// RFC 4122 UUID shape — any version, any case. Guards against navigating
// the test-run page with a malformed `?run=` value; when invalid we silently
// fall back to the Start-button flow (the e2e suite seeds a real UUID so
// this branch is only a safety net).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function JourneyVersionRunPage({ params, searchParams }: Props) {
  const { journeyVersionId } = await params;
  const { run: runParam } = await searchParams;
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("journey_version")
    .select("journey_version_id, version_number, status")
    .eq("journey_version_id", journeyVersionId)
    .maybeSingle();

  if (error || !row) notFound();

  // Only honour `?run=` when it's a well-formed UUID. Anything else falls
  // through to the Start-button flow — malformed params don't crash the page.
  const urlRunId = runParam && UUID_RE.test(runParam) ? runParam : null;

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
            {urlRunId ? (
              <>
                Følger en eksisterende kjøring via
                <code className="bg-muted border-border mx-1 rounded border px-1 py-0.5 font-mono text-xs">
                  ?run=
                </code>
                — Fjernkontrollen abonnerer på
                <code className="bg-muted border-border mx-1 rounded border px-1 py-0.5 font-mono text-xs">
                  engine_event
                </code>
                for denne run_id.
              </>
            ) : (
              <>
                Kjør denne versjonen gjennom Fjernkontrollen. Start-knappen kaller
                <code className="bg-muted border-border mx-1 rounded border px-1 py-0.5 font-mono text-xs">
                  journey.run_dev
                </code>
                — Playwright-arbeideren plukker opp køen ut-av-bånd.
              </>
            )}
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            Status: <code className="font-mono">{row.status}</code> · v{row.version_number}
          </p>
        </div>
      </header>

      {urlRunId ? (
        <Fjernkontroll journeyVersionId={row.journey_version_id} runId={urlRunId} />
      ) : (
        <DevRunLauncher journeyVersionId={row.journey_version_id} />
      )}
    </div>
  );
}
