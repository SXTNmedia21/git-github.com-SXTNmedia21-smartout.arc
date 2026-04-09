"use client";

/**
 * KPI Targets settings — configure target values for the 6 workspace KPIs.
 * Each metric gets a card with a numeric input and unit label.
 * Saves via upsert to workspace_kpi_target (onConflict: workspace_id, metric).
 *
 * UI Events:
 * - action: upsertKpiTargets mutation (save all button)
 */

import { useContext, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Target } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
} from "@smartout/ui";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { toast } from "sonner";

// ─── Metric definitions ────────────────────────────────────────────────────

type MetricDef = {
  key: string;
  label: string;
  description: string;
  unit: string;
  step: number;
  defaultValue: number;
};

const METRICS: MetricDef[] = [
  {
    key: "cost_of_sales",
    label: "Cost of Sales",
    description: "Total labor costs divided by total revenue.",
    unit: "%",
    step: 0.5,
    defaultValue: 30,
  },
  {
    key: "turnover_90d",
    label: "Turnover (90 days)",
    description: "Employee turnover rate over a rolling 90-day window.",
    unit: "%",
    step: 0.5,
    defaultValue: 15,
  },
  {
    key: "absence_rate",
    label: "Absence Rate",
    description: "Total absence hours divided by expected work hours.",
    unit: "%",
    step: 0.5,
    defaultValue: 5,
  },
  {
    key: "time_to_job_ready",
    label: "Time to Job Ready",
    description: "Average days from first shift to completing all onboarding.",
    unit: "days",
    step: 1,
    defaultValue: 14,
  },
  {
    key: "task_completion",
    label: "Task Completion",
    description: "Percentage of assigned tasks completed across all shifts.",
    unit: "%",
    step: 1,
    defaultValue: 90,
  },
  {
    key: "training_readiness",
    label: "Training Readiness",
    description: "Percentage of protocol assignments completed by active staff.",
    unit: "%",
    step: 1,
    defaultValue: 80,
  },
];

// ─── Schema ────────────────────────────────────────────────────────────────

const kpiTargetsSchema = z.object(
  Object.fromEntries(
    METRICS.map((m) => [
      m.key,
      z.coerce.number().min(0, "Must be >= 0").max(m.unit === "days" ? 365 : 100, `Max ${m.unit === "days" ? "365" : "100"}`),
    ]),
  ) as Record<string, z.ZodNumber>,
);

type KpiTargetsInput = z.infer<typeof kpiTargetsSchema>;

// ─── Loading skeleton ──────────────────────────────────────────────────────

function KpiTargetsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="space-y-3 pt-6">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-9 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────

export function KpiTargetsSettings() {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const wsId = workspace.workspace_id;
  const queryKey = ["settings", "kpi-targets", wsId];

  // Fetch existing targets
  const { data: targets, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_kpi_target")
        .select("metric, target_value")
        .eq("workspace_id", wsId);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Build default values from fetched data or metric defaults
  const defaultValues = Object.fromEntries(
    METRICS.map((m) => {
      const existing = targets?.find((t) => t.metric === m.key);
      return [m.key, existing ? Number(existing.target_value) : m.defaultValue];
    }),
  ) as KpiTargetsInput;

  const form = useForm<KpiTargetsInput>({
    resolver: zodResolver(kpiTargetsSchema),
    defaultValues: Object.fromEntries(METRICS.map((m) => [m.key, m.defaultValue])),
  });

  // Reset form when data loads
  useEffect(() => {
    if (targets) {
      form.reset(defaultValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when targets change
  }, [targets]);

  const upsertMutation = useMutation({
    mutationFn: async (values: KpiTargetsInput) => {
      const rows = METRICS.map((m) => ({
        workspace_id: wsId,
        metric: m.key,
        target_value: values[m.key],
      }));

      const { error } = await supabase
        .from("workspace_kpi_target")
        .upsert(rows, { onConflict: "workspace_id,metric" });
      if (error) throw error;
    },
    onSuccess: () => {
      void emit({
        event: "kpi_targets updated",
        workspace_id: wsId,
        actor_id: profileId ?? "",
        properties: { data: { metrics: METRICS.map((m) => m.key) } },
      });
      void queryClient.invalidateQueries({ queryKey });
      toast.success("KPI targets saved");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  if (isLoading) return <KpiTargetsSkeleton />;

  const onSubmit = form.handleSubmit((values) => upsertMutation.mutate(values));

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <h2 className="text-foreground text-lg font-semibold">KPI Targets</h2>
        <p className="text-muted-foreground text-sm">
          Set target values for your key performance indicators. These drive dashboard alerts and
          trend indicators.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {METRICS.map((metric) => (
          <Card key={metric.key}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Target className="text-muted-foreground h-4 w-4" />
                {metric.label}
              </CardTitle>
              <CardDescription className="text-xs">{metric.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step={metric.step}
                  min={0}
                  max={metric.unit === "days" ? 365 : 100}
                  className="flex-1"
                  {...form.register(metric.key, { valueAsNumber: true })}
                />
                <span className="text-muted-foreground shrink-0 text-sm font-medium">
                  {metric.unit}
                </span>
              </div>
              {form.formState.errors[metric.key] && (
                <p className="text-destructive mt-1 text-xs">
                  {form.formState.errors[metric.key]?.message}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={upsertMutation.isPending || !form.formState.isDirty}>
          {upsertMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Targets
        </Button>
      </div>
    </form>
  );
}
