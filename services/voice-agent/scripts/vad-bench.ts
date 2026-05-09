// services/voice-agent/scripts/vad-bench.ts
//
// CLI entry. Two modes:
//
//   pnpm vad-bench:record   → records all fixtures, writes
//                             scripts/vad-bench/output/bench-results-<ts>.json
//   pnpm vad-bench          → reads latest bench-results-*.json, scores,
//                             writes bench-summary.md, exits 0 on pass / 1 on fail.
//
// Pre-sortie gate per ADR-0282 R6 — exit code drives CI / sortie-pre-flight.

import { readFileSync, readdirSync, writeFileSync, statSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  benchOutputSchema,
  fixtureSchema,
  type BenchOutput,
  type Fixture,
  type Recording,
} from "./vad-bench/types.js";
import { recordFixture, TURN_DETECTION_HASH } from "./vad-bench/recorder.js";
import { scoreBench } from "./vad-bench/scorer.js";
import { formatSummary } from "./vad-bench/markdown.js";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(SCRIPT_DIR, "vad-bench", "fixtures");
const OUTPUT_DIR = join(SCRIPT_DIR, "vad-bench", "output");

function loadFixtures(): Fixture[] {
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => fixtureSchema.parse(JSON.parse(readFileSync(join(FIXTURES_DIR, f), "utf8"))));
}

function loadLatestRecording(): BenchOutput | null {
  let candidates: string[];
  try {
    candidates = readdirSync(OUTPUT_DIR).filter((f) => /^bench-results-.*\.json$/.test(f));
  } catch {
    return null;
  }
  if (candidates.length === 0) return null;
  candidates.sort(
    (a, b) => statSync(join(OUTPUT_DIR, b)).mtimeMs - statSync(join(OUTPUT_DIR, a)).mtimeMs,
  );
  const latest = readFileSync(join(OUTPUT_DIR, candidates[0]!), "utf8");
  return benchOutputSchema.parse(JSON.parse(latest));
}

async function recordMode(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[vad-bench] OPENAI_API_KEY required for record mode");
    process.exit(2);
  }
  const fixtures = loadFixtures();
  if (fixtures.length === 0) {
    console.error("[vad-bench] no fixture JSON files found in", FIXTURES_DIR);
    process.exit(2);
  }
  console.log(`[vad-bench] recording ${fixtures.length} fixtures`);

  const recordings: Recording[] = [];
  for (const fix of fixtures) {
    try {
      const rec = await recordFixture(fix, apiKey);
      console.log(
        `[vad-bench] ${fix.id}: turn_end_ts=${rec.turn_end_ts_ms}ms false_end=${rec.false_end}`,
      );
      recordings.push(rec);
    } catch (err) {
      console.error(`[vad-bench] ${fix.id} FAILED:`, (err as Error).message);
      process.exit(2);
    }
  }

  const out: BenchOutput = {
    recorded_at: new Date().toISOString(),
    config_hash: TURN_DETECTION_HASH,
    recordings,
  };
  const stamp = out.recorded_at.replace(/[:.]/g, "-");
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const outFile = join(OUTPUT_DIR, `bench-results-${stamp}.json`);
  writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log(`[vad-bench] wrote ${outFile}`);
}

function scoreMode(): void {
  const fixtures = loadFixtures();
  const recording = loadLatestRecording();
  if (!recording) {
    console.error(
      "[vad-bench] no bench-results-*.json found in",
      OUTPUT_DIR,
      "— run vad-bench:record first.",
    );
    process.exit(2);
  }
  const score = scoreBench(fixtures, recording.recordings);
  const md = formatSummary(score);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(join(OUTPUT_DIR, "bench-summary.md"), md);
  console.log(md);
  if (score.passed.overall) {
    console.log("[vad-bench] PASS — all ADR-0282 R6 targets met");
    process.exit(0);
  } else {
    console.error("[vad-bench] FAIL — one or more ADR-0282 R6 targets missed");
    process.exit(1);
  }
}

const mode = process.argv[2] === "--record" ? "record" : "score";
if (mode === "record") {
  void recordMode();
} else {
  scoreMode();
}
