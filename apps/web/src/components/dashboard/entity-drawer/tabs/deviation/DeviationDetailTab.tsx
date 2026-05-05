"use client";

/**
 * Drawer tab for a single deviation.
 *
 * Reads the row from `public.deviation` + reporter profile join. Lets admin
 * acknowledge / resolve / escalate inline. Mutations write directly to the
 * deviation row (RLS gates) and invalidate query cache so badges refresh.
 */

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, AlertOctagon, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "@smartout/i18n";
import { createClient } from "@smartout/supabase/client";
import { Button } from "@/components/ui/button";
import { DrawerSection } from "../../shared/DrawerSection";
import { DrawerSkeleton } from "../../shared/DrawerSkeleton";
import { DrawerEmptyState } from "../../shared/DrawerEmptyState";

type DeviationRow = {
  deviation_id: string;
  title: string;
  description: string | null;
  domain: string | null;
  subcategory: string | null;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "acknowledged" | "resolved" | "escalated";
  cost_impact: number | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  reporter: { display_name: string } | null;
};

const severityClass: Record<DeviationRow["severity"], string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  high: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  critical: "bg-rose-500/20 text-rose-700 dark:text-rose-300",
};

const statusClass: Record<DeviationRow["status"], string> = {
  open: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  acknowledged: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  resolved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  escalated: "bg-rose-500/20 text-rose-700 dark:text-rose-300",
};

export function DeviationDetailTab({ entityId }: { entityId: string }) {
  const { t } = useTranslation("dashboard");
  const qc = useQueryClient();
  const [resolution, setResolution] = useState("");
  const [isPending, startTransition] = useTransition();

  const q = useQuery({
    queryKey: ["entity-drawer", "deviation", entityId],
    enabled: !!entityId,
    queryFn: async (): Promise<DeviationRow | null> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("deviation")
        .select(
          "deviation_id, title, description, domain, subcategory, severity, status, cost_impact, resolution_notes, resolved_at, created_at, reporter:profile!reported_by(display_name)",
        )
        .eq("deviation_id", entityId)
        .single();
      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }
      return data as unknown as DeviationRow;
    },
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["entity-drawer", "deviation", entityId] });
    qc.invalidateQueries({ queryKey: ["deviations"] });
    qc.invalidateQueries({ queryKey: ["day-control", "timeline-events"] });
  }

  function setStatus(next: DeviationRow["status"], extra?: { resolution_notes?: string }) {
    startTransition(async () => {
      const supabase = createClient();
      const patch: Record<string, unknown> = { status: next };
      if (next === "resolved") {
        patch.resolved_at = new Date().toISOString();
        if (extra?.resolution_notes) patch.resolution_notes = extra.resolution_notes;
      }
      const { error } = await supabase.from("deviation").update(patch).eq("deviation_id", entityId);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(`Avvik: ${next}`);
      refresh();
    });
  }

  if (q.isLoading) return <DrawerSkeleton />;
  if (!q.data)
    return <DrawerEmptyState icon={AlertTriangle} message={t("entity_drawer.coming_soon")} />;

  const d = q.data;
  const created = new Date(d.created_at);

  return (
    <div className="space-y-4 p-4">
      <DrawerSection label={d.title}>
        {d.description ? (
          <p className="text-foreground text-sm leading-relaxed">{d.description}</p>
        ) : (
          <p className="text-muted-foreground text-sm italic">Ingen beskrivelse</p>
        )}
      </DrawerSection>

      <div className="flex flex-wrap gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase ${severityClass[d.severity]}`}
        >
          {d.severity}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase ${statusClass[d.status]}`}
        >
          {d.status}
        </span>
        {d.domain ? (
          <span className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase">
            {d.domain}
          </span>
        ) : null}
      </div>

      <DrawerSection label="Rapportert">
        <div className="text-foreground text-[13px]">
          {d.reporter?.display_name ?? "Ukjent"}
          <span className="text-muted-foreground ml-2 font-mono text-[11px] tabular-nums">
            {created.toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}
          </span>
        </div>
      </DrawerSection>

      {d.cost_impact != null ? (
        <DrawerSection label="Kostnadseffekt">
          <span className="text-foreground font-mono text-[13px] tabular-nums">
            {d.cost_impact.toLocaleString("nb-NO")} kr
          </span>
        </DrawerSection>
      ) : null}

      {d.status === "resolved" ? (
        <DrawerSection label="Løst">
          {d.resolution_notes ? (
            <p className="text-foreground text-sm leading-relaxed">{d.resolution_notes}</p>
          ) : null}
          {d.resolved_at ? (
            <p className="text-muted-foreground mt-1 font-mono text-[11px] tabular-nums">
              {new Date(d.resolved_at).toLocaleString("nb-NO")}
            </p>
          ) : null}
        </DrawerSection>
      ) : (
        <DrawerSection label="Handling">
          <textarea
            rows={3}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Hvordan ble avviket håndtert? (kreves for å løse)"
            disabled={isPending}
            className="bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (resolution.trim().length < 5) {
                  toast.error("Skriv en kort oppsummering først");
                  return;
                }
                setStatus("resolved", { resolution_notes: resolution.trim() });
              }}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Løs
            </Button>
            {d.status === "open" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setStatus("acknowledged")}
                disabled={isPending}
              >
                Bekreft
              </Button>
            ) : null}
            {d.status !== "escalated" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setStatus("escalated")}
                disabled={isPending}
              >
                <AlertOctagon className="mr-1.5 h-3.5 w-3.5" />
                Eskaler
              </Button>
            ) : null}
          </div>
        </DrawerSection>
      )}
    </div>
  );
}
