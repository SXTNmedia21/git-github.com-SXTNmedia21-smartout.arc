#!/usr/bin/env node
/**
 * Search load test script
 * Usage: node scripts/perf/search-load.mjs [base_url] [concurrency] [iterations]
 */

const BASE_URL = process.argv[2] || "http://localhost:3050";
const CONCURRENCY = parseInt(process.argv[3] || "5", 10);
const ITERATIONS = parseInt(process.argv[4] || "20", 10);

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

async function runQuery(query, workspaceId = "test-workspace-id") {
  const url = `${BASE_URL}/api/search?workspaceId=${workspaceId}&q=${encodeURIComponent(query)}`;
  const start = performance.now();
  try {
    const res = await fetch(url);
    const elapsed = Math.round(performance.now() - start);
    return { query, status: res.status, elapsed, error: null };
  } catch (err) {
    const elapsed = Math.round(performance.now() - start);
    return { query, status: 0, elapsed, error: err.message };
  }
}

async function main() {
  console.log(`\nSearch Load Test`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Iterations: ${ITERATIONS}`);
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

  const timings = results.map((r) => r.elapsed);
  const sorted = [...timings].sort((a, b) => a - b);
  const pick = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * (sorted.length - 1)))];
  const errors = results.filter((r) => r.error || r.status !== 200);

  console.log(`Results:`);
  console.log(`  Total:  ${results.length}`);
  console.log(`  Errors: ${errors.length} (${((errors.length / results.length) * 100).toFixed(1)}%)`);
  console.log(`  p50:    ${pick(50)}ms`);
  console.log(`  p95:    ${pick(95)}ms`);
  console.log(`  p99:    ${pick(99)}ms`);
  console.log(`  min:    ${sorted[0]}ms`);
  console.log(`  max:    ${sorted[sorted.length - 1]}ms\n`);

  if (pick(95) > 500) {
    console.log(`p95 exceeds 500ms SLO target`);
    process.exit(1);
  } else {
    console.log(`p95 within 500ms SLO target`);
  }
}

main();
