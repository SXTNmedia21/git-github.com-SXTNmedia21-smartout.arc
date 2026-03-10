#!/usr/bin/env node
/**
 * Search load smoke script.
 * Why this exists: gives a quick, repeatable local SLO check for `/api/search`
 * without requiring dedicated load infrastructure.
 *
 * Usage:
 * node scripts/perf/search-load.mjs [base_url] [concurrency] [iterations] [workspace_id]
 */

const BASE_URL = process.argv[2] || "http://localhost:3050";
const CONCURRENCY = parseInt(process.argv[3] || "5", 10);
const ITERATIONS = parseInt(process.argv[4] || "20", 10);
const WORKSPACE_ID = process.argv[5] || "00000000-0000-0000-0000-000000000000";
const REQUEST_TIMEOUT_MS = 15_000;

const SAMPLE_QUERIES = [
  "allergen",
  "employee onboarding",
  "cleaning protocol",
  "fire safety",
  "wine service",
  "? hygiene",
  "@ manager",
  "> schedule",
];

function summarizeLatency(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (p) => {
    if (sorted.length === 0) return 0;
    const rank = Math.ceil((p / 100) * sorted.length);
    const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
    return sorted[index] ?? 0;
  };

  return {
    p50: pick(50),
    p95: pick(95),
    p99: pick(99),
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    avg: sorted.length > 0 ? Math.round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length) : 0,
  };
}

async function runQuery(query, workspaceId = WORKSPACE_ID) {
  const url = `${BASE_URL}/api/search?workspaceId=${workspaceId}&q=${encodeURIComponent(query)}`;
  const start = performance.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    const elapsed = Math.round(performance.now() - start);
    return { query, status: res.status, elapsed, error: null };
  } catch (err) {
    const elapsed = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : "Unknown error";
    return { query, status: 0, elapsed, error: message };
  }
}

async function main() {
  if (!Number.isFinite(CONCURRENCY) || CONCURRENCY <= 0 || !Number.isFinite(ITERATIONS) || ITERATIONS <= 0) {
    console.error("Concurrency and iterations must both be positive integers.");
    process.exit(1);
  }

  console.log(`\nSearch Load Test`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Iterations: ${ITERATIONS}`);
  console.log(`Workspace ID: ${WORKSPACE_ID}`);
  console.log(`Request timeout: ${REQUEST_TIMEOUT_MS}ms`);
  console.log(`Total requests: ${CONCURRENCY * ITERATIONS}\n`);

  const results = [];

  for (let i = 0; i < ITERATIONS; i++) {
    const batch = Array.from({ length: CONCURRENCY }, (_, j) => {
      const query = SAMPLE_QUERIES[(i * CONCURRENCY + j) % SAMPLE_QUERIES.length];
      return runQuery(query);
    });
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
  }

  const timings = results.map((result) => result.elapsed);
  const errors = results.filter((r) => r.error || r.status !== 200);
  const successCount = results.length - errors.length;
  const errorRatePercent = (errors.length / results.length) * 100;
  const stats = summarizeLatency(timings);

  console.log(`Results:`);
  console.log(`  Total:  ${results.length}`);
  console.log(`  Success:${successCount}`);
  console.log(`  Errors: ${errors.length} (${errorRatePercent.toFixed(1)}%)`);
  console.log(`  p50:    ${stats.p50}ms`);
  console.log(`  p95:    ${stats.p95}ms`);
  console.log(`  p99:    ${stats.p99}ms`);
  console.log(`  avg:    ${stats.avg}ms`);
  console.log(`  min:    ${stats.min}ms`);
  console.log(`  max:    ${stats.max}ms\n`);

  if (errors.length > 0) {
    const sampleErrors = errors.slice(0, 3).map((errorResult) => ({
      query: errorResult.query,
      status: errorResult.status,
      error: errorResult.error ?? "HTTP error",
    }));

    console.log("Sample errors:");
    for (const sample of sampleErrors) {
      console.log(`  - query="${sample.query}" status=${sample.status} error="${sample.error}"`);
    }
    console.log("");
  }

  if (successCount === 0) {
    console.log("No successful requests. Verify the app is running and reachable.");
    process.exit(1);
  }

  if (errorRatePercent >= 1) {
    console.log(`Error rate ${errorRatePercent.toFixed(1)}% exceeds <1% target`);
    process.exit(1);
  }

  if (stats.p95 > 500) {
    console.log("p95 exceeds 500ms SLO target");
    process.exit(1);
  } else {
    console.log("p95 within 500ms SLO target");
  }
}

main();
