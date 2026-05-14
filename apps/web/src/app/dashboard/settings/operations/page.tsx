"use client";

/**
 * page.tsx — /dashboard/settings/operations
 *
 * Operational settings overview for workspace admins and owners.
 * Surfaces the three pillars that govern daily execution:
 *   1. Opening hours — when the workspace is open per day of the week
 *   2. Working time rules — AML compliance thresholds (W01–W06)
 *   3. Break rules — pause triggers and durations
 *
 * This page is read-only at the summary level. Deep edits are
 * handled by the tabs in the parent /dashboard/settings page —
 * Botsson's navigateToOperationsSetting tool links users there directly.
 *
 * Design: Nordic Split — bg-muted/30, border-border, font-heading,
 * semantic tokens throughout. No hardcoded zinc/gray/slate.
 *
 * Access: owner + admin only (enforced by parent settings layout).
 * ADR-0151: workspace_id / actor_id derived from DashboardContext, never body-supplied.
 * ADR-0238: no in-page chat surface. Orb interactive mode — no DomainChatOwnership.
 */

import { useMemo } from "react";
import { Clock, ShieldCheck, Coffee, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useWorkspaceOperatingHours } from "../_hooks/use-workspace-operating-hours";
import { useWorkingTimeRules } from "../_hooks/use-working-time-rules";
import { useBreakRules } from "../_hooks/use-break-rules";
import { SettingsOperationsToolsBridge } from "./_tools/settings-operations-tools-bridge";
import type {
  OperationsHoursEntry,
  OperationsWorkingTimeRule,
  OperationsBreakRule,
} from "./_tools/use-settings-operations-tools";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function SettingsOperationsPage() {
  // Operating hours — workspace base (D1 Operational Envelope)
  const { hours: rawHours, isLoading: loadingHours } = useWorkspaceOperatingHours();

  // Working time rules — AML compliance (D3 Rules & Constraints)
  const { data: rawWorkingTime, isLoading: loadingWorkingTime } = useWorkingTimeRules();

  // Break rules — pause triggers (D3 Rules & Constraints)
  const { data: rawBreakRules, isLoading: loadingBreakRules } = useBreakRules();

  /* ── Map to tool input shapes ─────────────────────────────────── */

  const operatingHours = useMemo<OperationsHoursEntry[]>(
    () =>
      rawHours.map((h) => ({
        day_name: h.day_name,
        open_time: h.open_time,
        close_time: h.close_time,
        is_closed: h.is_closed,
      })),
    [rawHours],
  );

  const workingTimeRules = useMemo<OperationsWorkingTimeRule[]>(
    () =>
      (rawWorkingTime ?? []).map((r) => ({
        code: r.code,
        name: r.name,
        severity: r.severity,
        threshold_value: r.threshold_value,
        is_active: r.is_active,
      })),
    [rawWorkingTime],
  );

  const breakRules = useMemo<OperationsBreakRule[]>(
    () =>
      (rawBreakRules ?? []).map((r) => ({
        name: r.name,
        trigger_type: r.trigger_type,
        duration_minutes: r.duration_minutes,
        is_active: r.is_active,
      })),
    [rawBreakRules],
  );

  /* ── Derived display values ───────────────────────────────────── */

  const openDays = operatingHours.filter((h) => !h.is_closed);
  const closedDays = operatingHours.filter((h) => h.is_closed);
  const activeWorkingRules = workingTimeRules.filter((r) => r.is_active);
  const activeBreakRules = breakRules.filter((r) => r.is_active);
  const blockingRules = activeWorkingRules.filter((r) => r.severity === "block");

  return (
    <>
      {/* Harness bridge — registers Botsson tools for this surface */}
      <SettingsOperationsToolsBridge
        loadingHours={loadingHours}
        operatingHours={operatingHours}
        loadingWorkingTime={loadingWorkingTime}
        workingTimeRules={workingTimeRules}
        loadingBreakRules={loadingBreakRules}
        breakRules={breakRules}
      />

      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-heading text-foreground mb-2 text-3xl font-extrabold tracking-tight">
          Operasjonelle innstillinger
        </h1>
        <p className="text-muted-foreground text-sm">
          Oversikt over åpningstider, arbeidstidsregler og pauseregler som styrer den daglige
          driften. Rediger i de respektive fanene under Innstillinger.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-3">
        {/* ── Opening hours card ────────────────────────────────── */}
        <SectionCard
          icon={Clock}
          title="Åpningstider"
          description="Workspace base-timer arvet av alle avdelinger."
          href="/dashboard/settings?tab=hours"
          isLoading={loadingHours}
        >
          {loadingHours ? (
            <SkeletonLines count={3} />
          ) : openDays.length === 0 ? (
            <EmptyState message="Ingen åpningstider satt opp ennå." />
          ) : (
            <ul className="space-y-1.5">
              {openDays.map((h) => (
                <li key={h.day_name} className="flex items-center justify-between text-sm">
                  <span className="text-foreground font-medium">{h.day_name}</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {h.open_time} – {h.close_time}
                  </span>
                </li>
              ))}
              {closedDays.length > 0 && (
                <li className="text-muted-foreground/60 pt-1 text-xs">
                  Stengt: {closedDays.map((h) => h.day_name).join(", ")}
                </li>
              )}
            </ul>
          )}
        </SectionCard>

        {/* ── Working time rules card ───────────────────────────── */}
        <SectionCard
          icon={ShieldCheck}
          title="Arbeidstidsregler"
          description="AML-grenser (§10-8) — varsler og blokkering ved brudd."
          href="/dashboard/settings?tab=working-time"
          isLoading={loadingWorkingTime}
        >
          {loadingWorkingTime ? (
            <SkeletonLines count={4} />
          ) : activeWorkingRules.length === 0 ? (
            <EmptyState message="Ingen arbeidstidsregler aktivert. Gå til Arbeidstid-fanen for å aktivere standardreglene." />
          ) : (
            <>
              <div className="mb-3 flex items-center gap-3">
                <Pill
                  icon={CheckCircle2}
                  label={`${activeWorkingRules.length} aktive`}
                  variant="success"
                />
                {blockingRules.length > 0 && (
                  <Pill
                    icon={AlertTriangle}
                    label={`${blockingRules.length} blokkerer`}
                    variant="warning"
                  />
                )}
              </div>
              <ul className="space-y-1.5">
                {activeWorkingRules.map((r) => (
                  <li key={r.code} className="flex items-center justify-between text-sm">
                    <span className="text-foreground text-xs">{r.name}</span>
                    <span className="text-muted-foreground font-mono text-xs">
                      {r.threshold_value}
                      {r.code.startsWith("W0") && r.code <= "W02" ? " t" : " t"}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </SectionCard>

        {/* ── Break rules card ──────────────────────────────────── */}
        <SectionCard
          icon={Coffee}
          title="Pauseregler"
          description="Obligatoriske pauser basert på varighet eller tidspunkt."
          href="/dashboard/settings?tab=break-rules"
          isLoading={loadingBreakRules}
        >
          {loadingBreakRules ? (
            <SkeletonLines count={3} />
          ) : activeBreakRules.length === 0 ? (
            <EmptyState message="Ingen pauseregler konfigurert. Legg til regler i Pauseregler-fanen." />
          ) : (
            <>
              <div className="mb-3">
                <Pill
                  icon={CheckCircle2}
                  label={`${activeBreakRules.length} aktive`}
                  variant="success"
                />
              </div>
              <ul className="space-y-1.5">
                {activeBreakRules.slice(0, 5).map((r, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="text-foreground truncate text-xs">{r.name}</span>
                    <span className="text-muted-foreground ml-2 shrink-0 font-mono text-xs">
                      {r.duration_minutes} min
                    </span>
                  </li>
                ))}
                {activeBreakRules.length > 5 && (
                  <li className="text-muted-foreground/60 text-xs">
                    +{activeBreakRules.length - 5} til
                  </li>
                )}
              </ul>
            </>
          )}
        </SectionCard>
      </div>
    </>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Sub-components                                                   */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

type SectionCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
  isLoading: boolean;
  children: React.ReactNode;
};

function SectionCard({
  icon: Icon,
  title,
  description,
  href,
  isLoading,
  children,
}: SectionCardProps) {
  return (
    <div className="bg-card border-border flex flex-col rounded-xl border p-5">
      {/* Card header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="bg-muted mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
            <Icon className="text-muted-foreground h-4 w-4" />
          </div>
          <div>
            <h2 className="text-foreground text-sm font-semibold">{title}</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
          </div>
        </div>
        {!isLoading && (
          <Link
            href={href}
            className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            aria-label={`Rediger ${title}`}
          >
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* Card body */}
      <div className="flex-1">{children}</div>
    </div>
  );
}

function SkeletonLines({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-muted h-4 animate-pulse rounded"
          style={{ width: `${60 + (i % 3) * 15}%` }}
        />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-muted-foreground text-xs leading-relaxed">{message}</p>;
}

type PillProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  variant: "success" | "warning";
};

function Pill({ icon: Icon, label, variant }: PillProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        variant === "success"
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      ].join(" ")}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
