// ============================================
// watch.ts
// File watcher for automatic re-ingestion of changed docs.
// Uses chokidar with a 3-second debounce to batch rapid changes.
// Connected to: src/commands/ingest.ts (triggers ingest on changes)
// ============================================

import { watch } from "chokidar";
import { resolve } from "node:path";
import { findProjectRoot } from "../utils/root";
import { runIngest } from "./ingest";

/** Debounce delay in milliseconds to batch rapid file changes */
const DEBOUNCE_MS = 3000;

/**
 * Runs a file watcher that auto-ingests changed documentation.
 *
 * Why: During active documentation work, it's useful to have
 * embeddings update automatically. The 3-second debounce prevents
 * re-ingesting on every keystroke when editing files.
 */
export async function runWatch(): Promise<void> {
  const docsDir = resolve(findProjectRoot(), "docs");
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let isIngesting = false;

  console.log(`\n👁️  Watching ${docsDir} for changes...\n`);
  console.log("   Press Ctrl+C to stop.\n");

  const watcher = watch("**/*.md", {
    cwd: docsDir,
    ignored: ["**/archive/**", "**/templates/**", "**/node_modules/**"],
    persistent: true,
    ignoreInitial: true,
  });

  /**
   * Schedules an ingest run after the debounce period.
   * Skips if an ingest is already in progress.
   */
  function scheduleIngest(eventPath: string, event: string): void {
    console.log(`   [${event}] ${eventPath}`);

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      if (isIngesting) {
        console.log("   Skipping — ingest already in progress.\n");
        return;
      }

      isIngesting = true;
      try {
        await runIngest({
          force: false,
          dryRun: false,
          mode: "filesystem",
          gitRef: "HEAD",
          duplicateThreshold: 0.96,
        });
      } catch (err) {
        console.error("   Ingest error:", err);
      } finally {
        isIngesting = false;
      }
    }, DEBOUNCE_MS);
  }

  watcher.on("add", (path) => scheduleIngest(path, "add"));
  watcher.on("change", (path) => scheduleIngest(path, "change"));
  watcher.on("unlink", (path) => scheduleIngest(path, "unlink"));
}
