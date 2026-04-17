#!/usr/bin/env tsx
/**
 * run_discovery.ts — Phase 3.5a: Bubble entity discovery script
 *
 * Runs discovery against a chosen Bubble workspace, sampling all entities
 * and producing mapping files for human review.
 *
 * USAGE:
 *   # Source env vars first (required)
 *   source .env.local
 *   pnpm discovery [options]
 *
 * OPTIONS:
 *   --workspace=<id>    Skip interactive selection, use this workspace ID
 *   --entity=<name>     Discover only this entity (use with --force to re-run)
 *   --force             Overwrite existing mapping files (default: skip existing)
 *   --no-sidecar        Disable sidecar writes (default: sidecar enabled)
 *
 * EXAMPLES:
 *   pnpm discovery
 *   pnpm discovery --workspace=abc123
 *   pnpm discovery --entity=workspace --force
 *   pnpm discovery --no-sidecar
 */

import * as readline from "node:readline";
import { loadConfig } from "../src/config.js";
import { BubbleClient } from "../src/bubble/client.js";
import { ENTITY_REGISTRY, getEntityByName } from "../src/entities.js";
import {
  runDiscovery,
  formatProgress,
  formatSummary,
} from "./lib/discovery.js";
import { listWorkspacesTool } from "../src/tools/list_workspaces.js";

// ─── Argument parsing ─────────────────────────────────────────────────────

function parseArgs(argv: string[]): {
  workspaceId: string | null;
  entityName: string | null;
  force: boolean;
  enableSidecar: boolean;
} {
  let workspaceId: string | null = null;
  let entityName: string | null = null;
  let force = false;
  let enableSidecar = true;

  for (const arg of argv) {
    if (arg.startsWith("--workspace=")) {
      workspaceId = arg.slice("--workspace=".length).trim();
    } else if (arg.startsWith("--entity=")) {
      entityName = arg.slice("--entity=".length).trim();
    } else if (arg === "--force") {
      force = true;
    } else if (arg === "--no-sidecar") {
      enableSidecar = false;
    }
  }

  return { workspaceId, entityName, force, enableSidecar };
}

// ─── Interactive workspace selection ──────────────────────────────────────

async function selectWorkspace(bubble: BubbleClient): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const result = await listWorkspacesTool.execute({}, {
    bubble,
    mappingsDir: "",
    vaultBubbleShapesDir: "",
    stagingDir: "",
    supabase: null,
  });

  const { workspaces } = result;

  if (workspaces.length === 0) {
    rl.close();
    throw new Error("No workspaces found in Bubble. Check your API token.");
  }

  console.log("\nAvailable workspaces:");
  workspaces.forEach((ws, i) => {
    const name = ws.name || "(unnamed)";
    const created = ws.createdAt ? ` (created: ${ws.createdAt.slice(0, 10)})` : "";
    console.log(`  [${i + 1}] ${name}${created}`);
    console.log(`       ID: ${ws.id}`);
  });

  return new Promise((resolve, reject) => {
    rl.question(`\nSelect workspace [1-${workspaces.length}]: `, (answer) => {
      rl.close();
      const idx = parseInt(answer.trim(), 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= workspaces.length) {
        reject(new Error(`Invalid selection: "${answer}"`));
        return;
      }
      const selected = workspaces[idx];
      console.log(`\nSelected: ${selected.name} (${selected.id})\n`);
      resolve(selected.id);
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Load config (requires BUBBLE_APP_URL + BUBBLE_API_TOKEN in env)
  const config = loadConfig(process.env as Record<string, string | undefined>);
  const bubble = new BubbleClient(config);

  // Resolve workspace ID
  let workspaceId = args.workspaceId;
  if (!workspaceId) {
    workspaceId = await selectWorkspace(bubble);
  }

  // Resolve entity list
  let entities = ENTITY_REGISTRY.slice();
  if (args.entityName) {
    const found = getEntityByName(args.entityName);
    if (!found) {
      console.error(
        `Unknown entity "${args.entityName}". Known: ${entities.map((e) => e.name).join(", ")}`,
      );
      process.exit(1);
    }
    entities = [found];
  }

  console.log(
    `Starting discovery: ${entities.length} entities, workspace=${workspaceId}`,
  );
  console.log(
    `  force=${args.force}, sidecar=${args.enableSidecar}\n`,
  );

  const results = await runDiscovery(entities, {
    bubble,
    mappingsDir: config.mappingsDir,
    workspaceId,
    force: args.force,
    enableSidecar: args.enableSidecar,
    onProgress(result, index, total) {
      console.log(formatProgress(result, index, total));
    },
  });

  console.log(formatSummary(results));

  const failed = results.filter((r) => r.status === "error").length;
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\nFatal error: ${msg}`);
  process.exit(1);
});
