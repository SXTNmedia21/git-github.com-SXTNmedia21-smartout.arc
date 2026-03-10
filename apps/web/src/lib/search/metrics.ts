/**
 * Search metrics helpers.
 *
 * Why this exists:
 * Keep search latency telemetry small and deterministic while the
 * observability pipeline is still lightweight and in-process.
 */

type Percentile = 50 | 95 | 99;

/**
 * Computes a nearest-rank percentile from a sorted list of values.
 * Returns 0 for empty samples.
 */
function getPercentile(sortedAscending: readonly number[], percentile: Percentile): number {
  if (sortedAscending.length === 0) {
    return 0;
  }

  // Nearest-rank method: rank = ceil(p/100 * N), 1-indexed.
  const rank = Math.ceil((percentile / 100) * sortedAscending.length);
  const index = Math.min(sortedAscending.length - 1, Math.max(0, rank - 1));
  return sortedAscending[index] ?? 0;
}

/**
 * Summarizes raw latency samples into the core SLO percentiles.
 */
export function summarizeLatency(values: number[]) {
  const sanitized = values
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((left, right) => left - right);

  return {
    p50: getPercentile(sanitized, 50),
    p95: getPercentile(sanitized, 95),
    p99: getPercentile(sanitized, 99),
  };
}

export type SearchMetrics = {
  query: string;
  mode: string;
  timing_ms: number;
  result_count: number;
  timestamp: string;
};

const METRICS_BUFFER: SearchMetrics[] = [];
const MAX_BUFFER_SIZE = 1000;

export function recordSearchMetric(metric: SearchMetrics) {
  if (!Number.isFinite(metric.timing_ms) || metric.timing_ms < 0) {
    return;
  }

  METRICS_BUFFER.push(metric);
  if (METRICS_BUFFER.length > MAX_BUFFER_SIZE) {
    METRICS_BUFFER.shift();
  }
}

export function getSearchMetrics(): readonly SearchMetrics[] {
  return METRICS_BUFFER;
}

export function getSearchLatencySummary() {
  const timings = METRICS_BUFFER.map((m) => m.timing_ms);
  return {
    ...summarizeLatency(timings),
    total_queries: METRICS_BUFFER.length,
  };
}
