// ============================================
// recorder-seed-ensure.ts
//
// Idempotent re-seed of the 5 recorder C4 authority rows the recorder E2E
// suite requires. Called from Playwright globalSetup before any recorder
// spec runs.
//
// Why this exists:
//   Migration 20260515120400_recorder_authority_seed.sql seeds these rows
//   from workspace+profile data. On a fresh Supabase Local boot, that
//   migration runs BEFORE supabase/seed.sql creates workspace/profile
//   rows — so the seed migration selects from an empty table and inserts
//   zero rows (captured in HANDOFF as a known issue). Supabase CLI does
//   not run post-seed hook migrations; we run this helper ourselves.
//
// This module is safe to run many times: ON CONFLICT DO NOTHING means
// the second run is a no-op.
// ============================================

import { createClient } from "@supabase/supabase-js";

const RECORDER_CAPABILITIES = [
  { capability: "recorder.flag", level: "suggest" },
  { capability: "recorder.whisper", level: "confirm" },
  { capability: "recorder.force_stop", level: "confirm" },
  { capability: "recorder.pii_reveal", level: "disabled" },
  { capability: "recorder.break_glass_enable", level: "disabled" },
] as const;

export async function ensureRecorderAuthoritySeed(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "ensureRecorderAuthoritySeed: SUPABASE_SERVICE_ROLE_KEY not set — " +
        "cannot seed recorder authority.",
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Pull every active workspace. Seed the 5 recorder capability rows for
  // each. Avoid the SQL-migration join because we can't rely on every
  // workspace having an admin/owner profile in the same RLS pass
  // (the migration depends on profile data that may not exist yet).
  const { data: workspaces, error: wsErr } = await admin
    .from("workspace")
    .select("workspace_id")
    .eq("is_active", true);
  if (wsErr) {
    throw new Error(`ensureRecorderAuthoritySeed: list workspaces failed: ${wsErr.message}`);
  }
  if (!workspaces || workspaces.length === 0) {
    // No workspaces yet; nothing to seed. Return quietly — the whisper
    // spec's own HQ_WORKSPACE_ID check will fail loudly.
    return;
  }

  const rows: Array<{
    workspace_id: string;
    capability: string;
    level: string;
  }> = [];
  for (const ws of workspaces) {
    for (const cap of RECORDER_CAPABILITIES) {
      rows.push({
        workspace_id: ws.workspace_id,
        capability: cap.capability,
        level: cap.level,
      });
    }
  }

  const { error: upsertErr } = await admin
    .from("engine_authority_config")
    .upsert(rows, { onConflict: "workspace_id,capability", ignoreDuplicates: true });
  if (upsertErr) {
    throw new Error(`ensureRecorderAuthoritySeed: upsert failed: ${upsertErr.message}`);
  }
}
