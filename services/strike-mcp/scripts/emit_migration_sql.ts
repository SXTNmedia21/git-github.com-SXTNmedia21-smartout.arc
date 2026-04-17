#!/usr/bin/env tsx
/**
 * Tier 1 migration SQL emitter.
 *
 * Reads attested mappings, fetches Bubble records for the target workspace,
 * runs the migration engine, and writes ordered SQL files to
 * supabase/migration-staging/.
 *
 * Apply order (FK-safe):
 *   01_workspace.sql
 *   02_company.sql
 *   03_employee_type.sql
 *   04_location.sql
 *   05_department.sql
 *   06_team.sql
 *   07_user_identity.sql              (BLOCKED on strike-auth-bridge — flag in header)
 *   08_profile.sql
 *   09_schedule_shift.sql
 *   10_payroll_ledger_archive.sql
 *   90_employment_contracts_synthesis.sql  (manual, copied from scripts/sql/)
 *   91_records_aggregation.sql              (manual, copied from scripts/sql/)
 *
 * Skipped (known_empty_source=true OR target_table=null):
 *   invitations, shift_satellites, swaprecords
 *
 * Usage:
 *   STRIKE_WORKSPACE_SLUG=wrightegaarden \
 *   BUBBLE_APP_URL=... BUBBLE_API_TOKEN=... \
 *     pnpm tsx scripts/emit_migration_sql.ts [--limit=N] [--only=entity1,entity2]
 *
 * Flags:
 *   --limit=N    Cap rows fetched per entity (smoke testing without 17k payroll fetches)
 *   --only=...   Comma-separated entity names; emit only these (for incremental dev)
 *   --dry-bubble Skip Bubble fetch; emit empty SQL files (smoke test the orchestrator alone)
 */
import { mkdir, writeFile, readFile, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { loadConfig } from "../src/config.js";
import { BubbleClient } from "../src/bubble/client.js";
import { ENTITY_REGISTRY, getEntityByName } from "../src/entities.js";
import { loadMapping } from "../src/research/mapping.js";
import { runEngine } from "../src/migration/engine.js";
import { emitSql } from "../src/migration/sql_emitter.js";
import { strikeUuid } from "../src/migration/uuid.js";
import { workspaceBubbleId } from "../src/workspace_constants.js";

const WORKSPACE = process.env.STRIKE_WORKSPACE_SLUG;
if (!WORKSPACE) { console.error("STRIKE_WORKSPACE_SLUG required"); process.exit(1); }

const REPO = join(import.meta.dirname, "..");
const STAGING = join(REPO, "supabase", "migration-staging");

type Args = { limit: number | null; only: string[] | null; dryBubble: boolean };
function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const limit = argv.find((a) => a.startsWith("--limit="))?.split("=")[1];
  const only = argv.find((a) => a.startsWith("--only="))?.split("=")[1];
  return {
    limit: limit ? parseInt(limit, 10) : null,
    only: only ? only.split(",").map((s) => s.trim()) : null,
    dryBubble: argv.includes("--dry-bubble"),
  };
}

// Apply order. Tied to FK topology of the v3 schema and the auth-bridge gate.
const EMIT_ORDER = [
  { entity: "workspace",            file: "01_workspace.sql" },
  { entity: "company",              file: "02_company.sql" },
  { entity: "employee_types",       file: "03_employee_type.sql" },
  { entity: "locations",            file: "04_location.sql" },
  { entity: "departments",          file: "05_department.sql" },
  { entity: "teams",                file: "06_team.sql" },
  { entity: "users",                file: "07_user_identity.sql", authBridgeGated: true },
  { entity: "profiles",             file: "08_profile.sql" },
  { entity: "shifts",               file: "09_schedule_shift.sql" },
  { entity: "salary_transactions",  file: "10_payroll_ledger_archive.sql" },
];

const MANUAL_SQL = [
  { src: "scripts/sql/employment_contracts_synthesis.sql", dst: "90_employment_contracts_synthesis.sql" },
  { src: "scripts/sql/records_aggregation.sql",            dst: "91_records_aggregation.sql" },
];

async function emitOne(
  client: BubbleClient | null,
  entityName: string,
  outFile: string,
  workspaceUuid: string,
  workspaceSlug: string,
  args: Args,
  authBridgeGated = false,
): Promise<{ rows: number; skipped: number; warnings: string[] }> {
  const mapping = await loadMapping(join(REPO, "mappings"), entityName);
  if (!mapping) throw new Error(`mapping ${entityName} not found`);
  if (mapping.target_table === null) {
    console.log(`  skip ${entityName} — target_table=null (drop)`);
    return { rows: 0, skipped: 0, warnings: [] };
  }
  if (mapping.known_empty_source) {
    console.log(`  skip ${entityName} — known_empty_source=true`);
    return { rows: 0, skipped: 0, warnings: [] };
  }

  const entity = getEntityByName(entityName);
  if (!entity) throw new Error(`entity ${entityName} not in registry`);

  let records: any[] = [];
  if (!args.dryBubble && client) {
    const constraints = entity.workspaceFieldKey
      ? [{ key: entity.workspaceFieldKey, constraint_type: "equals" as const, value: workspaceBubbleId(workspaceSlug) }]
      : entityName === "workspace"
        ? [{ key: "_id", constraint_type: "equals" as const, value: workspaceBubbleId(workspaceSlug) }]
        : [];
    records = await client.listAll(entity.bubbleType, {
      constraints,
      maxRecords: args.limit ?? undefined,
      pageSize: 100,
    });
    console.log(`  fetched ${records.length} ${entityName} from Bubble`);
  } else {
    console.log(`  dry-bubble: skipping fetch for ${entityName}`);
  }

  const result = runEngine(mapping, records, {
    workspaceId: workspaceUuid,
    workspaceSlug,
    mapping,
    companyId: null,
  });

  const headerExtra = authBridgeGated
    ? "-- ⚠ APPLY-BLOCKED until strike-auth-bridge package pre-creates auth.users entries.\n-- See ADR-0006 strike-mcp + smartout.ai migration runbook.\n"
    : "";

  const sql = emitSql(result.rows, {
    entity: entityName,
    workspaceId: workspaceUuid,
    workspaceSlug,
    generatedAt: new Date().toISOString(),
  });

  await writeFile(join(STAGING, outFile), headerExtra + sql, "utf-8");
  console.log(`  wrote ${outFile} (${result.rows.length} rows, ${result.skipped.length} skipped, ${result.warnings.length} warnings)`);
  return { rows: result.rows.length, skipped: result.skipped.length, warnings: result.warnings };
}

// workspaceBubbleId imported from src/workspace_constants.ts — add new
// tenants there, not here. Used as constraint value when fetching the
// workspace itself (no 🏰 Workspace self-reference) and as the resolved
// value to compare against entity.workspaceFieldKey for child entities
// (Bubble constraint API takes the literal workspace _id string).

async function main(): Promise<void> {
  const args = parseArgs();

  await mkdir(STAGING, { recursive: true });

  const config = !args.dryBubble ? loadConfig(process.env) : null;
  const client = config ? new BubbleClient(config) : null;

  const workspaceUuid = strikeUuid("workspace", workspaceBubbleId(WORKSPACE!));
  console.log(`emit_migration_sql: workspace=${WORKSPACE} workspace_uuid=${workspaceUuid}`);
  console.log(`staging dir: ${STAGING}`);
  if (args.dryBubble) console.log("MODE: --dry-bubble (no Bubble fetch; orchestrator smoke test)");
  if (args.limit) console.log(`MODE: --limit=${args.limit} (capped fetch per entity)`);
  if (args.only) console.log(`MODE: --only=${args.only.join(",")}`);
  console.log();

  const summary: Array<{ entity: string; rows: number; skipped: number }> = [];
  for (const step of EMIT_ORDER) {
    if (args.only && !args.only.includes(step.entity)) {
      console.log(`= ${step.entity}: SKIPPED (--only filter)`);
      continue;
    }
    console.log(`= ${step.entity} → ${step.file}`);
    const result = await emitOne(
      client,
      step.entity,
      step.file,
      workspaceUuid,
      WORKSPACE!,
      args,
      step.authBridgeGated,
    );
    summary.push({ entity: step.entity, rows: result.rows, skipped: result.skipped });
  }

  // Copy manual SQL files into staging so the apply step has everything in one dir.
  console.log();
  for (const m of MANUAL_SQL) {
    const src = join(REPO, m.src);
    const dst = join(STAGING, m.dst);
    await copyFile(src, dst);
    console.log(`= manual: copied ${m.src} → ${m.dst}`);
  }

  // Manifest for the apply script.
  const manifest = {
    workspace_slug: WORKSPACE,
    workspace_uuid: workspaceUuid,
    generated_at: new Date().toISOString(),
    apply_order: [
      ...EMIT_ORDER.map((s) => ({
        file: s.file,
        entity: s.entity,
        rows: summary.find((r) => r.entity === s.entity)?.rows ?? 0,
        auth_bridge_gated: s.authBridgeGated ?? false,
      })),
      ...MANUAL_SQL.map((m) => ({ file: m.dst, manual: true })),
    ],
    pre_apply_checklist: [
      "Verify wt-3 v3 schema migrations are applied to target Postgres (npx supabase db reset from wt-3)",
      "If 07_user_identity.sql is in apply_order: run strike-auth-bridge package first to pre-create auth.users entries",
      "For 91_records_aggregation.sql: load bubble_record_staging table from operator's Bubble CSV export (see file header)",
    ],
  };
  await writeFile(join(STAGING, "MANIFEST.json"), JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  console.log(`= wrote MANIFEST.json`);

  console.log();
  console.log("Summary:");
  for (const r of summary) console.log(`  ${r.entity.padEnd(25)} rows=${r.rows.toString().padStart(6)} skipped=${r.skipped}`);
  console.log();
  console.log("Apply order: cd supabase/migration-staging && for f in *.sql; do echo \"-- $f\"; psql ... -f $f; done");
  console.log("Or apply MANIFEST.json-driven via your apply tool.");
}

main().catch((e) => { console.error(e); process.exit(1); });
