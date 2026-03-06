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
  .option("--mode <mode>", "Change detection mode: filesystem or git", "filesystem")
  .option("--git-ref <ref>", "Git ref to diff against (git mode only)", "HEAD")
  .option(
    "--duplicate-threshold <threshold>",
    "Cosine similarity threshold for duplicate warnings",
    "0.96",
  )
  .action(async (opts) => {
    const { runIngest } = await import("./commands/ingest");
    await runIngest({
      force: opts.force,
      dryRun: opts.dryRun,
      mode: opts.mode,
      gitRef: opts.gitRef,
      duplicateThreshold: parseFloat(opts.duplicateThreshold),
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
