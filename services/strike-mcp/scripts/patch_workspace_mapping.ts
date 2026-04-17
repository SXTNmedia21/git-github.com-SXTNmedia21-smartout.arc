#!/usr/bin/env tsx
/**
 * One-shot patch for mappings/workspace.json.
 *
 * Per Option B of council 2026-04-16 rollback plan:
 * - Assigns target_table + field targets using ONLY registered transforms
 *   (see src/migration/transforms.ts — fk_uuid, bubble_date_to_tstz, trim)
 * - Emits decision log entries for each decision (preserves ADR-0003 audit trail)
 * - Defers status + slogan (require enum/array-coerce transforms not yet
 *   registered; workspace.status has DEFAULT, slogan is optional)
 *
 * Usage: STRIKE_WORKSPACE_SLUG=wrightegaarden pnpm tsx scripts/patch_workspace_mapping.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { appendDecision } from "../src/history/decision_log.js";
import type { Mapping } from "../src/research/mapping.js";

const WORKSPACE = process.env.STRIKE_WORKSPACE_SLUG;
if (!WORKSPACE) {
  console.error("STRIKE_WORKSPACE_SLUG required");
  process.exit(1);
}

const REPO = join(import.meta.dirname, "..");
const MAPPING_PATH = join(REPO, "mappings", "workspace.json");
const HISTORY_DIR = process.env.STRIKE_HISTORY_DIR ?? join(REPO, "history");

type FieldPatch = {
  field: string;
  target: string;
  transform: string | null;
  reasoning: string;
};

const APPROVALS: FieldPatch[] = [
  { field: "_id",              target: "workspace_id",   transform: "fk_uuid:workspace", reasoning: "Bubble _id → deterministic v5 UUID keyed on entity=workspace" },
  { field: "🏰 Company",       target: "company_id",     transform: "fk_uuid:company",   reasoning: "FK to company; fk_uuid keyed on entity=company to match the separate company migration" },
  { field: "Titel",            target: "name",           transform: "trim",              reasoning: "Bubble Titel is the workspace display name; trim guards against stray whitespace" },
  { field: "brandColor",       target: "brand_color",    transform: null,                reasoning: "Direct rename — same semantic, different casing" },
  { field: "Default_language", target: "language",       transform: null,                reasoning: "Direct mapping — preferred_language enum values align with Bubble language codes" },
  { field: "round_logo",       target: "logo_url",       transform: null,                reasoning: "round_logo holds the primary logo URL; rectangle_logo is a sparse variant and dropped" },
  { field: "adress",           target: "address_line_1", transform: "trim",              reasoning: "Bubble misspelling 'adress' maps to v3 address_line_1; single-line address" },
  { field: "phoneNumber",      target: "phone",          transform: "trim",              reasoning: "Direct rename — trim strips formatting whitespace" },
  { field: "Created Date",     target: "created_at",     transform: "bubble_date_to_tstz", reasoning: "Preserve Bubble creation timestamp rather than Postgres DEFAULT now()" },
  { field: "Modified Date",    target: "updated_at",     transform: "bubble_date_to_tstz", reasoning: "Preserve Bubble modification timestamp" },
];

const DEFERRALS: { field: string; reasoning: string }[] = [
  { field: "status",        reasoning: "workspace_status enum coercion transform not registered; v3 column has DEFAULT so safe to defer until ADR-0004 registers enum coercion" },
  { field: "🏳️‍🌈 slogan", reasoning: "array→text coercion transform not registered; slogan is optional cosmetic text, defer until array_first transform is registered" },
];

const DROPS: { field: string; reasoning: string }[] = [
  { field: "ID", reasoning: "Bubble-internal sequential counter; no v3 equivalent — use _id UUID as the identity source" },
];

async function main(): Promise<void> {
  const raw = await readFile(MAPPING_PATH, "utf-8");
  const mapping = JSON.parse(raw) as Mapping;

  mapping.target_table = "public.workspace";

  await appendDecision(HISTORY_DIR, {
    scope: "schema",
    workspace: WORKSPACE!,
    entity: "workspace",
    action: "target_table_set",
    target: "public.workspace",
    by: "pontus",
    reasoning: "Council 2026-04-16 Option B rollback — direct target assignment with audit entries",
  });

  let approved = 0;
  for (const p of APPROVALS) {
    const entry = mapping.field_map[p.field];
    if (!entry) { console.error(`WARN: field not found: ${p.field}`); continue; }
    entry.target = p.target;
    entry.transform = p.transform;
    entry.needs_review = false;
    await appendDecision(HISTORY_DIR, {
      scope: "schema",
      workspace: WORKSPACE!,
      entity: "workspace",
      action: "field_approved",
      field: p.field,
      target: p.target,
      transform: p.transform,
      by: "pontus",
      reasoning: p.reasoning,
    });
    approved++;
  }

  let deferred = 0;
  for (const d of DEFERRALS) {
    const entry = mapping.field_map[d.field];
    if (!entry) { console.error(`WARN: field not found: ${d.field}`); continue; }
    entry.target = null;
    entry.transform = null;
    entry.needs_review = true;
    await appendDecision(HISTORY_DIR, {
      scope: "schema",
      workspace: WORKSPACE!,
      entity: "workspace",
      action: "field_review_deferred",
      field: d.field,
      by: "pontus",
      reasoning: d.reasoning,
    });
    deferred++;
  }

  let dropped = 0;
  for (const d of DROPS) {
    const entry = mapping.field_map[d.field];
    if (!entry) { console.error(`WARN: field not found: ${d.field}`); continue; }
    entry.target = null;
    entry.transform = null;
    entry.needs_review = false;
    await appendDecision(HISTORY_DIR, {
      scope: "schema",
      workspace: WORKSPACE!,
      entity: "workspace",
      action: "field_dropped",
      field: d.field,
      by: "pontus",
      reasoning: d.reasoning,
    });
    dropped++;
  }

  mapping.last_verified = new Date().toISOString();
  mapping.known_quirks = [
    "slug column derived at SQL-emit time via slugify(Titel); no Bubble source field.",
    "source column has DEFAULT 'operational' in M7; engine MUST override to 'bubble_migration' for this migration (ADR-0108).",
    "status + slogan deferred pending enum/array-coerce transforms (future ADR-0004 strike-mcp).",
  ];

  await writeFile(MAPPING_PATH, JSON.stringify(mapping, null, 2) + "\n", "utf-8");
  console.log(`Patched workspace mapping: ${approved} approved, ${deferred} deferred, ${dropped} dropped.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
