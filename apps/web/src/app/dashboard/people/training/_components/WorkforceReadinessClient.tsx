/**
 * WorkforceReadinessClient.tsx
 *
 * Client island for /dashboard/people/training.
 * Workspace context is resolved server-side and passed as props,
 * avoiding an extra auth roundtrip on the client.
 *
 * Structure:
 *   PageHeader (h1 + subtitle)
 *   KpiStrip (4 cards: ready, avg readiness, expired, expiring soon)
 *   DepartmentFilter (pills — shown only when ≥2 departments)
 *   ProfileList (<ReadinessProfileRow> per profile)
 *
 * Telemetry: emits people.training.viewed once on first data load (L-0177 compliant).
 */
"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Loader2, Filter, Users, AlertTriangle, Clock, TrendingUp } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { Button } from "@/components/ui/button";
import { emit, nonEmpty } from "@smartout/telemetry";
import { useWorkforceReadiness } from "@/app/dashboard/_hooks/use-workforce-readiness";
import { ReadinessProfileRow } from "./ReadinessProfileRow";

// ── Props ───────────────────────────────────────────────────────────────────

type Props = {
  workspaceId: string;
  profileId: string;
};

// ── KPI card ────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-card border-border relative overflow-hidden rounded-2xl border p-5 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="text-muted-foreground h-4 w-4" aria-hidden />
        <span className="text-muted-foreground text-[11px] font-bold tracking-widest uppercase">
          {label}
        </span>
      </div>
      <div className="font-mono text-[32px] leading-none font-black tracking-tight tabular-nums">
        {value}
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function WorkforceReadinessClient({ workspaceId, profileId }: Props) {
  const { t } = useTranslation("dashboard");
  const { data, isLoading } = useWorkforceReadiness();
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);

  // ── KPI computations ──────────────────────────────────────────────────────

  const allCells = useMemo(
    () => data?.rows.flatMap((r) => Object.values(r.protocols)) ?? [],
    [data],
  );

  const readyCount = useMemo(
    () => data?.rows.filter((r) => r.readinessPercent === 100).length ?? 0,
    [data],
  );

  const totalCount = data?.rows.length ?? 0;

  const avgReadiness = useMemo(() => {
    if (!data || data.rows.length === 0) return 0;
    const sum = data.rows.reduce((acc, r) => acc + r.readinessPercent, 0);
    return Math.round(sum / data.rows.length);
  }, [data]);

  const forfaltCount = useMemo(
    () => allCells.filter((c) => c.status === "expired").length,
    [allCells],
  );

  const soonCount = useMemo(() => {
    const cutoff = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    return allCells.filter((c) => c.nextReviewAt !== null && c.nextReviewAt <= cutoff).length;
  }, [allCells]);

  // ── Department filter ─────────────────────────────────────────────────────

  const departments = useMemo(() => {
    if (!data) return [];
    const set = new Set(data.rows.map((r) => r.departmentName).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    if (!departmentFilter) return data.rows;
    return data.rows.filter((r) => r.departmentName === departmentFilter);
  }, [data, departmentFilter]);

  // ── Telemetry — emit once on first data load ───────────────────────────────
  // L-0177: nonEmpty() throws on empty string — fail-fast before corrupt telemetry.

  const trainingViewedRef = useRef(false);
  useEffect(() => {
    if (!data || trainingViewedRef.current) return;
    trainingViewedRef.current = true;
    void emit({
      event: "people.training.viewed",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "workspace",
          entity_id: workspaceId,
          entity_label: "People Training",
        },
        data: {
          profile_count: data.rows.length,
          workspace_readiness_percent: avgReadiness,
          expired_count: forfaltCount,
        },
      },
    });
  }, [data, workspaceId, profileId, avgReadiness, forfaltCount]);

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  if (!data || data.rows.length === 0) {
    return (
      <div className="relative flex h-full min-h-0 flex-1 flex-col p-4 pt-1 md:p-6 md:pt-3">
        <PageHeader t={t} />
        <div className="border-border rounded-xl border-2 border-dashed p-8 text-center">
          <p className="text-muted-foreground text-sm">{t("people.training.no_assignments")}</p>
        </div>
      </div>
    );
  }

  // ── Full view ─────────────────────────────────────────────────────────────

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col p-4 pt-1 md:p-6 md:pt-3">
      <PageHeader t={t} />

      {/* KPI strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={Users}
          label={t("people.training.kpi_ready")}
          value={`${readyCount}/${totalCount}`}
        />
        <KpiCard
          icon={TrendingUp}
          label={t("people.training.kpi_avg")}
          value={`${avgReadiness}%`}
        />
        <KpiCard
          icon={AlertTriangle}
          label={t("people.training.kpi_expired")}
          value={forfaltCount}
        />
        <KpiCard icon={Clock} label={t("people.training.kpi_soon")} value={soonCount} />
      </div>

      {/* Department filter — only shown when ≥2 departments */}
      {departments.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-1">
          <Filter className="text-muted-foreground mr-1 h-4 w-4" aria-hidden />
          <Button
            variant={departmentFilter === null ? "default" : "ghost"}
            size="sm"
            className="text-xs"
            onClick={() => setDepartmentFilter(null)}
          >
            {t("people.training.filter_all")}
          </Button>
          {departments.map((dept) => (
            <Button
              key={dept}
              variant={departmentFilter === dept ? "default" : "ghost"}
              size="sm"
              className="text-xs"
              onClick={() => setDepartmentFilter(dept)}
            >
              {dept}
            </Button>
          ))}
        </div>
      )}

      {/* Profile list */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <ul className="space-y-3">
          {filteredRows.map((row) => (
            <ReadinessProfileRow key={row.profileId} row={row} columns={data.columns} />
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Page header (extracted for reuse in empty state) ─────────────────────────

function PageHeader({ t }: { t: (key: string) => string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight">
          {t("people.tab_training")}
        </h1>
        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
          <span>{t("people.training.subtitle")}</span>
        </div>
      </div>
    </div>
  );
}
