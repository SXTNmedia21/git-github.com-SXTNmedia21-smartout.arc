"use server";

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";

// loadIntegrationSyncHistory — Server Action for SyncHistoryPanel.
// Reads the last 20 engine_state rows on process_id='integration_sync'
// for a given integration_id. The panel only needs a flat projection,
// so we collapse context.* into top-level fields for the client.
//
// Placeholder hint: context.integration_type === 'placeholder' OR the
// engine_state.result carries a `skipped: 'integration_disabled'` note.
// For Fase 2 we derive is_placeholder_hint by reading the underlying
// billing_integration row's is_placeholder flag ONCE, not per-row.

const InputSchema = z.object({
  integration_id: z.string().uuid(),
});

type SyncRow = {
  state_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  last_error: string | null;
  is_placeholder_hint: boolean;
  entity_type_synced: string | null;
  entity_id_synced: string | null;
  operation: string | null;
};

export type LoadIntegrationSyncHistoryResult =
  | { ok: true; rows: SyncRow[] }
  | { ok: false; error: string };

export async function loadIntegrationSyncHistory(
  rawInput: unknown,
): Promise<LoadIntegrationSyncHistoryResult> {
  const adminId = await getSuperAdminId();
  if (!adminId) return { ok: false, error: "unauthorized" };

  const parsed = InputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid_input",
    };
  }

  const supabase = createAdminClient();

  // Resolve placeholder hint once (single row lookup).
  const { data: integration } = await supabase
    .from("billing_integration")
    .select("is_placeholder")
    .eq("integration_id", parsed.data.integration_id)
    .maybeSingle();

  const placeholderHint = integration?.is_placeholder === true;

  // Postgres doesn't let us index into JSON on the column filter with
  // the generated helper; use a jsonb containment filter.
  const { data, error } = await supabase
    .from("engine_state")
    .select("id, status, started_at, completed_at, last_error, context")
    .eq("process_id", "integration_sync")
    .contains("context", { integration_id: parsed.data.integration_id })
    .order("started_at", { ascending: false })
    .limit(20);

  if (error) return { ok: false, error: error.message };

  const rows: SyncRow[] = (data ?? []).map((row) => {
    const ctx = (row.context ?? {}) as Record<string, unknown>;
    return {
      state_id: row.id,
      status: row.status,
      started_at: row.started_at,
      completed_at: row.completed_at,
      last_error: row.last_error,
      is_placeholder_hint: placeholderHint,
      entity_type_synced: (ctx.entity_type as string | undefined) ?? null,
      entity_id_synced: (ctx.entity_id_synced as string | undefined) ?? null,
      operation: (ctx.operation as string | undefined) ?? null,
    };
  });

  return { ok: true, rows };
}
