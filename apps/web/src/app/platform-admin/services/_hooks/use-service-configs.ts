"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { emit, nonEmpty } from "@smartout/telemetry";
// TODO: Remove manual type once service_config migration is applied and types regenerated
export type ServiceConfigRow = {
  service_id: string;
  slug: string;
  name: string;
  type: string;
  description: string | null;
  host_url: string | null;
  health_endpoint: string | null;
  docker_service_name: string | null;
  docker_image: string | null;
  vercel_project_id: string | null;
  config: Record<string, unknown>;
  env_schema: Array<{ key: string; required: boolean; change_type: string; description: string }>;
  vault_secrets: string[];
  port: number | null;
  tags: string[];
  is_critical: boolean;
  status: string;
  created_at: string;
  updated_at: string;
};

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
    onSuccess: (data, updates) => {
      void emit({
        event: "service_config updated",
        workspace_id: null,
        actor_id: nonEmpty("", "actor_id"),
        properties: {
          entity: {
            entity_type: "service_config",
            entity_id: data.service_id,
            entity_label: data.name,
          },
          data: { slug, fields: Object.keys(updates) },
        },
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useRestartService(slug: string) {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/platform-admin/services/config/${slug}/restart`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      void emit({
        event: "service_config restarted",
        workspace_id: null,
        actor_id: nonEmpty("", "actor_id"),
        properties: {
          entity: { entity_type: "service_config", entity_id: slug, entity_label: slug },
          data: { slug },
        },
      });
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
      void emit({
        event: "service_config deleted",
        workspace_id: null,
        actor_id: nonEmpty("", "actor_id"),
        properties: {
          entity: { entity_type: "service_config", entity_id: slug, entity_label: slug },
          data: { slug },
        },
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
