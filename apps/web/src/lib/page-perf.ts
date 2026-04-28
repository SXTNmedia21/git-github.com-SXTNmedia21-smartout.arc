import { headers } from "next/headers";
import { recordPerf } from "./perf-store";

/**
 * Wraps a Server Component page function with end-to-end timing. The wrapper
 * resolves x-pathname (set by middleware) so route names are accurate without
 * per-page string args. Records into the perf ring buffer under
 * `page.<pathname>` and logs in dev.
 *
 * Usage:
 *   export default withPagePerf(async function PeoplePage() { ... });
 *
 * Note: only times the data-fetching/JSX-build phase of the page function.
 * RSC streaming + client hydration are NOT included — Next reports those
 * separately in dev as part of `render: Xms` per-request log.
 */
export function withPagePerf<P extends object>(
  page: (props: P) => Promise<React.ReactNode>,
): (props: P) => Promise<React.ReactNode> {
  return async function timedPage(props: P) {
    const start = performance.now();
    let label = "page.unknown";
    try {
      const path = (await headers()).get("x-pathname");
      if (path) label = `page.${path}`;
    } catch {
      // headers() can throw outside a request scope; fall through to "unknown"
    }
    try {
      return await page(props);
    } finally {
      const elapsed = performance.now() - start;
      recordPerf(label, elapsed);
      if (process.env.NODE_ENV !== "production") {
        console.log(`[perf] ${label}: ${elapsed.toFixed(1)}ms`);
      }
    }
  };
}
