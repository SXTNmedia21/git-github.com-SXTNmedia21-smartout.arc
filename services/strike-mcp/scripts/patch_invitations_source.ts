#!/usr/bin/env tsx
/**
 * Council fix 2026-04-16 (Steward C1) — invitations.json missing
 * constant_columns.source = 'bubble_migration'.
 *
 * `public.invitation` IS in the ADR-0108 source-tagged 12-table list. With
 * known_empty_source=true (0 Wrightegaarden rows) this is benign TODAY, but
 * the mapping file is the long-lived contract: if any row is ever added in
 * a future workspace migration, the M7 DEFAULT lands them as
 * 'operational' and reconciliation triggers fire on imported data.
 *
 * Usage: STRIKE_WORKSPACE_SLUG=wrightegaarden pnpm tsx scripts/patch_invitations_source.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { appendDecision } from "../src/history/decision_log.js";
import type { Mapping } from "../src/research/mapping.js";

const WORKSPACE = process.env.STRIKE_WORKSPACE_SLUG;
if (!WORKSPACE) { console.error("STRIKE_WORKSPACE_SLUG required"); process.exit(1); }

const REPO = join(import.meta.dirname, "..");
const HISTORY = process.env.STRIKE_HISTORY_DIR ?? join(REPO, "history");

(async () => {
  const path = join(REPO, "mappings", "invitations.json");
  const m = JSON.parse(await readFile(path, "utf-8")) as Mapping;
  m.constant_columns = { ...(m.constant_columns ?? {}), source: "bubble_migration" };
  m.known_quirks = [
    ...(m.known_quirks ?? []),
    "constant_columns.source='bubble_migration' added 2026-04-16 per council Steward C1: public.invitation IS in ADR-0108 source-tagged list. With 0 rows today this is dormant, but the mapping is the long-lived contract.",
  ];
  m.last_verified = new Date().toISOString();
  await writeFile(path, JSON.stringify(m, null, 2) + "\n", "utf-8");

  await appendDecision(HISTORY, {
    scope: "schema", workspace: WORKSPACE!, entity: "invitations",
    action: "field_approved", target: "source",
    transform: `constant "bubble_migration"`,
    by: "pontus", reasoning: "Council 2026-04-16 Steward C1 fix: ADR-0108 source-tagged table requires explicit override of M7 DEFAULT 'operational'.",
  });

  console.log("invitations: source='bubble_migration' constant added.");
})().catch((e) => { console.error(e); process.exit(1); });
