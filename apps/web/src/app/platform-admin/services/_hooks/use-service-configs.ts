"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@smartout/supabase";

export type ServiceConfigRow =
  Database["public"]["Tables"]["service_config"]["Row"];

const QUERY_KEY = ["platform-admin", "services", "config"];

export function useServiceConfigs() {
  return useQuery<ServiceConfigRow[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/platform-admin/services/config");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data as ServiceConfigRow[];
    },
    staleTime: 30_000,
  });
}

export function useServiceConfig(slug: string) {
  return useQuery<ServiceConfigRow>({
    queryKey: [...QUERY_KEY, slug],
    queryFn: async () => {
      const res = await fetch(`/api/platform-admin/services/config/${slug}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data as ServiceConfigRow;
    },
    staleTime: 30_000,
  });
}

export function useUpdateServiceConfig(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<ServiceConfigRow>) => {
      const res = await fetch(`/api/platform-admin/services/config/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()).data as ServiceConfigRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useRestartService(slug: string) {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/platform-admin/services/config/${slug}/restart`,
        { method: "POST" },
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
  });
}

export function useDeleteService(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/platform-admin/services/config/${slug}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
