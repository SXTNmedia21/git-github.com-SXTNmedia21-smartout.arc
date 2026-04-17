#!/usr/bin/env tsx
/**
 * check_questions_constraint.ts — Verify why `questions` returned 0 in Wrightegaarden.
 * Probes:
 *   1) global question count (no constraint)
 *   2) ws=Wrightegaarden via "workspace" key
 *   3) ws=Wrightegaarden via other plausible field-display keys from meta
 */

import { loadConfig } from "../src/config.js";
import { BubbleClient } from "../src/bubble/client.js";

const WS = "1683059156689x546199168715701950"; // Wrightegaarden

async function main(): Promise<void> {
  const config = loadConfig(process.env as Record<string, string | undefined>);
  const bubble = new BubbleClient(config);

  console.log("── 1) global question count ──");
  const globalSample = await bubble.sampleBidirectional("question", 5, {});
  console.log(
    `  totalCount=${globalSample.totalCount}, firstN=${globalSample.firstN.length}`,
  );

  if (globalSample.firstN[0]) {
    console.log("\n── sample question record fields ──");
    const sampleKeys = Object.keys(globalSample.firstN[0]);
    console.log(`  keys (${sampleKeys.length}):`);
    for (const k of sampleKeys) {
      const v = (globalSample.firstN[0] as Record<string, unknown>)[k];
      const valStr =
        typeof v === "string" ? v.slice(0, 50) : JSON.stringify(v).slice(0, 50);
      console.log(`    ${k}: ${valStr}`);
    }
  }

  console.log("\n── 2) ws-filter via 'workspace' ──");
  const wsSample = await bubble.sampleBidirectional("question", 5, {
    constraints: [{ key: "workspace", constraint_type: "equals" as const, value: WS }],
  });
  console.log(
    `  totalCount=${wsSample.totalCount}, firstN=${wsSample.firstN.length}`,
  );

  console.log("\n── 3) ws-filter via '🏰 workspace' ──");
  const wsSample2 = await bubble.sampleBidirectional("question", 5, {
    constraints: [{ key: "🏰 workspace", constraint_type: "equals" as const, value: WS }],
  });
  console.log(
    `  totalCount=${wsSample2.totalCount}, firstN=${wsSample2.firstN.length}`,
  );

  console.log("\n── 4) ws-filter via '🏰 Workspace' (capital W) ──");
  const wsSample3 = await bubble.sampleBidirectional("question", 5, {
    constraints: [{ key: "🏰 Workspace", constraint_type: "equals" as const, value: WS }],
  });
  console.log(
    `  totalCount=${wsSample3.totalCount}, firstN=${wsSample3.firstN.length}`,
  );
}

main().catch((err: unknown) => {
  console.error(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
