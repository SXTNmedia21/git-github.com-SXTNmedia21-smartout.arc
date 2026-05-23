// packages/ai/src/resolver/index.ts
// Resolver wrapper for bulk_import fuzzy-match RPC. ADR-0401.
import type { SupabaseClient } from "@supabase/supabase-js";

export type EntityType = "profile" | "department" | "location";

export type FuzzyMatch = {
  matched_id: string;
  matched_name: string;
  confidence: number;
};

export type ResolveEntityArgs = {
  client: SupabaseClient;
  type: EntityType;
  raw_name: string;
  workspace_id: string;
  threshold?: number; // 0..1, default 0.9
};

export async function resolveEntity(args: ResolveEntityArgs): Promise<FuzzyMatch[]> {
  const { client, type, raw_name, workspace_id, threshold = 0.9 } = args;
  const { data, error } = await client.rpc("fn_fuzzy_match_entity", {
    p_workspace_id: workspace_id,
    p_entity_type: type,
    p_raw_name: raw_name,
    p_threshold: threshold,
  });
  if (error) {
    // Fail-fast per L-0177 — no silent fallback to empty array on RPC failure.
    throw new Error(`resolveEntity(${type}): ${error.message}`);
  }
  return (data ?? []) as FuzzyMatch[];
}
