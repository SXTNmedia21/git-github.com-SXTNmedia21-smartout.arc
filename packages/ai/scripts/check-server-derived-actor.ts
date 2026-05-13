#!/usr/bin/env node
/**
 * Invariant I4 — stage-engine POST bodies must NOT accept profile_id/actor_id
 * from the client. Server derives via bearer token per ADR-0151.
 *
 * Usage:
 *   node check-server-derived-actor.ts [root] [--exclude <glob>]...
 *
 * Adapter exceptions (Ultravox/Telegram) may be whitelisted via one or more
 * --exclude flags. Each glob is passed through to globby as an `ignore` entry.
 */
import { readFileSync } from "node:fs";
import { globby } from "globby";

export type ActorViolation = { file: string; line: number; match: string };

const FORBIDDEN = /profile_id\s*:\s*z\.string\(\)(\.uuid\(\))?/;
// Inline-marker comment to opt out of the I4 forgery check.
// Use on schema fields that describe OTHER profiles (workforce snapshots,
// batch lookups, audit records) — NOT the caller's own identity.
const ESCAPE_MARKER = /\/\/\s*not-actor\b/;

export async function checkServerDerivedActor(opts: {
  root: string;
  exclude?: string[];
}): Promise<{ violations: ActorViolation[] }> {
  const files = await globby(["routes/**/*.ts", "src/routes/**/*.ts"], {
    cwd: opts.root,
    absolute: true,
    ignore: opts.exclude ?? [],
  });
  const violations: ActorViolation[] = [];
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (FORBIDDEN.test(lines[i]) && !ESCAPE_MARKER.test(lines[i])) {
        violations.push({ file, line: i + 1, match: lines[i].trim() });
      }
    }
  }
  return { violations };
}

function parseCliArgs(argv: string[]): { root: string; exclude: string[] } {
  let root: string | undefined;
  const exclude: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--exclude" && i + 1 < argv.length) {
      exclude.push(argv[i + 1]);
      i++;
      continue;
    }
    if (!root) {
      root = argv[i];
    }
  }
  return { root: root ?? process.cwd(), exclude };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { root, exclude } = parseCliArgs(process.argv.slice(2));
  checkServerDerivedActor({ root, exclude }).then((r) => {
    if (r.violations.length === 0) {
      console.log("ok: no profile_id in POST body schemas");
      process.exit(0);
    }
    console.error(`${r.violations.length} forgery-vector site(s):`);
    for (const v of r.violations) console.error(`  ${v.file}:${v.line} — ${v.match}`);
    process.exit(1);
  });
}
