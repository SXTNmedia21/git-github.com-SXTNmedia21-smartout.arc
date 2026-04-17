"use client";

import { useMemo } from "react";
import { useGovernanceOverview } from "@/app/dashboard/_hooks/use-governance-overview";

type Domain = "all" | "haccp" | "safety" | "hr" | "operational";

export function useGovernanceFiltered(domain: Domain = "all") {
  const { data: protocols, isLoading, error } = useGovernanceOverview();

  const filtered = useMemo(() => {
    if (!protocols || domain === "all") return protocols ?? [];
    const domainTypes: Record<Exclude<Domain, "all">, string[]> = {
      haccp: ["haccp"],
      safety: ["haccp", "safety"],
      hr: ["hr"],
      operational: ["operational"],
    };
    const types = domainTypes[domain];
    return protocols.filter((p) => types.includes(p.policyType));
  }, [protocols, domain]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const overdue = filtered.filter((p) => p.expiredCount > 0).length;
    const avgCompletion =
      total > 0 ? Math.round(filtered.reduce((s, p) => s + p.completionPercent, 0) / total) : 0;
    const notStarted = filtered.reduce((s, p) => s + (p.notStartedCount ?? 0), 0);
    const inProgress = filtered.reduce((s, p) => s + (p.inProgressCount ?? 0), 0);
    const waived = filtered.reduce((s, p) => s + (p.waivedCount ?? 0), 0);
    return { total, overdue, avgCompletion, notStarted, inProgress, waived };
  }, [filtered]);

  return { protocols: filtered, stats, isLoading, error };
}
