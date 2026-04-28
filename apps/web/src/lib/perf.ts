import { recordPerf } from "./perf-store";

/**
 * Wraps an async call so its duration is logged + pushed to the in-memory
 * perf ring buffer. The ring buffer feeds /api/platform-admin/perf which
 * powers the health-page perf table — RSC can't attach Server-Timing headers
 * cleanly, so this is the diagnostic surface.
 *
 * Always records (dev + prod). Console output is dev-only to avoid prod noise.
 */
export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const elapsed = performance.now() - start;
    recordPerf(label, elapsed);
    if (process.env.NODE_ENV !== "production") {
      console.log(`[perf] ${label}: ${elapsed.toFixed(1)}ms`);
    }
  }
}
