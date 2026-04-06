/**
 * SSE Reporter — streams Playwright test events as JSON lines to stdout.
 *
 * Only active when E2E_SSE=1. Each event is a single JSON line, making it
 * easy for the platform-admin dashboard to consume via a server-sent events
 * endpoint that pipes this process's stdout.
 *
 * Event shape is intentionally flat and minimal — the dashboard only needs
 * enough to render live progress and a final summary.
 */
import type { Reporter, FullResult, TestCase, TestResult, Suite } from "@playwright/test/reporter";

// Emit a JSON line to stdout. Each event must be on its own line so the
// consumer can split on newlines without buffering partial JSON.
function emit(event: Record<string, unknown>) {
  process.stdout.write(JSON.stringify(event) + "\n");
}

// Extract just the filename from a full spec path so the dashboard can
// display "auth.spec.ts" instead of an absolute filesystem path.
function specFilename(test: TestCase): string {
  return test.location.file.split("/").pop() ?? test.location.file;
}

// Build a human-readable title by joining all ancestor suite titles with
// the test's own title, e.g. "journey:auth > Login > shows error on bad creds".
function fullTitle(test: TestCase): string {
  const parts: string[] = [];
  let node: Suite | undefined = test.parent;
  while (node) {
    if (node.title) parts.unshift(node.title);
    node = node.parent;
  }
  parts.push(test.title);
  return parts.join(" > ");
}

class SseReporter implements Reporter {
  // Only activate when E2E_SSE=1 — a no-op otherwise so it is safe to always
  // include in the reporter list and toggle purely via environment.
  private readonly active = process.env.E2E_SSE === "1";

  // Tracked during the run so onEnd can emit accurate counts without needing
  // access to the root Suite, which is not available in the onEnd callback.
  private passed = 0;
  private failed = 0;
  private skipped = 0;

  onBegin(_config: unknown, suite: Suite) {
    if (!this.active) return;

    // Collect a flat manifest of every test so the dashboard knows the total
    // before any test has started.
    const tests = suite.allTests().map((t) => ({
      spec: specFilename(t),
      title: fullTitle(t),
    }));

    emit({ type: "run_start", tests, total: tests.length });
  }

  onTestBegin(test: TestCase) {
    if (!this.active) return;

    emit({
      type: "step_start",
      spec: specFilename(test),
      test: fullTitle(test),
      status: "running",
    });
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (!this.active) return;

    // Map Playwright statuses to the simpler set the dashboard understands.
    const statusMap: Record<string, string> = {
      passed: "pass",
      failed: "fail",
      timedOut: "fail",
      interrupted: "fail",
      skipped: "skip",
    };

    const mapped = statusMap[result.status] ?? "fail";

    if (mapped === "pass") this.passed++;
    else if (mapped === "skip") this.skipped++;
    else this.failed++;

    const event: Record<string, unknown> = {
      type: "step_done",
      spec: specFilename(test),
      test: fullTitle(test),
      status: mapped,
      ms: result.duration,
    };

    // Include the error message when the test failed, but cap it so a single
    // massive stack trace does not overwhelm the SSE stream.
    if (result.error?.message) {
      event.error = result.error.message.slice(0, 500);
    }

    emit(event);
  }

  onStdOut(chunk: string | Buffer) {
    if (!this.active) return;

    // Emit each non-empty line separately so the consumer gets granular log
    // output rather than one blob containing embedded newlines.
    const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    for (const line of text.split("\n")) {
      if (line.trim()) emit({ type: "log", line });
    }
  }

  onEnd(result: FullResult) {
    if (!this.active) return;

    emit({
      type: "run_done",
      status: result.status,
      passed: this.passed,
      failed: this.failed,
      skipped: this.skipped,
      duration: result.duration,
    });
  }
}

export default SseReporter;
