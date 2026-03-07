#!/usr/bin/env tsx
/**
 * Journey Runner — spawns Claude Code agents to implement user journeys.
 * Usage: tsx scripts/journey-runner.ts J-019 [--dry-run] [--verbose]
 */
import { execSync, spawnSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { findReusableComponents } from "./journey-runner/reusable-components";

const ROOT = resolve(import.meta.dirname ?? __dirname, "..");

type Args = { journeyId: string; dryRun: boolean; verbose: boolean };

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2);
  const journeyId = args.find((a) => !a.startsWith("--")) ?? "";
  return {
    journeyId,
    dryRun: args.includes("--dry-run"),
    verbose: args.includes("--verbose"),
  };
}

function findJourneySpec(journeyId: string): string | null {
  const dirs = [join(ROOT, "docs/modules/journey"), join(ROOT, "docs/journeys")];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir, { recursive: true }) as string[];
    const match = files.find(
      (f) => typeof f === "string" && f.includes(journeyId) && f.endsWith(".md"),
    );
    if (match) return readFileSync(join(dir, match), "utf-8");
  }
  return null;
}

function checkInfrastructure(): { ready: boolean; missing: string[] } {
  const missing: string[] = [];

  const requiredTables = [
    "engine_state_step",
    "knowledge_test_attempt",
    "confirmation_signature",
    "procedure_step_completion",
    "session_hook",
    "session_task",
    "session_note",
  ];

  const typesPath = join(ROOT, "packages/supabase/src/database.types.ts");
  if (!existsSync(typesPath)) {
    missing.push("database.types.ts not found");
  } else {
    const types = readFileSync(typesPath, "utf-8");
    for (const table of requiredTables) {
      if (!types.includes(`${table}:`)) {
        missing.push(`Table ${table} not in database.types.ts`);
      }
    }
  }

  const registryPath = join(ROOT, "packages/telemetry/src/registry.ts");
  if (!existsSync(registryPath)) {
    missing.push("telemetry registry not found");
  } else {
    const registry = readFileSync(registryPath, "utf-8");
    if (!registry.includes("engine_event")) {
      missing.push("engine_event destination not in telemetry");
    }
  }

  return { ready: missing.length === 0, missing };
}

function buildContract(journeySpec: string, journeyId: string, module: string): string {
  const templatePath = join(ROOT, "scripts/journey-runner/contract-template.md");
  let template = readFileSync(templatePath, "utf-8");

  const components = findReusableComponents(module);
  const componentList = components
    .map((c) => `- \`${c.name}\` (${c.path}) — ${c.description}`)
    .join("\n");

  template = template
    .replace(/\{\{JOURNEY_ID\}\}/g, journeyId)
    .replace(/\{\{JOURNEY_SPEC\}\}/g, journeySpec)
    .replace(/\{\{MODULE\}\}/g, module)
    .replace(/\{\{REUSABLE_COMPONENTS\}\}/g, componentList)
    .replace(/\{\{ROOT\}\}/g, ROOT);

  return template;
}

function spawnAgent(contract: string, verbose: boolean): { exitCode: number; output: string } {
  const result = spawnSync("claude", ["--print", "-p", contract], {
    cwd: ROOT,
    encoding: "utf-8",
    stdio: verbose ? "inherit" : "pipe",
    timeout: 600_000,
  });

  return {
    exitCode: result.status ?? 1,
    output: result.stdout ?? "",
  };
}

function verify(): { typecheck: boolean; lint: boolean } {
  const tc = spawnSync("pnpm", ["typecheck"], {
    cwd: ROOT,
    encoding: "utf-8",
    stdio: "pipe",
    timeout: 300_000,
  });

  const lint = spawnSync("pnpm", ["lint"], {
    cwd: ROOT,
    encoding: "utf-8",
    stdio: "pipe",
    timeout: 300_000,
  });

  return {
    typecheck: tc.status === 0,
    lint: lint.status === 0,
  };
}

function main() {
  const args = parseArgs(process.argv);

  if (!args.journeyId) {
    console.error("Usage: tsx scripts/journey-runner.ts <JOURNEY_ID> [--dry-run] [--verbose]");
    process.exit(1);
  }

  console.log(`\n=== Journey Runner: ${args.journeyId} ===\n`);

  // 1. Check infrastructure
  const infra = checkInfrastructure();
  if (!infra.ready) {
    console.error("Infrastructure not ready:");
    infra.missing.forEach((m) => console.error(`  - ${m}`));
    process.exit(1);
  }
  console.log("Infrastructure: OK");

  // 2. Find journey spec
  const spec = findJourneySpec(args.journeyId);
  if (!spec) {
    console.error(`Journey spec not found for ${args.journeyId}`);
    process.exit(1);
  }
  console.log(`Journey spec: found (${spec.length} chars)`);

  // 3. Detect module from spec
  const moduleMatch = spec.match(/module:\s*(\w+)/i);
  const module = moduleMatch?.[1] ?? "all";

  // 4. Build contract
  const contract = buildContract(spec, args.journeyId, module);
  console.log(`Contract: built (${contract.length} chars)`);

  if (args.dryRun) {
    console.log("\n--- DRY RUN ---\n");
    console.log(contract);
    process.exit(0);
  }

  // 5. Spawn agent
  console.log("\nSpawning Claude Code agent...\n");
  const result = spawnAgent(contract, args.verbose);
  console.log(`\nAgent exited with code ${result.exitCode}`);

  // 6. Verify
  console.log("\nRunning verification...");
  const checks = verify();
  console.log(`  Typecheck: ${checks.typecheck ? "PASS" : "FAIL"}`);
  console.log(`  Lint: ${checks.lint ? "PASS" : "FAIL"}`);

  const passed = checks.typecheck && checks.lint && result.exitCode === 0;
  console.log(`\n=== ${args.journeyId}: ${passed ? "PASS" : "FAIL"} ===\n`);
  process.exit(passed ? 0 : 1);
}

main();
