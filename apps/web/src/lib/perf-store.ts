/**
 * In-memory ring buffer of perf samples. Module-level state — survives across
 * Server Component renders within a single dev/prod process. Last 500 samples,
 * fixed window so memory cost is bounded.
 *
 * Read by /api/platform-admin/perf to populate the platform-admin/health page.
 * Cleared on process restart.
 */
export type PerfSample = {
  label: string;
  ms: number;
  ts: number;
};

const MAX_SAMPLES = 500;
const samples: PerfSample[] = [];

export function recordPerf(label: string, ms: number): void {
  samples.push({ label, ms, ts: Date.now() });
  if (samples.length > MAX_SAMPLES) {
    samples.splice(0, samples.length - MAX_SAMPLES);
  }
}

export function getRecent(limit = MAX_SAMPLES): PerfSample[] {
  return samples.slice(-limit);
}

export function clearPerf(): void {
  samples.length = 0;
}
