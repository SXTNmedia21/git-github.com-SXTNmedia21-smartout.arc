"use client";

import { useQuery } from "@tanstack/react-query";
import type { ServicesHealthResponse } from "@/app/api/platform-admin/services/health/route";

export function useServiceHealth(enabled: boolean) {
  return useQuery<ServicesHealthResponse>({
    queryKey: ["platform-admin", "services", "health"],
    queryFn: async () => {
      const res = await fetch("/api/platform-admin/services/health");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<ServicesHealthResponse>;
    },
    refetchInterval: enabled ? 30_000 : false,
    refetchOnWindowFocus: false,
    refetchIntervalInBackground: false,
    staleTime: 10_000,
  });
}
