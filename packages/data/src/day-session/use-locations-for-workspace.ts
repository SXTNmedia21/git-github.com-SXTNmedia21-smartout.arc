"use client";

/**
 * use-locations-for-workspace.ts
 *
 * TanStack Query hook that fetches all location rows for a given workspace.
 * Used by LocationSwitcherPill to populate the Område filter.
 *
 * Mobile-parity: lives in packages/data so apps/mobile can share the same
 * query layer without duplicating the PostgREST call (ADR-0133 / ADR-0134).
 *
 * Sort order: name ASC (locale "nb").
 * staleTime: 60 s — locations change infrequently during a session.
 *
 * L-0177: workspaceId empty → throw immediately. No silent fallback.
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";

export type LocationRow = {
  location_id: string;
  workspace_id: string;
  name: string;
  slug: string;
};

/** Stable query-key factory for location hooks. */
export const locationKeys = {
  all: ["location"] as const,
  forWorkspace: (workspaceId: string) => ["location", "workspace", workspaceId] as const,
};

type RawRow = {
  location_id: string;
  workspace_id: string;
  name: string;
  slug: string;
};

async function fetchLocationsForWorkspace(workspaceId: string): Promise<LocationRow[]> {
  // L-0177: fail fast — never silently fall through to wrong workspace
  if (!workspaceId) throw new Error("useLocationsForWorkspace: workspaceId required");

  const supabase = createClient();

  const { data, error } = await supabase
    .from("location")
    .select("location_id, workspace_id, name, slug")
    .eq("workspace_id", workspaceId)
    .order("name");

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as RawRow[]).sort((a, b) => a.name.localeCompare(b.name, "nb"));
}

/**
 * Returns all locations for the given workspace.
 *
 * - Enabled only when workspaceId is non-empty.
 * - 60 s staleTime — locations rarely change within a session.
 * - L-0177: queryFn throws on empty workspaceId — enabled guard prevents
 *   the call, but the throw is a second line of defence.
 */
export function useLocationsForWorkspace(workspaceId: string) {
  return useQuery({
    queryKey: locationKeys.forWorkspace(workspaceId),
    queryFn: () => fetchLocationsForWorkspace(workspaceId),
    enabled: workspaceId.length > 0,
    staleTime: 60_000,
  });
}
