#!/usr/bin/env tsx
/**
 * strike-auth-bridge — pre-creates auth.users for strike-mcp Tier 1 migration.
 *
 * WHY THIS EXISTS:
 *   strike-mcp emits `INSERT INTO public.user_identity (user_id, ...)` with
 *   deterministic uuidv5 IDs. `user_identity.user_id` is PK+FK to auth.users(id).
 *   Raw SQL cannot safely insert into auth.users (Supabase Auth owns password
 *   hashing, identity rows, confirmation timestamps). This script bridges:
 *   reads the Tier 1 SQL, extracts the user list, calls Supabase Admin API
 *   to create each auth.users entry with the SAME UUID strike-mcp assigned,
 *   then the Tier 1 SQL FKs resolve cleanly at apply time.
 *
 * FLOW:
 *   1. Parse 07_user_identity.sql → extract {user_id, email, first_name, last_name, phone}
 *   2. For each user: supabase.auth.admin.createUser({...}) with
 *      user_metadata.force_password_reset = true
 *   3. On success: generate recovery link via auth.admin.generateLink (type='recovery')
 *   4. Write audit CSV with {email, user_id, status, recovery_link_or_error}
 *   5. Halt on email-collision (same email, different UUID in auth.users)
 *
 * USAGE:
 *   op run --env-file=.env.template -- \
 *     pnpm tsx scripts/strike-auth-bridge/apply.ts \
 *       --sql=../strike-mcp/supabase/migration-staging/07_user_identity.sql \
 *       [--dry-run] \
 *       [--audit-dir=./scripts/strike-auth-bridge/.audit]
 *
 * REQUIRED ENV (via 1Password):
 *   NEXT_PUBLIC_SUPABASE_URL   — target project URL (local or cloud)
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (secret)
 *
 * SAFETY:
 *   - DRY-RUN by default if no --apply flag
 *   - Idempotent: if auth.users(id)=same UUID exists, skips (logs "already_exists")
 *   - Halts on email collision (same email, DIFFERENT UUID) — requires manual resolution
 *   - Never stores plaintext passwords. Random 64-char password set per user,
 *     discarded. User recovers via the generated recovery link.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

// ─── Argument parsing ─────────────────────────────────────────────────────

interface Args {
  sqlPath: string;
  apply: boolean;
  auditDir: string;
}

function parseArgs(argv: string[]): Args {
  let sqlPath = "";
  let apply = false;
  let auditDir = resolve(
    process.cwd(),
    "scripts/strike-auth-bridge/.audit",
  );

  for (const arg of argv) {
    if (arg.startsWith("--sql=")) sqlPath = resolve(arg.slice("--sql=".length));
    else if (arg === "--apply") apply = true;
    else if (arg === "--dry-run") apply = false;
    else if (arg.startsWith("--audit-dir=")) auditDir = resolve(arg.slice("--audit-dir=".length));
  }

  if (!sqlPath) {
    console.error(
      "ERROR: --sql=<path to 07_user_identity.sql> is required.\n" +
        "Example:\n" +
        "  pnpm tsx scripts/strike-auth-bridge/apply.ts \\\n" +
        "    --sql=../strike-mcp/supabase/migration-staging/07_user_identity.sql",
    );
    process.exit(1);
  }

  return { sqlPath, apply, auditDir };
}

// ─── SQL parsing ──────────────────────────────────────────────────────────

interface UserRow {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
}

/**
 * Parses the strike-mcp-emitted 07_user_identity.sql and extracts user rows.
 *
 * Expected INSERT shape (emitted by strike-mcp sql_emitter.ts):
 *   INSERT INTO public.user_identity (email, user_id, first_name, phone, updated_at, created_at, last_name) VALUES ('...', '...', ...);
 *
 * Column order varies per emission. We key by column name, not position.
 * Values are `'<escaped>'` (single-quoted, with `''` doubling for literal quotes).
 */
function parseUserIdentitySql(sql: string): UserRow[] {
  const rows: UserRow[] = [];
  // Match: INSERT INTO public.user_identity (cols) VALUES (vals);
  const re =
    /INSERT\s+INTO\s+public\.user_identity\s*\(([^)]+)\)\s*VALUES\s*\(([\s\S]*?)\)\s*(?:ON\s+CONFLICT[^;]*)?;/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const colSpec = m[1];
    const valSpec = m[2];
    const cols = colSpec.split(",").map((c) => c.trim());
    const vals = splitSqlValues(valSpec);
    if (cols.length !== vals.length) {
      throw new Error(
        `Column/value count mismatch in INSERT at offset ${m.index}: ${cols.length} cols, ${vals.length} vals`,
      );
    }
    const record: Record<string, string | null> = {};
    for (let i = 0; i < cols.length; i++) {
      record[cols[i]] = parseSqlLiteral(vals[i]);
    }
    const required = ["user_id", "email", "first_name", "last_name"];
    for (const r of required) {
      if (!record[r]) {
        throw new Error(`Missing or NULL required column "${r}" in row: ${JSON.stringify(record)}`);
      }
    }
    rows.push({
      user_id: record.user_id!,
      email: record.email!,
      first_name: record.first_name!,
      last_name: record.last_name!,
      phone: record.phone ?? null,
    });
  }
  return rows;
}

/**
 * Splits a VALUES clause into individual value tokens, respecting quoted
 * strings (which may contain commas). Assumes strike-mcp's escaping
 * (`''` for literal quotes within strings).
 */
function splitSqlValues(valSpec: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inString = false;
  for (let i = 0; i < valSpec.length; i++) {
    const c = valSpec[i];
    if (c === "'" && valSpec[i + 1] === "'" && inString) {
      // Escaped quote — include both chars, stay in string
      buf += "''";
      i += 1;
      continue;
    }
    if (c === "'") {
      inString = !inString;
      buf += c;
      continue;
    }
    if (c === "," && !inString) {
      out.push(buf.trim());
      buf = "";
      continue;
    }
    buf += c;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/**
 * Parses a single SQL literal. Returns string value (un-escaped) for quoted
 * strings, or null for NULL. Numeric/boolean values are returned as strings;
 * this bridge only cares about text columns.
 */
function parseSqlLiteral(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.toUpperCase() === "NULL") return null;
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed; // numeric/boolean/unknown
}

// ─── Audit CSV ────────────────────────────────────────────────────────────

interface AuditEntry {
  email: string;
  user_id: string;
  status: "created" | "already_exists" | "collision" | "error";
  recovery_link: string;
  error_message: string;
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(entries: AuditEntry[]): string {
  const header = "email,user_id,status,recovery_link,error_message";
  const lines = entries.map((e) =>
    [e.email, e.user_id, e.status, e.recovery_link, e.error_message]
      .map(escapeCsv)
      .join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}

// ─── Admin API orchestration ──────────────────────────────────────────────

function randomPassword(): string {
  // 48 bytes = 64 base64url chars. High entropy; never stored.
  return randomBytes(48).toString("base64url");
}

async function ensureAuthUser(
  admin: SupabaseClient,
  row: UserRow,
): Promise<AuditEntry> {
  const existingById = await admin.auth.admin.getUserById(row.user_id);
  if (existingById.data?.user) {
    const existingEmail = existingById.data.user.email;
    if (existingEmail?.toLowerCase() !== row.email.toLowerCase()) {
      return {
        email: row.email,
        user_id: row.user_id,
        status: "collision",
        recovery_link: "",
        error_message: `UUID exists but with different email: ${existingEmail}`,
      };
    }
    const link = await generateRecoveryLink(admin, row.email);
    return {
      email: row.email,
      user_id: row.user_id,
      status: "already_exists",
      recovery_link: link.url,
      error_message: link.error,
    };
  }

  const byEmail = await findAuthUserByEmail(admin, row.email);
  if (byEmail && byEmail.id !== row.user_id) {
    return {
      email: row.email,
      user_id: row.user_id,
      status: "collision",
      recovery_link: "",
      error_message: `Email exists in auth.users with different UUID ${byEmail.id}`,
    };
  }

  const createResult = await admin.auth.admin.createUser({
    // `id` forces the auth.users.id to our deterministic uuidv5 so the FK
    // from public.user_identity.user_id resolves. Supported in @supabase/supabase-js
    // v2.38+ per docs.
    id: row.user_id,
    email: row.email,
    password: randomPassword(),
    email_confirm: true,
    user_metadata: {
      first_name: row.first_name,
      last_name: row.last_name,
      phone: row.phone,
      migrated_from_bubble: true,
      force_password_reset: true,
      bridge_source: "strike-mcp-tier1",
    },
  } as Parameters<typeof admin.auth.admin.createUser>[0]);

  if (createResult.error || !createResult.data.user) {
    return {
      email: row.email,
      user_id: row.user_id,
      status: "error",
      recovery_link: "",
      error_message: createResult.error?.message ?? "createUser returned no user",
    };
  }

  // Verify Supabase actually honored our id request (not all versions do)
  if (createResult.data.user.id !== row.user_id) {
    return {
      email: row.email,
      user_id: row.user_id,
      status: "error",
      recovery_link: "",
      error_message: `Supabase assigned UUID ${createResult.data.user.id}, not requested ${row.user_id}. Upgrade @supabase/supabase-js to >=2.38.`,
    };
  }

  const link = await generateRecoveryLink(admin, row.email);
  return {
    email: row.email,
    user_id: row.user_id,
    status: "created",
    recovery_link: link.url,
    error_message: link.error,
  };
}

async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<{ id: string; email: string } | null> {
  // Supabase admin.listUsers paginates at 50 per page. Small tenants fit in
  // one page; for larger migrations, iterate.
  let page = 1;
  while (true) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 50 });
    if (result.error) throw new Error(`listUsers failed: ${result.error.message}`);
    const users = result.data.users as Array<{ id: string; email?: string | null }>;
    const hit = users.find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (hit) return { id: hit.id, email: hit.email ?? "" };
    if (users.length < 50) return null;
    page += 1;
    if (page > 200) {
      throw new Error("findAuthUserByEmail: safety cutoff at 10k users");
    }
  }
}

async function generateRecoveryLink(
  admin: SupabaseClient,
  email: string,
): Promise<{ url: string; error: string }> {
  // 'recovery' type generates a password-reset link. User clicks → lands on
  //   /reset-password which detects the auth token and switches to "update
  //   password" mode (see apps/web/src/app/reset-password/page.tsx).
  const result = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  if (result.error) return { url: "", error: `generateLink failed: ${result.error.message}` };
  return {
    url: result.data.properties?.action_link ?? "",
    error: "",
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  console.log("strike-auth-bridge");
  console.log(`  sql:        ${args.sqlPath}`);
  console.log(`  mode:       ${args.apply ? "APPLY (live calls to admin API)" : "DRY-RUN (parse only)"}`);
  console.log(`  audit_dir:  ${args.auditDir}`);
  console.log();

  if (!existsSync(args.sqlPath)) {
    console.error(`Fatal: SQL file not found: ${args.sqlPath}`);
    process.exit(1);
  }

  const sql = await readFile(args.sqlPath, "utf-8");
  const rows = parseUserIdentitySql(sql);
  console.log(`Parsed ${rows.length} user_identity INSERTs.`);
  if (rows.length === 0) {
    console.error("Fatal: no user rows parsed. Check the SQL file format.");
    process.exit(1);
  }
  for (const r of rows) {
    console.log(`  ${r.email.padEnd(30)} ${r.user_id}  ${r.first_name} ${r.last_name}`);
  }

  if (!args.apply) {
    console.log("\nDRY-RUN complete. Re-run with --apply to call admin API.");
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Fatal: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars required for --apply.",
    );
    process.exit(1);
  }
  console.log(`\nConnecting to ${supabaseUrl}...`);
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const audit: AuditEntry[] = [];
  for (const row of rows) {
    process.stdout.write(`  ${row.email.padEnd(30)} ... `);
    try {
      const entry = await ensureAuthUser(admin, row);
      audit.push(entry);
      console.log(entry.status + (entry.error_message ? ` (${entry.error_message})` : ""));
      // Halt on collision — requires human resolution. Emit partial audit.
      if (entry.status === "collision") {
        console.error(`\nHALT: email collision detected. Resolve manually before continuing.`);
        break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      audit.push({
        email: row.email,
        user_id: row.user_id,
        status: "error",
        recovery_link: "",
        error_message: msg,
      });
      console.log(`error (${msg})`);
    }
  }

  // Emit audit CSV
  await mkdir(args.auditDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const csvPath = join(args.auditDir, `bridge-audit-${stamp}.csv`);
  await writeFile(csvPath, toCsv(audit), "utf-8");

  const summary = {
    created: audit.filter((a) => a.status === "created").length,
    already_exists: audit.filter((a) => a.status === "already_exists").length,
    collision: audit.filter((a) => a.status === "collision").length,
    error: audit.filter((a) => a.status === "error").length,
  };
  console.log();
  console.log("Summary:");
  console.log(`  created:        ${summary.created}`);
  console.log(`  already_exists: ${summary.already_exists}`);
  console.log(`  collision:      ${summary.collision}`);
  console.log(`  error:          ${summary.error}`);
  console.log();
  console.log(`Audit CSV:  ${csvPath}`);
  console.log("\nNEXT STEPS:");
  console.log("  1. Review the audit CSV");
  console.log("  2. Distribute recovery links to users (email/Tripletex/etc.)");
  console.log("  3. If no collisions, Tier 1 07_user_identity.sql is now safe to apply");
  console.log("  4. Users who don't act on the recovery link can reset via /reset-password");

  if (summary.collision > 0 || summary.error > 0) {
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\nFatal: ${msg}`);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
