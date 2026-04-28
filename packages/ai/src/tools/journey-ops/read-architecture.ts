// ============================================
// read-architecture.ts — Journey Engine architecture reader
// Lets the agent read repo docs related to the Journey Engine: architecture
// notes, ADRs, journey docs, engine docs. Reads from the local filesystem at
// runtime — works in dev/platform-admin context (which is the only place
// this agent runs).
// ============================================

import { z } from "zod";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { defineTool } from "../../types";
import type { JourneyOpsToolContext } from "./types";

// Repo root resolved relative to apps/web (the only host that mounts this
// agent). When invoked from a different cwd we still try sensible parents.
function repoRoot(): string {
  const cwd = process.cwd();
  // apps/web → ../.. ; root invocation → .
  if (cwd.endsWith("/apps/web") || cwd.endsWith("\\apps\\web")) {
    return join(cwd, "..", "..");
  }
  return cwd;
}

// Whitelisted doc roots — no escape hatch outside docs/.
const ALLOWED_DIRS = [
  "docs/architecture",
  "docs/decisions",
  "docs/journeys",
  "docs/engines",
  "docs/modules",
  "docs/cross-cutting",
  "docs/journey-engine",
];

const MAX_FILE_BYTES = 64 * 1024; // 64 KiB cap per file
const MAX_TOTAL_BYTES = 256 * 1024; // 256 KiB total per call
const MAX_LIST_ENTRIES = 200;

async function safeStat(path: string): Promise<"file" | "dir" | null> {
  try {
    const s = await stat(path);
    if (s.isDirectory()) return "dir";
    if (s.isFile()) return "file";
    return null;
  } catch {
    return null;
  }
}

async function listDirRecursive(
  root: string,
  rel: string,
  filter: RegExp | null,
  maxEntries: number,
): Promise<string[]> {
  const out: string[] = [];
  const stack: string[] = [rel];
  while (stack.length > 0 && out.length < maxEntries) {
    const cur = stack.pop()!;
    const abs = join(root, cur);
    let entries: import("node:fs").Dirent[];
    try {
      entries = await readdir(abs, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const childRel = join(cur, e.name);
      if (e.isDirectory()) {
        stack.push(childRel);
      } else if (e.isFile()) {
        if (!filter || filter.test(childRel)) {
          out.push(childRel);
          if (out.length >= maxEntries) break;
        }
      }
    }
  }
  return out.sort();
}

export const readArchitecture = defineTool({
  name: "read_architecture",
  description:
    "Read Journey Engine architecture docs from the repo. Allowed roots: " +
    ALLOWED_DIRS.join(", ") +
    ". Use mode='list' to see what exists (optionally filtered by " +
    "filename_pattern), or mode='read' with a path to fetch contents. Reads " +
    "are capped at 64KiB per file and 256KiB total. Use this BEFORE proposing " +
    "structural changes so suggestions match what's already documented.",
  schema: z.object({
    mode: z.enum(["list", "read"]),
    path: z
      .string()
      .nullish()
      .describe(
        "For mode='list': directory under docs/ to walk (defaults to all allowed roots). " +
          "For mode='read': specific .md file path under one of the allowed roots.",
      ),
    filename_pattern: z
      .string()
      .nullish()
      .describe("Optional regex applied to filenames in list mode"),
  }),

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async execute({ mode, path, filename_pattern }, _ctx: JourneyOpsToolContext) {
    const root = repoRoot();

    // Helper: reject paths that escape the whitelist.
    function allowed(rel: string): boolean {
      const norm = rel.replace(/\\/g, "/");
      return ALLOWED_DIRS.some((d) => norm === d || norm.startsWith(`${d}/`));
    }

    if (mode === "list") {
      const filter = filename_pattern ? new RegExp(filename_pattern) : null;
      const targets = path && allowed(path) ? [path] : ALLOWED_DIRS;
      const all: string[] = [];
      for (const t of targets) {
        const abs = join(root, t);
        const kind = await safeStat(abs);
        if (kind !== "dir") continue;
        const found = await listDirRecursive(root, t, filter, MAX_LIST_ENTRIES);
        for (const f of found) {
          all.push(f);
          if (all.length >= MAX_LIST_ENTRIES) break;
        }
        if (all.length >= MAX_LIST_ENTRIES) break;
      }
      return JSON.stringify(
        { mode: "list", root_relative: ALLOWED_DIRS, count: all.length, files: all },
        null,
        2,
      );
    }

    // mode === "read"
    if (!path) return "read mode requires path.";
    if (!allowed(path)) {
      return `Path "${path}" is outside the allowed roots (${ALLOWED_DIRS.join(", ")}).`;
    }
    const abs = join(root, path);
    const kind = await safeStat(abs);
    if (kind !== "file") return `Not a file: ${path}`;

    let buf: Buffer;
    try {
      buf = await readFile(abs);
    } catch (err) {
      return `Read error: ${err instanceof Error ? err.message : String(err)}`;
    }

    let truncated = false;
    let content = buf.toString("utf8");
    if (buf.byteLength > MAX_FILE_BYTES) {
      content = buf.subarray(0, MAX_FILE_BYTES).toString("utf8");
      truncated = true;
    }

    return JSON.stringify(
      {
        mode: "read",
        path: relative(root, abs),
        bytes: buf.byteLength,
        truncated,
        truncated_at: truncated ? MAX_FILE_BYTES : null,
        content,
      },
      null,
      2,
    );
  },
});

// Re-export the byte cap so callers/tests stay in sync.
export const READ_ARCHITECTURE_MAX_FILE_BYTES = MAX_FILE_BYTES;
export const READ_ARCHITECTURE_MAX_TOTAL_BYTES = MAX_TOTAL_BYTES;
