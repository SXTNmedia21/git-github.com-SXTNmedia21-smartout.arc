#!/usr/bin/env node
// ============================================
// index.ts
// CLI entry point for the docs pipeline.
// Provides ingest, watch, and validate commands via Commander.
// Connected to: src/commands/ingest.ts (ingest command)
// Connected to: src/commands/watch.ts (watch command)
// Connected to: src/commands/validate.ts (validate command — Phase D)
// ============================================

import { Command } from "commander";

const program = new Command();

/**
 * Parses passthrough args after `--` for pnpm script compatibility.
 *
 * Why: `pnpm run <script> -- --flag` forwards args after `--` as raw operands.
 * We normalize those operands back into ingest options so both invocation
 * styles work:
 * - `pnpm ... ingest --mode workspace`
 * - `pnpm ... ingest -- --mode workspace`
 *
 * @param argv - Raw process argv
 * @returns Partial ingest options derived from passthrough args
 */
function parsePassthroughIngestArgs(argv: string[]): {
  mode?: string;
  gitRef?: string;
  workspaceId?: string;
  force?: boolean;
  dryRun?: boolean;
  duplicateThreshold?: string;
} {
  const separatorIndex = argv.lastIndexOf("--");
  if (separatorIndex === -1) {
    return {};
  }

  const args = argv.slice(separatorIndex + 1);
  const parsed: {
    mode?: string;
    gitRef?: string;
    workspaceId?: string;
    force?: boolean;
    dryRun?: boolean;
    duplicateThreshold?: string;
  } = {};

  for (let index = 0; index < args.length; index++) {
    const token = args[index];

    if (token === "--force") {
      parsed.force = true;
      continue;
    }

    if (token === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    const nextToken = args[index + 1];

    if (token === "--mode" && nextToken) {
      parsed.mode = nextToken;
      index++;
      continue;
    }

    if (token === "--git-ref" && nextToken) {
      parsed.gitRef = nextToken;
      index++;
      continue;
    }

    if (token === "--workspace-id" && nextToken) {
      parsed.workspaceId = nextToken;
      index++;
      continue;
    }

    if (token === "--duplicate-threshold" && nextToken) {
      parsed.duplicateThreshold = nextToken;
      index++;
    }
  }

  return parsed;
}

program
  .name("docs-pipeline")
  .description("Smartout documentation ingestion and validation pipeline")
  .version("1.0.0");

// --- Ingest command ---
program
  .command("ingest")
  .description("Ingest documentation into the vector database")
  .option("--force", "Re-process all files regardless of hash changes", false)
  .option("--dry-run", "Log what would happen without making changes", false)
  .option("--mode <mode>", "Change detection mode: filesystem, git, or workspace", "filesystem")
  .option("--git-ref <ref>", "Git ref to diff against (git mode only)", "HEAD")
  .option("--workspace-id <id>", "Workspace ID filter (workspace mode only)")
  .option(
    "--duplicate-threshold <threshold>",
    "Cosine similarity threshold for duplicate warnings",
    "0.96",
  )
  .allowExcessArguments(true)
  .action(async (opts) => {
    const { runIngest } = await import("./commands/ingest");
    const passthrough = parsePassthroughIngestArgs(process.argv);
    await runIngest({
      force: passthrough.force ?? opts.force,
      dryRun: passthrough.dryRun ?? opts.dryRun,
      mode: passthrough.mode ?? opts.mode,
      gitRef: passthrough.gitRef ?? opts.gitRef,
      workspaceId: passthrough.workspaceId ?? opts.workspaceId,
      duplicateThreshold: parseFloat(passthrough.duplicateThreshold ?? opts.duplicateThreshold),
    });
  });

// --- Workspace ingest command ---
program
  .command("ingest-workspace")
  .description(
    "Ingest workspace content (handbook, policies, protocols, procedures) into workspace_doc_chunk",
  )
  .requiredOption("--workspace-id <id>", "Workspace ID to ingest content for")
  .option("--force", "Re-process all content regardless of hash changes", false)
  .option("--dry-run", "Log what would happen without making changes", false)
  .action(async (opts) => {
    const { runWorkspaceIngest } = await import("./commands/ingest-workspace");
    await runWorkspaceIngest({
      workspaceId: opts.workspaceId,
      force: opts.force,
      dryRun: opts.dryRun,
    });
  });

// --- Watch command ---
program
  .command("watch")
  .description("Watch docs/ for changes and auto-ingest")
  .action(async () => {
    const { runWatch } = await import("./commands/watch");
    await runWatch();
  });

// --- Validate command (placeholder, wired in Phase D) ---
program
  .command("validate")
  .description("Validate documentation structure and compliance")
  .option("--strict", "Treat warnings as failures", false)
  .option("--rule <rule>", "Run a specific rule group only")
  .action(async (opts) => {
    const { runValidate } = await import("./commands/validate");
    await runValidate({
      strict: opts.strict,
      rule: opts.rule,
    });
  });

program.parse();
