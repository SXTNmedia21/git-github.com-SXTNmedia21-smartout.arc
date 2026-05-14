#!/usr/bin/env tsx
/**
 * check-rls-with-check.ts — ADR-0303 sister-table sweep rule enforcement.
 *
 * Scans supabase/migrations/*.sql for CREATE POLICY statements on
 * workspace-scoped tables and rejects any policy that uses `FOR ALL`
 * (or `FOR INSERT` / `FOR UPDATE`) without a matching `WITH CHECK`
 * clause. This is the load-bearing CI guard that turns ADR-0303 from
 * a written rule into an enforced one.
 *
 * Why this exists:
 * F-DB-12 (audit 2026-05-13-adr-contract-validation-02) caught
 * `staff_event` + `staff_event_attendee` shipping with `FOR ALL
 * USING(...)` no-WITH-CHECK policies on the same day ADR-0303
 * was proposed. The rule was written but not enforced; this script
 * closes that gap so the same class of finding cannot regress
 * silently between audit cycles.
 *
 * The fault shape:
 *   CREATE POLICY foo ON workspace_scoped_table
 *     FOR ALL USING (workspace_id IN (...))   -- no WITH CHECK
 *
 * A manager who belongs to two workspaces can flip `workspace_id`
 * on UPDATE (or attach `workspace_id` on INSERT) to a workspace
 * they also manage, because the USING clause permits the row but
 * nothing constrains the AFTER state. Symmetric `WITH CHECK` is
 * the fix (per ADR-0298 + ADR-0299).
 *
 * Heuristic:
 *   - Workspace-scoped tables: explicit allow-list maintained below
 *     (extracted from grep of `workspace_id` column refs across
 *     supabase/migrations/ — start narrow, expand as new D2/D4/D6
 *     tables ship).
 *   - For each CREATE POLICY on a listed table, parse the FOR clause:
 *       FOR ALL    → MUST have WITH CHECK
 *       FOR INSERT → MUST have WITH CHECK (USING is ignored on INSERT)
 *       FOR UPDATE → MUST have WITH CHECK
 *       FOR SELECT → exempt (no write)
 *       FOR DELETE → exempt (USING-only is correct)
 *   - Allow override via comment on the line immediately preceding
 *     `CREATE POLICY`:
 *       -- @rls-exempt: ADR-NNNN reason
 *
 * Exit:
 *   0 — all policies clean
 *   1 — one or more offending policies; lists each with filename +
 *       line number + table + policy name + suggested fix pointing
 *       at the A.2 canonical pattern.
 *
 * Run:
 *   npx tsx scripts/check-rls-with-check.ts
 *
 * canonical pattern: supabase/migrations/20260608120000_sortie_a2_d6_rls_with_check.sql
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Workspace-scoped table allow-list.
//
// These are the tables this script polices. A policy on any of these
// using `FOR ALL` / `FOR INSERT` / `FOR UPDATE` without `WITH CHECK`
// fails the gate. Expand as new workspace-scoped tables ship.
//
// Source: grep `workspace_id` column refs in supabase/migrations/ +
// cascade ontology (ADR-0298) D1–D6 tables. Start narrow on the
// highest-mutation surfaces (D6) and broaden as audits flag gaps.
// ─────────────────────────────────────────────────────────────────────────────

const WORKSPACE_SCOPED_TABLES = new Set<string>([
  // D6 governance / production (highest-risk mutation surface)
  "schedule_shift",
  "schedule_absence",
  "shift_approval",
  "department_session",
  "session_hook",
  "session_task",
  "deviation",
  "personal_task",
  "emma_task",
  "schedule_day_task",
  // D2 resource
  "profile",
  "employment_contract",
  "employee_payroll_profile",
  // staff-event (F-DB-12 origin)
  "staff_event",
  "staff_event_attendee",
  // additional workspace-scoped surfaces
  "department",
  "department_operating_hours",
  "department_hours_override",
  "planning_cycle",
  "team",
  "policy",
  "protocol",
]);

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

type Offense = {
  file: string;
  line: number;
  table: string;
  policyName: string;
  forClause: string;
  reason: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Parse: walk SQL line-by-line. When we hit `CREATE POLICY`, accumulate
// statement lines until the terminating `;`. Then inspect:
//   - target table (matches our allow-list?)
//   - FOR clause
//   - WITH CHECK presence
//   - immediately-preceding `-- @rls-exempt` annotation
// ─────────────────────────────────────────────────────────────────────────────

function parseFile(filePath: string): Offense[] {
  const text = readFileSync(filePath, "utf8");
  const lines = text.split("\n");
  const offenses: Offense[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match `CREATE POLICY "name" ON schema.table` or `CREATE POLICY name ON table`.
    const createPolicyMatch = line.match(
      /^\s*CREATE\s+POLICY\s+"?([^"\s]+)"?\s+ON\s+(?:[\w_]+\.)?([\w_]+)/i,
    );
    if (!createPolicyMatch) continue;

    const policyName = createPolicyMatch[1];
    const tableName = createPolicyMatch[2];
    const startLine = i + 1;

    // Only police workspace-scoped tables.
    if (!WORKSPACE_SCOPED_TABLES.has(tableName)) continue;

    // Check for `-- @rls-exempt:` annotation on the immediately
    // preceding non-blank line (allows DROP POLICY IF EXISTS between
    // exempt-comment and CREATE POLICY in canonical patterns).
    let exemptReason: string | null = null;
    for (let back = i - 1; back >= 0 && back >= i - 3; back--) {
      const prev = lines[back].trim();
      if (prev === "" || /^DROP\s+POLICY/i.test(prev)) continue;
      const exemptMatch = prev.match(/^--\s*@rls-exempt:\s*(.+)$/);
      if (exemptMatch) exemptReason = exemptMatch[1];
      break;
    }
    if (exemptReason) continue;

    // Accumulate statement until terminating `;`.
    const stmtLines: string[] = [line];
    let j = i;
    while (j < lines.length && !stmtLines.join("\n").includes(";")) {
      j++;
      if (j < lines.length) stmtLines.push(lines[j]);
    }
    const stmt = stmtLines.join("\n");

    // Find FOR clause. Match `FOR ALL`, `FOR INSERT`, `FOR UPDATE`,
    // `FOR SELECT`, `FOR DELETE`. Default to `FOR ALL` if absent
    // (Postgres default).
    const forMatch = stmt.match(/\bFOR\s+(ALL|INSERT|UPDATE|SELECT|DELETE)\b/i);
    const forClause = forMatch ? forMatch[1].toUpperCase() : "ALL";

    // SELECT and DELETE legitimately have no WITH CHECK; skip.
    if (forClause === "SELECT" || forClause === "DELETE") continue;

    // WITH CHECK present?
    const hasWithCheck = /\bWITH\s+CHECK\b/i.test(stmt);
    if (hasWithCheck) continue;

    // Offense.
    offenses.push({
      file: filePath,
      line: startLine,
      table: tableName,
      policyName,
      forClause,
      reason: `FOR ${forClause} without WITH CHECK on workspace-scoped table`,
    });
  }

  return offenses;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * File-selection strategy:
 *   - Default (CI mode): only files added since GIT_BASE_REF
 *     (mirrors .github/scripts/migration-lint.sh L-0042 pattern).
 *     This avoids flagging historical legacy migrations that have
 *     already been corrected by later DROP POLICY + CREATE POLICY
 *     sequences (e.g. Sortie A / A.2 sweeps).
 *   - `--all` flag: scan every migration file (used for manual
 *     baseline audits or when expanding the workspace-scoped
 *     table allow-list).
 */
function selectFiles(): string[] {
  const allFiles = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => join(MIGRATIONS_DIR, f))
    .sort();

  const scanAll = process.argv.includes("--all");
  if (scanAll) return allFiles;

  // CI mode: diff against base ref. If git/base ref unavailable
  // (e.g. shallow clone without fetch), fall back to scanning all.
  const baseRef = process.env.GIT_BASE_REF ?? "origin/development";
  try {
    const out = execSync(
      `git diff --name-only --diff-filter=A ${baseRef}...HEAD -- 'supabase/migrations/*.sql'`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    const newFiles = out
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((rel) => join(process.cwd(), rel))
      .filter((abs) => existsSync(abs));

    if (newFiles.length === 0) {
      console.log(`[check-rls-with-check] no new migrations vs ${baseRef} — nothing to check.`);
      return [];
    }
    return newFiles;
  } catch {
    console.warn(`[check-rls-with-check] could not diff vs ${baseRef}; falling back to full scan.`);
    return allFiles;
  }
}

function main(): void {
  const files = selectFiles();
  if (files.length === 0) {
    process.exit(0);
  }

  const allOffenses: Offense[] = [];
  for (const file of files) {
    allOffenses.push(...parseFile(file));
  }

  if (allOffenses.length === 0) {
    console.log(`[check-rls-with-check] OK — scanned ${files.length} migrations, 0 offenses.`);
    process.exit(0);
  }

  console.error(
    `[check-rls-with-check] FAIL — ${allOffenses.length} policy/policies violate ADR-0303 (FOR ALL / FOR INSERT / FOR UPDATE without WITH CHECK on workspace-scoped table):\n`,
  );

  for (const o of allOffenses) {
    const rel = o.file.replace(`${process.cwd()}/`, "");
    console.error(`  ✗ ${rel}:${o.line}`);
    console.error(`      policy: "${o.policyName}" on ${o.table}`);
    console.error(`      reason: ${o.reason}\n`);
  }

  console.error(
    "Fix: convert FOR ALL into per-verb policies (INSERT/UPDATE/DELETE) and add\n" +
      "symmetric `USING + WITH CHECK` on UPDATE, `WITH CHECK` on INSERT.\n" +
      "Canonical pattern: supabase/migrations/20260608120000_sortie_a2_d6_rls_with_check.sql\n" +
      "Rule: docs/decisions/0303-sister-table-sweep-rule.md\n" +
      "\n" +
      "If the policy is intentionally exempt (e.g. service_role-only, read-only\n" +
      "internal table, or sweep deferred to follow-up sortie), annotate the line\n" +
      "above CREATE POLICY with:\n" +
      "  -- @rls-exempt: ADR-NNNN <reason>\n",
  );

  process.exit(1);
}

main();
