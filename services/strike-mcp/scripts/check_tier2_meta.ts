#!/usr/bin/env tsx
/**
 * check_tier2_meta.ts — Verify Tier 2 candidate types exist in live Bubble meta.
 *
 * Read-only. Calls /api/1.1/meta and prints, for each candidate:
 *   - whether the type exists (matched by case-insensitive contains)
 *   - all custom.workspace-link fields with their display names (constraint key)
 *
 * USAGE: source .env.local && pnpm tsx scripts/check_tier2_meta.ts
 */

import { loadConfig } from "../src/config.js";
import { BubbleClient } from "../src/bubble/client.js";

interface BubbleFieldMetaLocal {
  display: string;
  type: string;
}

const CANDIDATES = [
  "activity",
  "handbook.challenge",
  "question",
  "handbook.log",
  "badge",
  "handbook",
  "training",
];

async function main(): Promise<void> {
  const config = loadConfig(process.env as Record<string, string | undefined>);
  const bubble = new BubbleClient(config);

  console.log("Fetching Bubble meta...");
  const meta = await bubble.fetchMeta();

  const allTypes = Object.keys(meta.get);
  console.log(`Loaded ${allTypes.length} types from meta.\n`);

  const raw = meta as unknown as {
    get: string[];
    post: string[];
    types: Record<string, { fields?: Record<string, BubbleFieldMetaLocal> }>;
    app_data: unknown;
  };
  console.log(`meta.get count=${raw.get?.length ?? 0}, meta.types count=${Object.keys(raw.types ?? {}).length}\n`);

  const typeNames = Object.keys(raw.types ?? {});
  console.log("── ALL type names from meta.types ───────────────────────────────");
  for (const t of typeNames) console.log(`  ${JSON.stringify(t)}`);
  console.log();

  for (const candidate of CANDIDATES) {
    const matches = typeNames.filter((t) =>
      t.toLowerCase().includes(candidate.toLowerCase()),
    );
    console.log(`── candidate: "${candidate}" ───────────────────────────────`);
    if (matches.length === 0) {
      console.log("  NO MATCH");
      continue;
    }
    for (const typeName of matches) {
      console.log(`  type: ${JSON.stringify(typeName)}`);
      const typeMeta = raw.types[typeName];
      const fields = Object.entries(typeMeta?.fields ?? {});
      const wsFields = fields.filter(([, f]) => f.type === "custom.workspace");
      if (wsFields.length === 0) {
        console.log("    workspace link fields: NONE");
      } else {
        for (const [key, f] of wsFields) {
          console.log(
            `    ws-link field: id=${key} display=${JSON.stringify(f.display)}`,
          );
        }
      }
      console.log(`    total fields: ${fields.length}`);
    }
    console.log();
  }
  return;

  for (const candidate of CANDIDATES) {
    const matches = allTypes.filter((t) =>
      t.toLowerCase().includes(candidate.toLowerCase()),
    );
    console.log(`── candidate: "${candidate}" ───────────────────────────────`);
    if (matches.length === 0) {
      console.log("  NO MATCH");
      continue;
    }
    for (const typeName of matches) {
      console.log(`  type: ${JSON.stringify(typeName)}`);
      const typeMeta = meta.get[typeName];
      const fields = Object.entries(typeMeta?.fields ?? {});
      const wsFields = fields.filter(([, f]) => f.type === "custom.workspace");
      if (wsFields.length === 0) {
        console.log("    workspace link fields: NONE");
      } else {
        for (const [key, f] of wsFields) {
          console.log(
            `    ws-link field: id=${key} display=${JSON.stringify(f.display)}`,
          );
        }
      }
      console.log(`    total fields: ${fields.length}`);
    }
    console.log();
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\nFatal: ${msg}`);
  process.exit(1);
});
