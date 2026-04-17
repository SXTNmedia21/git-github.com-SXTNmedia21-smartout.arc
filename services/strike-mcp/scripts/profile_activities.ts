#!/usr/bin/env tsx
/** Profile Wrightegaarden's 935 activities to inform Tier 2 v2 design. */
import { loadConfig } from "../src/config.js";
import { BubbleClient } from "../src/bubble/client.js";

async function main(): Promise<void> {
  const c = new BubbleClient(loadConfig(process.env));
  console.log("Fetching all Wrightegaarden activities...");
  const acts = await c.listAll("activity", {
    constraints: [{ key: "workspace", constraint_type: "equals", value: "1683059156689x546199168715701950" }],
    pageSize: 100,
  });
  console.log(`total: ${acts.length}`);

  const counts = (key: string, fn: (a: Record<string, unknown>) => string): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const a of acts) {
      const k = fn(a as Record<string, unknown>);
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  };

  console.log("\n_Status:", JSON.stringify(counts("_Status", (a) => String(a._Status ?? "(null)")), null, 2));
  console.log("_activityType:", JSON.stringify(counts("_activityType", (a) => String(a._activityType ?? "(null)")), null, 2));
  console.log("_dataType:", JSON.stringify(counts("_dataType", (a) => String(a._dataType ?? "(null)")), null, 2));
  console.log("Active 🚫:", JSON.stringify(counts("Active 🚫", (a) => String(a["Active 🚫"] ?? "(null)")), null, 2));

  let withParent = 0;
  for (const a of acts) if ((a as Record<string, unknown>)["🚀 Parant"]) withParent++;
  console.log(`\nwith parent: ${withParent} / root: ${acts.length - withParent}`);

  const depCounts: Record<string, number> = {};
  for (const a of acts) {
    const d = String((a as Record<string, unknown>)["🏠 Department"] ?? "(no dept)");
    depCounts[d] = (depCounts[d] ?? 0) + 1;
  }
  console.log(`distinct departments: ${Object.keys(depCounts).length}`);

  // Filter Published + Active
  const live = acts.filter((a) => {
    const r = a as Record<string, unknown>;
    return r._Status === "Published" && (r["Active 🚫"] === true || r["Active 🚫"] === "true");
  });
  console.log(`\nlive (Published + active): ${live.length}`);
  const liveDeps: Record<string, number> = {};
  for (const a of live) {
    const d = String((a as Record<string, unknown>)["🏠 Department"] ?? "(no dept)");
    liveDeps[d] = (liveDeps[d] ?? 0) + 1;
  }
  console.log(`live distinct departments: ${Object.keys(liveDeps).length}`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
