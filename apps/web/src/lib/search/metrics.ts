export function summarizeLatency(values: number[]) {
  if (values.length === 0) return { p50: 0, p95: 0, p99: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (p: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * (sorted.length - 1)))] ?? 0;
  return { p50: pick(50), p95: pick(95), p99: pick(99) };
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
