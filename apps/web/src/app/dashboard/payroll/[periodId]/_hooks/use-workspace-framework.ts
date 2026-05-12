/**
 * use-workspace-framework — fetch the active regulatory framework for a workspace.
 *
 * Why: Fix 1 (Bokføringsloven §13 audit) — the drawer header must stamp which
 *      tariff version was in force during the period. Until ADR-0252 migration
 *      ships a framework_snapshot_id on payroll.period, we look up the live
 *      binding from workspace_framework_binding → regulatory_framework.
 *
 *      When period is locked (locked_at IS NOT NULL) the label says "frosset"
 *      at the lock timestamp so Erik (regnskapsfører) knows the tariff was
 *      captured at lock time. When open, it says "gyldig fra <activated_at>".
 *
 * ADR-0252: proposed — framework_snapshot_id on period deferred.
 *            When it ships, replace this hook with a snapshot-aware variant.
 *
 * Scope: read-only, anon client (RLS workspace-scoped).
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

type FrameworkInfo = {
  name: string;
  version: string;
  activatedAt: string;
};

async function fetchActiveFramework(workspaceId: string): Promise<FrameworkInfo | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("workspace_framework_binding")
    .select("activated_at, regulatory_framework!inner(name, version)")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;

  const fw = data.regulatory_framework as { name: string; version: string } | null;
  if (!fw) return null;

  return {
    name: fw.name,
    version: fw.version,
    activatedAt: data.activated_at,
  };
}

/**
 * Build the human-readable tariff label for the drawer header.
 *
 * Open period:   "Riksavtalen 2026 v1.0 (gyldig fra 01. apr. 2026)"
 * Locked period: "Riksavtalen 2026 v1.0 (frosset 07. mai 2026 — periode låst)"
 * No binding:    null → caller renders fallback
 */
export function buildFrameworkLabel(fw: FrameworkInfo, periodLockedAt: string | null): string {
  const activatedDate = format(new Date(fw.activatedAt), "d. MMM yyyy", { locale: nb });
  const versionSuffix = fw.version ? ` v${fw.version}` : "";
  const baseName = `${fw.name}${versionSuffix}`;

  if (periodLockedAt) {
    const lockedDate = format(new Date(periodLockedAt), "d. MMM yyyy", { locale: nb });
    return `${baseName} (frosset ${lockedDate} — periode låst)`;
  }
  return `${baseName} (gyldig fra ${activatedDate})`;
}

export function useWorkspaceFramework(workspaceId: string) {
  return useQuery<FrameworkInfo | null>({
    queryKey: ["workspace-framework", workspaceId],
    queryFn: () => fetchActiveFramework(workspaceId),
    staleTime: 5 * 60 * 1000, // 5 min — tariff changes rarely
    enabled: !!workspaceId,
  });
}
