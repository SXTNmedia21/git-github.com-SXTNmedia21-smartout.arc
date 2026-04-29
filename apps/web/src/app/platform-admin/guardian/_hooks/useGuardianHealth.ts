"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { guardianKeys } from "./guardian-keys";

export type HealthDomain = "readiness" | "workspace_maturity" | "agent_behavior";

export type HealthSummary = {
  overall: "healthy" | "warning" | "critical";
  totalSignals: number;
  critical: number;
  warning: number;
  info: number;
  domains: Record<string, { critical: number; warning: number; info: number }>;
};

export function useGuardianHealth() {
  return useQuery({
    queryKey: guardianKeys.health(),
    queryFn: async (): Promise<HealthSummary> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("guardian_signal")
        .select("domain, severity")
        .eq("status", "active");

      if (error) throw error;
      if (!data || data.length === 0) {
        return {
          overall: "healthy",
          totalSignals: 0,
          critical: 0,
          warning: 0,
          info: 0,
          domains: {},
        };
      }

      const domains: Record<string, { critical: number; warning: number; info: number }> = {};
      let critical = 0;
      let warning = 0;
      let info = 0;

      for (const signal of data) {
        const d = signal.domain;
        if (!domains[d]) domains[d] = { critical: 0, warning: 0, info: 0 };

        if (signal.severity === "critical") {
          critical++;
          domains[d].critical++;
        } else if (signal.severity === "warning") {
          warning++;
          domains[d].warning++;
        } else {
          info++;
          domains[d].info++;
        }
      }

      const overall = critical > 0 ? "critical" : warning > 0 ? "warning" : "healthy";

      return {
        overall: overall as HealthSummary["overall"],
        totalSignals: data.length,
        critical,
        warning,
        info,
        domains,
      };
    },
    refetchInterval: 90_000,
    refetchIntervalInBackground: false,
  });
}
