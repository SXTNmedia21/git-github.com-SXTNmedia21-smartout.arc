// ============================================
// ingest-lock.ts
// File-based concurrency lock for the ingest pipeline.
// Prevents multiple ingest processes from running simultaneously,
// which could cause duplicate embeddings or race conditions.
// Connected to: src/commands/ingest.ts (wraps write operations)
// ============================================

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { findProjectRoot } from "../utils/root";

/** Lock file location relative to project root */
const LOCK_FILE_PATH = ".cache/docs-pipeline.ingest.lock";

/**
 * Lock file contents for debugging stale locks.
 */
type LockInfo = {
  pid: number;
  startedAt: string;
  command: string;
};

/**
 * Acquires the ingest lock.
 *
 * Why: Two concurrent ingest runs could delete and re-insert the
 * same chunks simultaneously, causing duplicates or data loss.
 * A simple file lock is sufficient for this use case (single-machine,
 * not distributed).
 *
 * Checks for stale locks (dead process) and cleans them up automatically.
 *
 * @param command - Description of the command acquiring the lock
 * @returns true if lock acquired, false if another process holds it
 */
export function acquireLock(command: string): boolean {
  const lockPath = getLockPath();

  // Check existing lock
  if (existsSync(lockPath)) {
    const existing = readLock(lockPath);

    if (existing && isProcessAlive(existing.pid)) {
      console.log(
        `   Lock held by PID ${existing.pid} (started ${existing.startedAt}). ` +
          `Another ingest is running.`,
      );
      return false;
    }

    // Stale lock — process is dead, clean up
    console.log(`   Removing stale lock from dead process (PID ${existing?.pid ?? "unknown"}).`);
    unlinkSync(lockPath);
  }

  // Write new lock
  const lockDir = dirname(lockPath);
  if (!existsSync(lockDir)) {
    mkdirSync(lockDir, { recursive: true });
  }

  const lockInfo: LockInfo = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    command,
  };

  writeFileSync(lockPath, JSON.stringify(lockInfo, null, 2), "utf-8");
  return true;
}

/**
 * Releases the ingest lock.
 *
 * Only removes the lock if it belongs to the current process (same PID).
 */
export function releaseLock(): void {
  const lockPath = getLockPath();

  if (!existsSync(lockPath)) return;

  const existing = readLock(lockPath);
  if (existing && existing.pid === process.pid) {
    unlinkSync(lockPath);
  }
}

/**
 * Returns the absolute path to the lock file.
 */
function getLockPath(): string {
  return resolve(findProjectRoot(), LOCK_FILE_PATH);
}

/**
 * Reads and parses the lock file.
 *
 * @param lockPath - Absolute path to the lock file
 * @returns Parsed lock info, or null if file is corrupt
 */
function readLock(lockPath: string): LockInfo | null {
  try {
    const content = readFileSync(lockPath, "utf-8");
    return JSON.parse(content) as LockInfo;
  } catch {
    return null;
  }
}

/**
 * Checks if a process with the given PID is still running.
 *
 * Why: If the previous ingest process crashed, its lock file
 * remains. We detect this by checking if the PID is still alive,
 * and clean up stale locks automatically.
 *
 * @param pid - Process ID to check
 * @returns true if the process is alive
 */
function isProcessAlive(pid: number): boolean {
  try {
    // Sending signal 0 checks if process exists without killing it
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
