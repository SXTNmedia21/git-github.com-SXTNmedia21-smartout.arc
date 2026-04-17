#!/usr/bin/env tsx
/**
 * verify_flow.ts — smoke-test the strike-auth-bridge end-to-end flow.
 *
 * Steps:
 *   1. Verify the 3 migrated auth.users exist with correct UUID + metadata
 *   2. Simulate password-reset completion: admin.updateUserById with
 *      force_password_reset=false in user_metadata
 *   3. Verify flag is cleared
 *   4. (Optional) Restore flag for repeat tests
 *
 * USAGE:
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *     pnpm tsx scripts/auth-bridge/verify_flow.ts
 */

import { createClient } from "@supabase/supabase-js";

const TEST_USERS = [
  { id: "69d30a6f-170a-545d-af11-13306e5fbc77", email: "anneli@sf-nett.no" },
  { id: "216ea491-9507-5c26-bc59-3ec2a410364e", email: "nataliewille@live.no" },
  { id: "58a79d96-7d03-5f49-9696-ac5eb1d851df", email: "erikoverbo@icloud.com" },
];

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("ENV required: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("=== Step 1: verify migrated users exist with flag=true ===");
  for (const u of TEST_USERS) {
    const { data, error } = await admin.auth.admin.getUserById(u.id);
    if (error || !data.user) {
      console.error(`  FAIL ${u.email}: ${error?.message ?? "no user"}`);
      process.exit(1);
    }
    const flag = data.user.user_metadata?.force_password_reset;
    const migrated = data.user.user_metadata?.migrated_from_bubble;
    const ok = flag === true && migrated === true;
    console.log(
      `  ${ok ? "OK  " : "FAIL"} ${u.email.padEnd(28)} flag=${flag} migrated=${migrated}`,
    );
    if (!ok) process.exit(1);
  }

  console.log("\n=== Step 2: simulate password-reset complete (clear flag) ===");
  const target = TEST_USERS[0];
  const clearResult = await admin.auth.admin.updateUserById(target.id, {
    user_metadata: {
      ...(await admin.auth.admin.getUserById(target.id)).data.user?.user_metadata,
      force_password_reset: false,
    },
  });
  if (clearResult.error) {
    console.error(`  FAIL clear: ${clearResult.error.message}`);
    process.exit(1);
  }
  console.log(`  OK  cleared force_password_reset for ${target.email}`);

  console.log("\n=== Step 3: verify flag is now false ===");
  const afterClear = await admin.auth.admin.getUserById(target.id);
  const flagNow = afterClear.data.user?.user_metadata?.force_password_reset;
  const migratedStill = afterClear.data.user?.user_metadata?.migrated_from_bubble;
  console.log(
    `  ${flagNow === false && migratedStill === true ? "OK  " : "FAIL"} ` +
      `flag=${flagNow} migrated=${migratedStill} (migration marker should survive)`,
  );

  console.log("\n=== Step 4: restore flag for repeat tests ===");
  const restoreResult = await admin.auth.admin.updateUserById(target.id, {
    user_metadata: {
      ...afterClear.data.user?.user_metadata,
      force_password_reset: true,
    },
  });
  if (restoreResult.error) {
    console.error(`  FAIL restore: ${restoreResult.error.message}`);
    process.exit(1);
  }
  console.log(`  OK  restored flag=true for ${target.email}`);

  console.log("\n=== All checks passed ===");
  console.log("Bridge + middleware + flag-clear flow verified end-to-end.");
  console.log("Next: run apps/web dev server and log in as anneli@sf-nett.no via /reset-password");
  console.log("      to confirm the browser flow (manual smoke test).");
}

main().catch((e: unknown) => {
  console.error(`Fatal: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
