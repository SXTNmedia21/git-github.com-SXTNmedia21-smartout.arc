#!/usr/bin/env tsx
/**
 * Tier 2 content extraction — handbook + handbook.challenge → v3 governance.
 *
 * APPROACH (per Pontus 2026-04-17 reframe):
 *   "Vi behøver ikke hente information table by table — vi henter kunnskapen
 *    fra workspacen og implementerer den i version 3."
 *
 * This is NOT a 1:1 schema mapper. It reads Wrightegaarden's content from
 * Bubble and emits v3-native governance rows.
 *
 * v1.5 SCOPE (this file):
 *   - Fetch handbooks for the workspace
 *   - Fetch challenges linked to those handbooks
 *   - Fetch ALL workspace activities; filter to LIVE (Published + Active 🚫=true)
 *   - Emit:
 *     - 1 bookkeeping policy per workspace
 *     - 1 "Onboarding handbooks" protocol per migrated handbook (Norwegian title)
 *     - 1 confirmation per linked challenge
 *     - 1 "Operational procedures" protocol per workspace
 *     - 1 procedure per live activity (deduplicated by stable uuid)
 *
 * DEFERRED to v2 (Tier 2B):
 *   - Activity hierarchy → procedure_step nesting (preserve children/parent tree)
 *   - Quizzes → knowledge_test (Q6 product decision pending)
 *   - handbook.stage decomposition
 *   - Routing live activities by `_activityType` to control_list / routine / etc.
 *     (currently all live activities → flat procedure rows)
 *
 * USAGE:
 *   STRIKE_WORKSPACE_SLUG=wrightegaarden \
 *     pnpm tsx scripts/tier2_extract.ts [--dry-bubble]
 *
 * OUTPUT:
 *   supabase/migration-staging-tier2/
 *     01_policy.sql
 *     02_protocol.sql
 *     03_confirmation.sql
 *     MANIFEST.json
 *
 * SAFETY: DRY-RUN ONLY. Inherits Tier 1 strike-auth-bridge gate.
 * See docs/superpowers/specs/2026-04-17-tier2-content-extraction.md.
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { loadConfig } from "../src/config.js";
import { BubbleClient } from "../src/bubble/client.js";
import { strikeUuid } from "../src/migration/uuid.js";
import type { BubbleRecord } from "../src/bubble/types.js";
import {
  workspaceBubbleId,
  bookkeeperBubbleProfileId,
} from "../src/workspace_constants.js";

const WORKSPACE_SLUG = process.env.STRIKE_WORKSPACE_SLUG;
if (!WORKSPACE_SLUG) {
  console.error("STRIKE_WORKSPACE_SLUG required");
  process.exit(1);
}

const REPO = join(import.meta.dirname, "..");
const STAGING = join(REPO, "supabase", "migration-staging-tier2");
const CACHE_DIR = join(REPO, "mappings", ".local", "tier2-cache");

// Workspace constants imported from src/workspace_constants.ts — add new
// tenants there, not here.

// ─── SQL emission helpers ─────────────────────────────────────────────────

function escapeString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function literal(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "string") return escapeString(value);
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  return escapeString(JSON.stringify(value));
}

interface ExtractedRow {
  table: string;
  cols: Record<string, unknown>;
}

/**
 * Primary-key column per target table, for `ON CONFLICT (pk) DO NOTHING`
 * idempotency. Must match the schema PK in 00003_governance_tables.sql.
 */
const PRIMARY_KEY: Record<string, string> = {
  policy: "policy_id",
  protocol: "protocol_id",
  procedure: "procedure_id",
  confirmation: "confirmation_id",
};

function emitRowSql(row: ExtractedRow): string {
  const cols = Object.keys(row.cols);
  const vals = cols.map((c) => literal(row.cols[c]));
  const pk = PRIMARY_KEY[row.table];
  const onConflict = pk ? ` ON CONFLICT (${pk}) DO NOTHING` : "";
  return `INSERT INTO public.${row.table} (${cols.join(", ")}) VALUES (${vals.join(", ")})${onConflict};`;
}

// ─── Bubble multilingual + field helpers ──────────────────────────────────

/**
 * Bubble multilingual fields use the format `§locale§text§locale§text...`
 * concatenated in arrays. Pick Norwegian (no_no) with English fallback.
 */
function pickNorwegian(
  multilingualArray: unknown,
  fallback: string | null = null,
): string | null {
  if (!Array.isArray(multilingualArray) || multilingualArray.length === 0) {
    return fallback;
  }
  const tryLocale = (locale: string): string | null => {
    for (const entry of multilingualArray) {
      if (typeof entry !== "string") continue;
      const re = new RegExp(`§${locale}§([\\s\\S]*?)(?=§\\w+_\\w+§|$)`);
      const m = entry.match(re);
      if (m && m[1].trim()) return m[1].trim();
    }
    return null;
  };
  return tryLocale("no_no") ?? tryLocale("en_us") ?? fallback;
}

function getStr(rec: BubbleRecord, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function truncate(s: string | null, max: number): string | null {
  if (s === null) return null;
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

// ─── Bubble fetching (with on-disk cache for re-runs) ─────────────────────

async function fetchOrCache(
  cacheKey: string,
  fetcher: () => Promise<BubbleRecord[]>,
): Promise<BubbleRecord[]> {
  await mkdir(CACHE_DIR, { recursive: true });
  const cachePath = join(CACHE_DIR, `${cacheKey}.json`);
  if (existsSync(cachePath)) {
    const raw = await readFile(cachePath, "utf-8");
    const cached = JSON.parse(raw) as BubbleRecord[];
    console.log(`  cache hit: ${cacheKey} (${cached.length} records)`);
    return cached;
  }
  const fresh = await fetcher();
  await writeFile(cachePath, JSON.stringify(fresh, null, 2), "utf-8");
  console.log(`  cached ${cacheKey} (${fresh.length} records)`);
  return fresh;
}

async function fetchHandbooks(client: BubbleClient, wsId: string): Promise<BubbleRecord[]> {
  return fetchOrCache("handbooks", () =>
    client.listAll("handbook", {
      constraints: [{ key: "workspace", constraint_type: "equals", value: wsId }],
      pageSize: 100,
    }),
  );
}

async function fetchChallenges(client: BubbleClient): Promise<BubbleRecord[]> {
  // handbook.challenge has no workspace link — fetch all 90 globally and filter.
  return fetchOrCache("handbook_challenges", () =>
    client.listAll("handbook.challenge", { pageSize: 100 }),
  );
}

async function fetchActivities(client: BubbleClient, wsId: string): Promise<BubbleRecord[]> {
  return fetchOrCache("activities", () =>
    client.listAll("activity", {
      constraints: [{ key: "workspace", constraint_type: "equals", value: wsId }],
      pageSize: 100,
    }),
  );
}

/**
 * Filter activities to LIVE: Published _Status AND Active 🚫 === true.
 * (Iron Rule 2: 🚫 marker means "marked for deletion in Bubble UI" — but value
 * `true` here is inverted by Bubble's UI: `Active 🚫: true` = NOT deleted.
 * Verified by data profiling 2026-04-17: 104/935 have value true, 683 false.)
 */
function filterLive(acts: BubbleRecord[]): BubbleRecord[] {
  return acts.filter((a) => {
    const r = a as Record<string, unknown>;
    if (r._Status !== "Published") return false;
    const active = r["Active 🚫"];
    return active === true || active === "true";
  });
}

// ─── Build v3 row plan ────────────────────────────────────────────────────

interface BuildResult {
  policies: ExtractedRow[];
  protocols: ExtractedRow[];
  procedures: ExtractedRow[];
  procedureSteps: ExtractedRow[];
  confirmations: ExtractedRow[];
  warnings: string[];
  stats: {
    handbooks: number;
    handbooksDraftSkipped: number;
    challengesLinked: number;
    challengesUnlinked: number;
    multilingualHandbooks: number;
    activitiesTotal: number;
    activitiesLive: number;
    proceduresEmitted: number;
    procedureStepsEmitted: number;
    activityTreeRoots: number;
    protocolsWithNullDescription: number;
    proceduresWithNullDescription: number;
  };
}

/**
 * Build one `policy` row for a given handbook/protocol pair. v3 schema
 * enforces `protocol UNIQUE (policy_id)` (00003_governance_tables.sql:56),
 * so policy:protocol is 1:1. Each migrated protocol gets its own policy
 * — a bookkeeping wrapper that stamps migration provenance.
 */
/**
 * Builds the provenance JSONB payload for a migrated row. Per ADR-0140
 * (smartout.ai-wt-2): governance tables use `provenance JSONB` with
 * origin ∈ {bubble-import, platform-seed, admin-ui, api, ai}. Strike-mcp
 * always emits `origin: 'bubble-import'` plus the source Bubble ID, migration
 * timestamp, tenant slug, and batch marker for audit/reverse-lookup.
 */
function makeProvenance(
  bubbleId: string,
  workspaceSlug: string,
  batchId: string,
): Record<string, unknown> {
  return {
    origin: "bubble-import",
    bubble_id: bubbleId,
    migrated_at: new Date().toISOString(),
    tenant: workspaceSlug,
    batch: batchId,
  };
}

function buildBookkeepingPolicy(
  policyId: string,
  workspaceUuid: string,
  createdByUuid: string,
  title: string,
  sourceBubbleId: string,
  workspaceSlug: string,
  batchId: string,
): ExtractedRow {
  return {
    table: "policy",
    cols: {
      policy_id: policyId,
      workspace_id: workspaceUuid,
      season_id: null,
      policy_type: "operational",
      policy_scope: "workspace",
      scope_ref_id: null,
      name: `[IMPORT] ${truncate(title, 180)}`,
      description:
        "Auto-generated bookkeeping policy paired 1:1 with a migrated protocol. " +
        "UNIQUE(policy_id) on protocol enforces pairing. Created by strike-mcp Tier 2.",
      statement:
        "Employees should complete the paired migrated protocol. Bookkeeping-only — " +
        "not an enforced business policy until reviewed.",
      enforcement_status: "aspirational",
      rules_json: null,
      valid_from: null,
      valid_to: null,
      priority: 0,
      is_active: true,
      created_by: createdByUuid,
      provenance: makeProvenance(sourceBubbleId, workspaceSlug, batchId),
    },
  };
}

function buildRows(
  handbooks: BubbleRecord[],
  challenges: BubbleRecord[],
  liveActivities: BubbleRecord[],
  totalActivities: number,
  workspaceUuid: string,
  workspaceSlug: string,
  createdByUuid: string,
  batchId: string,
): BuildResult {
  const warnings: string[] = [];
  let multilingualHandbooks = 0;
  let handbooksDraftSkipped = 0;

  const policies: ExtractedRow[] = [];
  const protocols: ExtractedRow[] = [];

  // Handbook draft filter (Steward Phase 3 finding): Bubble `_status = "Draft"`
  // handbooks are not published knowledge. Skip them at extraction — they can
  // be migrated individually later once the workspace reviews them.
  const publishedHandbooks = handbooks.filter((hb) => {
    const status = hb._status;
    if (typeof status === "string" && status.toLowerCase() === "draft") {
      handbooksDraftSkipped += 1;
      return false;
    }
    return true;
  });

  // 1) One policy + one protocol per published handbook (1:1, satisfies
  //    `protocol UNIQUE(policy_id)`).
  for (const hb of publishedHandbooks) {
    const hbId = hb._id as string;
    const protocolId = strikeUuid("tier2_protocol", hbId);
    const policyId = strikeUuid("tier2_policy", hbId);

    // Title: prefer flat `Title`, fall back to multilingual no_no, then en_us
    let title = getStr(hb, "Title");
    if (!title) {
      const fromI18n = pickNorwegian(hb["🏳️‍🌈 titles"]);
      if (fromI18n) {
        multilingualHandbooks += 1;
        title = fromI18n;
      }
    }
    if (!title) title = getStr(hb, "subTitle") ?? "Untitled handbook";
    title = truncate(title, 200) as string;

    // Description: prefer flat `description`, fall back to multilingual
    let description = getStr(hb, "description");
    if (!description) {
      description = pickNorwegian(hb["🏳️‍🌈 descriptions"]);
    }
    if (!description) {
      description = getStr(hb, "subTitle");
    }

    policies.push(
      buildBookkeepingPolicy(
        policyId,
        workspaceUuid,
        createdByUuid,
        title,
        hbId,
        workspaceSlug,
        batchId,
      ),
    );
    protocols.push({
      table: "protocol",
      cols: {
        protocol_id: protocolId,
        policy_id: policyId,
        workspace_id: workspaceUuid,
        // [IMPORT] prefix makes migrated content visually identifiable in
        // admin UI and supports a future `is_published=false` gate (Frontend
        // finding). Users should not see raw Bubble handbook titles until
        // curation.
        name: `[IMPORT] ${title}`,
        description: description,
        version: "1.0",
        status: "draft",
        owner_profile_id: createdByUuid,
        created_by: createdByUuid,
        provenance: makeProvenance(hbId, workspaceSlug, batchId),
      },
    });
  }

  // 3) Confirmations: one per challenge that links to a PUBLISHED handbook
  // (draft handbooks were filtered above; their challenges are orphaned).
  const handbookIdToProtocolId = new Map<string, string>();
  for (const hb of publishedHandbooks) {
    handbookIdToProtocolId.set(
      hb._id as string,
      strikeUuid("tier2_protocol", hb._id as string),
    );
  }

  const confirmations: ExtractedRow[] = [];
  let challengesLinked = 0;
  let challengesUnlinked = 0;

  for (const ch of challenges) {
    const hbId = ch.handbook;
    if (typeof hbId !== "string" || !handbookIdToProtocolId.has(hbId)) {
      challengesUnlinked += 1;
      continue;
    }
    challengesLinked += 1;
    const chId = ch._id as string;
    const confirmationId = strikeUuid("tier2_confirmation", chId);
    const protocolId = handbookIdToProtocolId.get(hbId)!;

    let chTitle = getStr(ch, "Title");
    if (!chTitle) chTitle = pickNorwegian(ch["🏳️‍🌈 titles"]);
    if (!chTitle) chTitle = "Untitled challenge";
    chTitle = truncate(chTitle, 200) as string;

    let chBody = getStr(ch, "description");
    if (!chBody) chBody = pickNorwegian(ch["🏳️‍🌈 descriptions"]);
    if (!chBody) chBody = chTitle;

    confirmations.push({
      table: "confirmation",
      cols: {
        confirmation_id: confirmationId,
        protocol_id: protocolId,
        name: chTitle,
        // Per ADR-0140 — provenance JSONB per row for reverse-lookup.
        provenance: makeProvenance(chId, workspaceSlug, batchId),
        confirmation_text: chBody,
        requires_signature: false,
        is_active: true,
      },
    });
  }

  if (challengesUnlinked > 0) {
    warnings.push(
      `${challengesUnlinked} challenges had no handbook link to a Wrightegaarden handbook (skipped).`,
    );
  }
  if (multilingualHandbooks > 0) {
    warnings.push(
      `${multilingualHandbooks} handbook titles came from multilingual array (no flat Title field).`,
    );
  }

  // 4) Operational-procedures protocol — its OWN paired policy
  //    (1:1 pairing required by UNIQUE(policy_id)).
  const procProtocolId = strikeUuid("tier2_protocol", `${workspaceUuid}_operational_procedures`);
  const procPolicyId = strikeUuid("tier2_policy", `${workspaceUuid}_operational_procedures`);
  // Synthetic provenance ID for the container (not a real Bubble row)
  const opsContainerBubbleId = `synthetic:${workspaceSlug}:operational_procedures`;
  policies.push(
    buildBookkeepingPolicy(
      procPolicyId,
      workspaceUuid,
      createdByUuid,
      "Operational procedures",
      opsContainerBubbleId,
      workspaceSlug,
      batchId,
    ),
  );
  protocols.push({
    table: "protocol",
    cols: {
      protocol_id: procProtocolId,
      policy_id: procPolicyId,
      workspace_id: workspaceUuid,
      name: "[IMPORT] Operational procedures",
      description:
        "Auto-generated container holding all live operational activities migrated from Bubble. " +
        "Live = Published status AND Active 🚫 = true. " +
        "Deleted-in-Bubble activities (Active 🚫 = false) and drafts are skipped.",
      version: "1.0",
      status: "draft",
      owner_profile_id: createdByUuid,
      created_by: createdByUuid,
      provenance: makeProvenance(opsContainerBubbleId, workspaceSlug, batchId),
    },
  });

  // 5) Procedures + procedure_steps via tree extraction (v2 — Tier 2 council
  //    follow-up). Walk `🚀 Parant` chain on live activities to find roots
  //    within the live cohort. Roots → procedure rows. Non-root descendants →
  //    procedure_step rows under the nearest root's procedure.
  //
  //    "Live cohort root" = activity whose parent is null OR whose parent is
  //    not in the live set (pruned, draft, or deleted upstream).
  const liveById = new Map<string, BubbleRecord>(
    liveActivities.map((a) => [a._id as string, a]),
  );

  function activityTitle(act: BubbleRecord): string {
    let t = getStr(act, "txt.title");
    if (!t) t = pickNorwegian(act["🏳️‍🌈 List of title"]);
    if (!t) t = "Untitled procedure";
    return truncate(t, 200) as string;
  }

  function activityDescription(act: BubbleRecord): string | null {
    let d = getStr(act, "txt.description");
    if (!d) d = pickNorwegian(act["🏳️‍🌈 description"]);
    return d;
  }

  function activityOrder(act: BubbleRecord): number {
    return typeof act["txt.order"] === "number" ? (act["txt.order"] as number) : 0;
  }

  // Group live children by their (live) parent
  const liveChildrenOf = new Map<string, BubbleRecord[]>();
  const roots: BubbleRecord[] = [];
  for (const act of liveActivities) {
    const parentId = act["🚀 Parant"];
    if (typeof parentId === "string" && liveById.has(parentId)) {
      if (!liveChildrenOf.has(parentId)) liveChildrenOf.set(parentId, []);
      liveChildrenOf.get(parentId)!.push(act);
    } else {
      roots.push(act);
    }
  }
  // Sort children deterministically by Bubble order field
  liveChildrenOf.forEach((arr) => {
    arr.sort((a, b) => activityOrder(a) - activityOrder(b));
  });
  roots.sort((a, b) => activityOrder(a) - activityOrder(b));

  const procedures: ExtractedRow[] = [];
  const procedureSteps: ExtractedRow[] = [];

  for (const root of roots) {
    const rootId = root._id as string;
    const procedureId = strikeUuid("tier2_procedure", rootId);

    procedures.push({
      table: "procedure",
      cols: {
        procedure_id: procedureId,
        protocol_id: procProtocolId,
        name: activityTitle(root),
        description: activityDescription(root),
        procedure_type: "standard",
        skill_requirements: null,
        sort_order: activityOrder(root),
        is_active: true,
        provenance: makeProvenance(rootId, workspaceSlug, batchId),
      },
    });

    // BFS through descendants; emit procedure_step per descendant. step_order
    // follows BFS encounter order so admin-curated tree depth survives.
    const queue: Array<{ node: BubbleRecord; depth: number }> = (
      liveChildrenOf.get(rootId) ?? []
    ).map((c) => ({ node: c, depth: 1 }));
    let stepCounter = 0;
    while (queue.length > 0) {
      const { node, depth } = queue.shift()!;
      const stepId = strikeUuid("tier2_procedure_step", node._id as string);
      const title = activityTitle(node);
      // procedure_step.description is NOT NULL — fall back to title if Bubble
      // had no description (very common, 46/52 in Wrightegaarden v1.5).
      const desc = activityDescription(node) ?? title;
      procedureSteps.push({
        table: "procedure_step",
        cols: {
          step_id: stepId,
          procedure_id: procedureId,
          title: title,
          description: desc,
          step_order: stepCounter,
          is_required: true,
          estimated_minutes: null,
          provenance: makeProvenance(node._id as string, workspaceSlug, batchId),
        },
      });
      stepCounter += 1;
      // Push children in order
      for (const child of liveChildrenOf.get(node._id as string) ?? []) {
        queue.push({ node: child, depth: depth + 1 });
      }
    }
  }
  const proceduresEmitted = procedures.length;
  const procedureStepsEmitted = procedureSteps.length;

  // NULL-description audits (Frontend Phase 3 finding — caller surfaces in
  // MANIFEST so admin can decide whether to defer apply pending content fill).
  const protocolsWithNullDescription = protocols.filter(
    (p) => p.cols.description === null,
  ).length;
  const proceduresWithNullDescription = procedures.filter(
    (p) => p.cols.description === null,
  ).length;

  if (handbooksDraftSkipped > 0) {
    warnings.push(
      `${handbooksDraftSkipped} handbooks had Bubble _status='Draft' and were skipped (not migrated).`,
    );
  }
  if (protocolsWithNullDescription > 0) {
    warnings.push(
      `${protocolsWithNullDescription}/${protocols.length} protocols have NULL description — admin curation recommended before publishing.`,
    );
  }
  if (proceduresWithNullDescription > 0) {
    warnings.push(
      `${proceduresWithNullDescription}/${procedures.length} procedures have NULL description — renders as title-only on mobile, admin review recommended.`,
    );
  }

  return {
    policies,
    protocols,
    procedures,
    procedureSteps,
    confirmations,
    warnings,
    stats: {
      handbooks: handbooks.length,
      handbooksDraftSkipped,
      challengesLinked,
      challengesUnlinked,
      multilingualHandbooks,
      activitiesTotal: totalActivities,
      activitiesLive: liveActivities.length,
      proceduresEmitted,
      procedureStepsEmitted,
      activityTreeRoots: roots.length,
      protocolsWithNullDescription,
      proceduresWithNullDescription,
    },
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await mkdir(STAGING, { recursive: true });

  const config = loadConfig(process.env);
  const client = new BubbleClient(config);
  const wsBubbleId = workspaceBubbleId(WORKSPACE_SLUG!);
  const workspaceUuid = strikeUuid("workspace", wsBubbleId);
  const createdByUuid = strikeUuid("profile", bookkeeperBubbleProfileId(WORKSPACE_SLUG!));

  console.log(`Tier 2 extraction — workspace=${WORKSPACE_SLUG}`);
  console.log(`  workspace_uuid=${workspaceUuid}`);
  console.log(`  bookkeeper_uuid=${createdByUuid}`);
  console.log(`  staging=${STAGING}`);
  console.log();

  console.log("Fetching handbooks (ws-filtered)...");
  const handbooks = await fetchHandbooks(client, wsBubbleId);
  console.log(`  ${handbooks.length} handbooks`);

  console.log("Fetching all handbook.challenges (no ws-link, filter client-side)...");
  const allChallenges = await fetchChallenges(client);
  console.log(`  ${allChallenges.length} challenges fetched globally`);

  console.log("Fetching workspace activities (ws-filtered)...");
  const allActs = await fetchActivities(client, wsBubbleId);
  console.log(`  ${allActs.length} activities fetched`);
  const liveActs = filterLive(allActs);
  console.log(`  ${liveActs.length} live (Published + Active 🚫=true)`);

  console.log();
  console.log("Building v3 row plan...");
  // Batch ID = run timestamp. Appears in every row's provenance for audit +
  // cross-run correlation ("which rows came from the 2026-04-17 morning run?").
  const batchId = new Date().toISOString();
  const result = buildRows(
    handbooks,
    allChallenges,
    liveActs,
    allActs.length,
    workspaceUuid,
    WORKSPACE_SLUG!,
    createdByUuid,
    batchId,
  );
  console.log(`  policy:         ${result.policies.length}`);
  console.log(`  protocol:       ${result.protocols.length}`);
  console.log(`  procedure:      ${result.procedures.length}  (${result.stats.activityTreeRoots} tree roots from ${result.stats.activitiesLive} live activities)`);
  console.log(`  procedure_step: ${result.procedureSteps.length}  (descendants nested via Bubble children/🚀Parant tree)`);
  console.log(`  confirmation:   ${result.confirmations.length}`);
  if (result.warnings.length > 0) {
    console.log("  warnings:");
    for (const w of result.warnings) console.log(`    ⚠ ${w}`);
  }

  // Emit SQL files (FK-safe order: policy → protocol → confirmation)
  const generatedAt = new Date().toISOString();
  const header = (entity: string, count: number): string =>
    [
      "-- strike-mcp Tier 2 extraction (content-extraction approach)",
      `-- entity: ${entity}`,
      `-- workspace: ${workspaceUuid}`,
      `-- workspace_slug: ${WORKSPACE_SLUG}`,
      `-- generated: ${generatedAt}`,
      `-- rows: ${count}`,
      "-- REVIEW BEFORE APPLYING",
      "-- DRY-RUN ONLY — inherits Tier 1 strike-auth-bridge gate",
      "-- See docs/superpowers/specs/2026-04-17-tier2-content-extraction.md",
      "",
      "BEGIN;",
      "",
    ].join("\n");
  const footer = "\n\nCOMMIT;\n";

  await writeFile(
    join(STAGING, "01_policy.sql"),
    header("policy", result.policies.length) +
      result.policies.map((r) => emitRowSql(r)).join("\n") +
      footer,
    "utf-8",
  );
  await writeFile(
    join(STAGING, "02_protocol.sql"),
    header("protocol", result.protocols.length) +
      result.protocols.map((r) => emitRowSql(r)).join("\n") +
      footer,
    "utf-8",
  );
  await writeFile(
    join(STAGING, "03_procedure.sql"),
    header("procedure", result.procedures.length) +
      result.procedures.map((r) => emitRowSql(r)).join("\n") +
      footer,
    "utf-8",
  );
  await writeFile(
    join(STAGING, "04_procedure_step.sql"),
    header("procedure_step", result.procedureSteps.length) +
      result.procedureSteps.map((r) => emitRowSql(r)).join("\n") +
      footer,
    "utf-8",
  );
  await writeFile(
    join(STAGING, "05_confirmation.sql"),
    header("confirmation", result.confirmations.length) +
      result.confirmations.map((r) => emitRowSql(r)).join("\n") +
      footer,
    "utf-8",
  );

  const manifest = {
    workspace_slug: WORKSPACE_SLUG,
    workspace_uuid: workspaceUuid,
    generated_at: generatedAt,
    approach: "content-extraction (per Pontus 2026-04-17 reframe)",
    apply_auth:
      "service_role ONLY — governance tables have RLS enabled; JWT-scoped apply throws 42501",
    apply_order: [
      { file: "01_policy.sql", entity: "policy", rows: result.policies.length },
      { file: "02_protocol.sql", entity: "protocol", rows: result.protocols.length },
      { file: "03_procedure.sql", entity: "procedure", rows: result.procedures.length },
      { file: "04_procedure_step.sql", entity: "procedure_step", rows: result.procedureSteps.length },
      { file: "05_confirmation.sql", entity: "confirmation", rows: result.confirmations.length },
      { file: "06_backfill_assignments.sql", entity: "protocol_assignment", rows: "computed at apply time", note: "Hand-authored (not emitted). Apply AFTER admin promotes protocols to status='active'." },
    ],
    stats: result.stats,
    warnings: result.warnings,
    notes: [
      "DRY-RUN only — production apply blocked on Tier 1 strike-auth-bridge gate.",
      "Policy:protocol is 1:1 (UNIQUE(policy_id) enforced by v3 schema). Each migrated protocol gets its own bookkeeping policy.",
      "All protocol `name` values prefixed with `[IMPORT] ` for admin visibility until curation. Status='draft' on all — admin must review+activate.",
      "All INSERTs use `ON CONFLICT (pk) DO NOTHING` for idempotent re-apply.",
      "Handbooks with Bubble _status='Draft' are skipped (see stats.handbooksDraftSkipped).",
      "Activities → procedure_step nesting (preserve tree) deferred to Tier 2 v2.",
      "Quizzes → knowledge_test deferred (Q6 product decision pending).",
      "Multilingual content lossy-mapped to Norwegian (no_no) with en_us fallback.",
      "Strike-mcp emits no telemetry — migration apply bypasses smartout.ai code; `every-mutation-emits` rule does not apply to psql-driven apply.",
    ],
    pre_apply_checklist: [
      "Verify wt-3 v3 schema migrations are applied to target Postgres",
      "Apply via service_role connection string (RLS bypass required)",
      "Mark services/strike-mcp/mappings/handbooks.json as superseded — Tier 1 never emitted handbook rows, target_table: public.runbook is stale",
      "Write backfill step: after protocol INSERTs, create protocol_assignment rows for existing Tier 1 profiles — `auto_assign_protocols` trigger fires only on profile INSERT, not protocol INSERT, so existing trainees miss new protocols without backfill",
      "Resolve knowledge_test.workspace_id writer bug in apps/web/src/app/dashboard/governance/_hooks/use-governance-mutations.ts:332 (unrelated to Tier 2 but must land before Tier 2 applies to live workspace)",
      "Decide source-tagging approach: add `source text` column to governance tables (requires ADR) vs sidecar JSONL preserving Bubble source IDs",
      "Review protocols with NULL description — admin may want to fill before publishing to employees",
      "Admin promotes protocols from status='draft' to 'active' explicitly; do not auto-activate",
    ],
  };
  await writeFile(
    join(STAGING, "MANIFEST.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf-8",
  );

  console.log();
  console.log("Wrote:");
  console.log(`  ${STAGING}/01_policy.sql`);
  console.log(`  ${STAGING}/02_protocol.sql`);
  console.log(`  ${STAGING}/03_procedure.sql`);
  console.log(`  ${STAGING}/04_procedure_step.sql`);
  console.log(`  ${STAGING}/05_confirmation.sql`);
  console.log(`  ${STAGING}/MANIFEST.json`);
  console.log(`  ${STAGING}/06_backfill_assignments.sql  (hand-authored companion, applies after admin sets protocols to active)`);
  console.log();
  console.log(
    "DRY-RUN complete. To apply (when gates open): cd supabase/migration-staging-tier2 && for f in *.sql; do psql ... -f $f; done",
  );
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`\nFatal: ${msg}`);
  if (e instanceof Error && e.stack) console.error(e.stack);
  process.exit(1);
});
