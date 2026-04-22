import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { supabase as serviceClient } from "../helpers/seed";

/**
 * helpdesk-rls-jwt-insert-blocked.spec.ts — Supervisor F4 regression guard
 *
 * The channel_jwt_insert policy (20260515135959_channel_progressive_flags.sql:95)
 * was narrowed to prevent JWT users from creating channels with
 * helpdesk_enabled=true unless they are workspace admin. Without this guard
 * a non-admin could self-create a rogue helpdesk and foist themselves as rep.
 *
 * Test matrix:
 *   - Non-admin JWT INSERT of helpdesk_enabled=true → must fail (RLS).
 *   - Admin JWT INSERT of helpdesk_enabled=true → must succeed (control).
 *
 * We exercise the RLS boundary directly via anon-key sign-in rather than
 * going through the UI, because the server action path uses service role
 * and would mask the JWT-level guard.
 *
 * REGRESSION GUARD for Supervisor F4 narrowed channel_jwt_insert policy.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";

/**
 * Resolves the Supabase Local anon JWT. Prefers SUPABASE_ANON_KEY env var
 * when set; otherwise falls back to `supabase status -o env`. Local stack
 * exposes `ANON_KEY` deterministically when started with the default
 * JWT_SECRET, so this bootstrap is stable across dev machines.
 */
function resolveAnonKey(): string {
  if (process.env.SUPABASE_ANON_KEY) return process.env.SUPABASE_ANON_KEY;

  try {
    const output = execSync("npx supabase status -o env", {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const match = output.match(/^ANON_KEY="([^"]+)"$/m);
    if (match?.[1]) return match[1];
  } catch {
    // Fall through — the test will throw below with a clear message.
  }

  throw new Error(
    "SUPABASE_ANON_KEY is required for the RLS boundary test. " +
      "Set the env var or ensure `npx supabase status` can resolve it.",
  );
}

test.describe.configure({ mode: "serial", timeout: 60_000 });

test.describe("security:jwt-helpdesk-insert-rls", () => {
  const seededChannelIds: string[] = [];

  test.afterEach(async () => {
    for (const channelId of seededChannelIds) {
      await serviceClient.from("channel_member").delete().eq("channel_id", channelId);
      await serviceClient.from("channel").delete().eq("id", channelId);
    }
    seededChannelIds.length = 0;
  });

  test("non-admin JWT INSERT of helpdesk_enabled=true is blocked by RLS", async () => {
    const anonKey = resolveAnonKey();
    const workspaceId = "b0000000-0000-0000-0000-000000000000";

    // --- Resolve a non-admin user in the fixture workspace.
    const { data: nonAdminProfile, error: nonAdminErr } = await serviceClient
      .from("profile")
      .select("profile_id, user_id")
      .eq("workspace_id", workspaceId)
      .eq("role", "employee")
      .eq("is_active", true)
      .limit(1)
      .single();
    if (nonAdminErr || !nonAdminProfile) {
      throw new Error(`RLS test requires a non-admin profile: ${nonAdminErr?.message}`);
    }

    const { data: userRow } = await serviceClient.auth.admin.getUserById(nonAdminProfile.user_id);
    const nonAdminEmail = userRow?.user?.email;
    if (!nonAdminEmail) throw new Error("Non-admin user has no email.");

    // --- Act: sign in as non-admin over anon key and attempt a direct INSERT.
    const anonClient = createClient(SUPABASE_URL, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInErr } = await anonClient.auth.signInWithPassword({
      email: nonAdminEmail,
      password: process.env.E2E_EMPLOYEE_PASSWORD ?? "password123",
    });
    if (signInErr) throw new Error(`Non-admin sign-in failed: ${signInErr.message}`);

    const { data: rogueRow, error: rogueInsertErr } = await anonClient
      .from("channel")
      .insert({
        workspace_id: workspaceId,
        channel_type: "custom",
        name: `ROGUE helpdesk via JWT ${Date.now()}`,
        helpdesk_enabled: true,
        privacy_mode: "public",
        responsible_profile_id: nonAdminProfile.profile_id,
      })
      .select("id")
      .maybeSingle();

    // Safety: if the insert somehow succeeded, register it for cleanup
    // so we never leak a rogue helpdesk even on a failing assertion.
    if (rogueRow?.id) seededChannelIds.push(rogueRow.id);

    // Expect failure — either RLS policy violation or CHECK refusal.
    // PostgREST returns a non-null error + the insert must not produce a row.
    expect(rogueInsertErr).not.toBeNull();
    expect(rogueRow).toBeNull();
  });

  test("admin JWT INSERT of helpdesk_enabled=true succeeds (control)", async () => {
    const anonKey = resolveAnonKey();
    const workspaceId = "b0000000-0000-0000-0000-000000000000";

    const { data: adminProfile, error: adminErr } = await serviceClient
      .from("profile")
      .select("profile_id, user_id")
      .eq("workspace_id", workspaceId)
      .in("role", ["admin", "owner"])
      .eq("is_active", true)
      .limit(1)
      .single();
    if (adminErr || !adminProfile) {
      throw new Error(`RLS control requires an admin profile: ${adminErr?.message}`);
    }

    const { data: adminUserRow } = await serviceClient.auth.admin.getUserById(adminProfile.user_id);
    const adminEmail = adminUserRow?.user?.email;
    if (!adminEmail) throw new Error("Admin user has no email.");

    const adminClient = createClient(SUPABASE_URL, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInErr } = await adminClient.auth.signInWithPassword({
      email: adminEmail,
      password: process.env.E2E_PASSWORD ?? "password123",
    });
    if (signInErr) throw new Error(`Admin sign-in failed: ${signInErr.message}`);

    const { data: controlRow, error: controlErr } = await adminClient
      .from("channel")
      .insert({
        workspace_id: workspaceId,
        channel_type: "custom",
        name: `CONTROL helpdesk via admin JWT ${Date.now()}`,
        helpdesk_enabled: true,
        privacy_mode: "public",
        responsible_profile_id: adminProfile.profile_id,
      })
      .select("id")
      .single();

    if (controlRow?.id) seededChannelIds.push(controlRow.id);

    expect(controlErr).toBeNull();
    expect(controlRow?.id).toBeTruthy();
  });
});
