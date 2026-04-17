#!/usr/bin/env tsx
/**
 * Debug: handbook workspace constraint mismatch.
 * Tier 1 discovery counted 26 handbooks for Wrightegaarden, but my live
 * fetch with constraint `workspace=<ws_id>` returns only 2. Check why.
 */

import { loadConfig } from "../src/config.js";
import { BubbleClient } from "../src/bubble/client.js";

const WS = "1683059156689x546199168715701950";

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const client = new BubbleClient(config);

  console.log("─ 1) global handbook count (no constraint) ─");
  const all = await client.sampleBidirectional("handbook", 5, {});
  console.log(`  totalCount=${all.totalCount}, firstN=${all.firstN.length}`);
  if (all.firstN[0]) {
    const r = all.firstN[0] as Record<string, unknown>;
    console.log("  sample fields containing 'workspace':");
    for (const [k, v] of Object.entries(r)) {
      if (k.toLowerCase().includes("workspace") || k === "🏰 Workspace" || k === "🏰 workspace") {
        console.log(`    ${k} = ${JSON.stringify(v)}`);
      }
    }
  }

  console.log("\n─ 2) constraint key 'workspace' ─");
  try {
    const a = await client.sampleBidirectional("handbook", 5, {
      constraints: [{ key: "workspace", constraint_type: "equals", value: WS }],
    });
    console.log(`  totalCount=${a.totalCount}`);
  } catch (e) {
    console.log(`  ERROR: ${(e as Error).message}`);
  }

  console.log("\n─ 3) constraint key '🏰 Workspace' ─");
  try {
    const b = await client.sampleBidirectional("handbook", 5, {
      constraints: [{ key: "🏰 Workspace", constraint_type: "equals", value: WS }],
    });
    console.log(`  totalCount=${b.totalCount}`);
  } catch (e) {
    console.log(`  ERROR: ${(e as Error).message}`);
  }

  console.log("\n─ 4) constraint key '🏰 workspace' (lowercase w) ─");
  try {
    const c = await client.sampleBidirectional("handbook", 5, {
      constraints: [{ key: "🏰 workspace", constraint_type: "equals", value: WS }],
    });
    console.log(`  totalCount=${c.totalCount}`);
  } catch (e) {
    console.log(`  ERROR: ${(e as Error).message}`);
  }

  // Also: print distinct workspace values across ALL handbooks (sample 50)
  console.log("\n─ 5) distinct 'workspace' field values across global sample of 50 ─");
  const sample = await client.listAll("handbook", { pageSize: 50, maxRecords: 50 });
  const wsCounts = new Map<string, number>();
  for (const h of sample) {
    const w = h.workspace as string | undefined;
    wsCounts.set(w ?? "(null)", (wsCounts.get(w ?? "(null)") ?? 0) + 1);
  }
  for (const [k, v] of [...wsCounts.entries()].sort((a, b) => b[1] - a[1])) {
    const isWright = k === WS ? " ← Wrightegaarden" : "";
    console.log(`  ${k}: ${v}${isWright}`);
  }
}

main().catch((e: unknown) => {
  console.error(`Fatal: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
