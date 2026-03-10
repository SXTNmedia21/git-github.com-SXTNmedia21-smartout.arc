import type { Reporter, FullResult, TestCase, TestResult } from "@playwright/test/reporter";
import { createClient } from "@supabase/supabase-js";

const JOURNEY_TAG_PREFIX = "journey:";

class JourneyReporter implements Reporter {
  private results: Array<{
    journeySlug: string;
    testTitle: string;
    passed: boolean;
    durationMs: number;
    errorMessage?: string;
  }> = [];

  onTestEnd(test: TestCase, result: TestResult) {
    // Walk up the parent chain to find the journey:slug describe block
    let parent = test.parent;
    let journeySlug: string | null = null;
    while (parent) {
      if (parent.title?.startsWith(JOURNEY_TAG_PREFIX)) {
        journeySlug = parent.title.slice(JOURNEY_TAG_PREFIX.length);
        break;
      }
      parent = parent.parent;
    }

    if (!journeySlug) return;

    this.results.push({
      journeySlug,
      testTitle: test.title,
      passed: result.status === "passed",
      durationMs: result.duration,
      errorMessage: result.error?.message,
    });
  }

  async onEnd(_result: FullResult) {
    if (this.results.length === 0) return;

    const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
      console.warn(
        "[JourneyReporter] No SUPABASE_SERVICE_ROLE_KEY — skipping journey_test_run insert",
      );
      return;
    }

    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Group results by journeySlug — one test_run per journey
    const bySlug = new Map<
      string,
      { passed: boolean; totalMs: number; tests: typeof this.results; errors: string[] }
    >();

    for (const r of this.results) {
      const entry = bySlug.get(r.journeySlug) ?? {
        passed: true,
        totalMs: 0,
        tests: [],
        errors: [],
      };
      if (!r.passed) entry.passed = false;
      entry.totalMs += r.durationMs;
      entry.tests.push(r);
      if (r.errorMessage) entry.errors.push(`${r.testTitle}: ${r.errorMessage}`);
      bySlug.set(r.journeySlug, entry);
    }

    let written = 0;
    for (const [slug, data] of bySlug) {
      const { data: journey } = await supabase
        .from("journey")
        .select("journey_id, workspace_id")
        .eq("slug", slug)
        .maybeSingle();

      if (!journey) {
        console.warn(`[JourneyReporter] Journey not found for slug: ${slug}`);
        continue;
      }

      const { error } = await supabase.from("journey_test_run").insert({
        journey_id: journey.journey_id,
        workspace_id: journey.workspace_id,
        result: data.passed ? "pass" : "fail",
        test_type: "automated",
        duration_ms: data.totalMs,
        error_message: data.errors.length > 0 ? data.errors.join("\n") : null,
        test_output: {
          source: "playwright",
          timestamp: new Date().toISOString(),
          tests: data.tests.map((t) => ({
            title: t.testTitle,
            passed: t.passed,
            durationMs: t.durationMs,
          })),
        },
      });

      if (error) {
        console.warn(`[JourneyReporter] Failed to write test run for ${slug}: ${error.message}`);
      } else {
        written++;
      }
    }

    console.log(
      `[JourneyReporter] Wrote ${written} journey test run(s) for ${this.results.length} test(s)`,
    );
  }
}

export default JourneyReporter;
