// services/voice-agent/scripts/vad-bench/markdown.ts
//
// Renders BenchScore as CI-attachable markdown. Output is consumed by
// (a) developer reviewing local bench output, (b) CI artefact uploader,
// (c) GitHub Actions step summary.

import { TARGETS, type BenchScore } from "./types.js";

const mark = (passed: boolean): string => (passed ? "✅" : "❌");

export function formatSummary(score: BenchScore): string {
  const overall = score.passed.overall ? "PASS" : "FAIL";
  const lines = [
    "# vad-bench summary",
    "",
    `Overall: ${overall}`,
    "",
    `Total fixtures: ${score.total}`,
    "",
    "## Latency",
    "",
    `- P50: ${score.p50_ms}ms (≤ ${TARGETS.P50_MS}ms) ${mark(score.passed.p50)}`,
    `- P95: ${score.p95_ms}ms (≤ ${TARGETS.P95_MS}ms) ${mark(score.passed.p95)}`,
    "",
    "## Turn-taking integrity",
    "",
    `- False-end: ${(score.false_end_ratio * 100).toFixed(0)}% (≤ ${(TARGETS.FALSE_END_RATIO * 100).toFixed(0)}%) ${mark(score.passed.false_end)}`,
    `- False-end count: ${score.false_end_count}`,
    "",
  ];
  return lines.join("\n");
}
