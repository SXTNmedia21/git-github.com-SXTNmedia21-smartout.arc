// page.tsx — /avstemming/[run_id]
//
// Permanent view of a completed settlement run. Server Component.
// Auth: requireAccountant() + ownership check (run.initiated_by = userId).
// Renders run header, summary JSONB view, and 4 download buttons.

import { notFound } from "next/navigation";
import { requireAccountant } from "@/lib/accountant";
import { createClient } from "@/lib/supabase/server";
import { emit, nonEmpty } from "@smartout/telemetry";
import { fetchSettlementRun, fetchSettlementArtifacts } from "@/lib/avstemming/fetchers";
import { Badge } from "@/components/ui/badge";
import type { SettlementSummary } from "@smartout/billing";

import { SettlementSummaryView } from "./_components/SettlementSummaryView";
import { ArtifactDownloads } from "./_components/ArtifactDownloads";

type Props = {
  params: Promise<{ run_id: string }>;
};

/** Format ISO datetime as "02.09.2026 kl. 14:22". */
function fmtCompletedAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " kl. " +
    d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })
  );
}

/** Derive period label from period_start e.g. "April 2026". */
function periodLabel(periodStart: string): string {
  return new Date(periodStart + "T00:00:00Z").toLocaleDateString("nb-NO", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/** Map run status to Badge variant. */
function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "succeeded") return "secondary";
  if (status === "failed") return "destructive";
  return "outline";
}

/** Map run status to Norwegian label. */
function statusLabel(status: string): string {
  if (status === "succeeded") return "Fullført";
  if (status === "failed") return "Feilet";
  if (status === "running") return "Kjører";
  return status;
}

export default async function SettlementRunPage({ params }: Props) {
  const [{ userId }, { run_id }] = await Promise.all([requireAccountant(), params]);
  const supabase = await createClient();

  const [run, artifacts] = await Promise.all([
    fetchSettlementRun(supabase, run_id),
    fetchSettlementArtifacts(supabase, run_id),
  ]);

  // 404 if not found — also handles RLS denial (query returns null).
  if (!run) notFound();

  // Defense-in-depth ownership check (RLS is primary gate via initiated_by policy).
  if (run.initiated_by !== userId) notFound();

  // Emit telemetry (best-effort — non-fatal).
  await emit({
    event: "kartotek viewed",
    actor_id: nonEmpty(userId, "actor_id"),
    workspace_id: null,
    properties: {
      entity: { entity_type: "settlement_run", entity_id: run_id },
      data: { run_id, source: "direct" },
    },
  }).catch(console.error);

  // Parse summary JSONB — may be empty on running/failed runs.
  const summary = (run.summary ?? {}) as Partial<SettlementSummary>;
  const hasSummary =
    summary.totals != null && summary.by_workspace != null && summary.discrepancies != null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl">Avstemming — {periodLabel(run.period_start)}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Fullført: {fmtCompletedAt(run.completed_at)}
          </p>
        </div>
        <Badge variant={statusVariant(run.status)} className="self-start text-sm">
          {statusLabel(run.status)}
        </Badge>
      </div>

      {/* Error message on failed runs */}
      {run.status === "failed" && run.error_message && (
        <div className="border-border bg-muted text-foreground rounded-md border px-4 py-3 text-sm">
          <span className="font-medium">Feil: </span>
          {run.error_message}
        </div>
      )}

      {/* Summary JSONB view */}
      {hasSummary ? (
        <SettlementSummaryView summary={summary as SettlementSummary} />
      ) : run.status === "running" ? (
        <div className="border-border bg-muted text-muted-foreground rounded-md border px-4 py-6 text-center text-sm">
          Kjøringen pågår — oppdater siden om noen sekunder.
        </div>
      ) : null}

      {/* Artifact downloads */}
      <div>
        <h2 className="text-foreground mb-3 text-base font-semibold">Last ned</h2>
        <ArtifactDownloads runId={run_id} artifacts={artifacts} />
      </div>
    </div>
  );
}
