/**
 * Central error reporter — sends errors to Sentry and optionally creates GitHub Issues.
 *
 * Server-side: reports to Sentry + creates GitHub issue (best-effort, never throws).
 * Client-side: reports to Sentry + calls /api/error-report for the GitHub leg.
 */
import * as Sentry from "@sentry/nextjs";

type ErrorReport = {
  title: string;
  error: Error;
  context?: Record<string, unknown>;
  severity?: "critical" | "error" | "warning";
};

/**
 * Reports an error to both Sentry and GitHub Issues.
 * Sentry captures the full stack trace and breadcrumbs.
 * GitHub issue creation is best-effort — never throws.
 */
export async function reportError({
  title,
  error,
  context,
  severity = "error",
}: ErrorReport): Promise<void> {
  Sentry.withScope((scope) => {
    scope.setLevel(severity === "critical" ? "fatal" : severity);
    if (context) {
      scope.setContext("error_context", context);
    }
    scope.setTag("auto_reported", "true");
    Sentry.captureException(error);
  });

  // GitHub issue creation is server-only — skip in the browser
  if (typeof window !== "undefined") return;

  try {
    await createGitHubIssue({ title, error, context, severity });
  } catch (ghErr) {
    console.error("[error-reporter] GitHub issue creation failed:", ghErr);
  }
}

/**
 * Creates a GitHub issue for the given error. Deduplicates by title — won't open
 * a duplicate if an open issue with the same title already exists.
 */
async function createGitHubIssue({ title, error, context, severity }: ErrorReport): Promise<void> {
  const token = process.env.GITHUB_ERROR_TOKEN;
  const repo = process.env.GITHUB_ERROR_REPO;

  // Silently skip if the reporter is not configured (e.g. local dev)
  if (!token || !repo) return;

  const searchRes = await fetch(
    `https://api.github.com/search/issues?q=${encodeURIComponent(`repo:${repo} is:issue is:open in:title "${title}"`)}&per_page=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      signal: AbortSignal.timeout(5000),
    },
  );

  if (searchRes.ok) {
    const searchData = (await searchRes.json()) as { total_count: number };
    if (searchData.total_count > 0) return;
  }

  const labels = ["bug", "auto-reported"];
  if (severity === "critical") labels.push("critical");

  const body = [
    `## Auto-reported error`,
    "",
    `**Severity:** ${severity}`,
    `**Time:** ${new Date().toISOString()}`,
    `**Environment:** ${process.env.NODE_ENV}`,
    `**Vercel URL:** ${process.env.VERCEL_URL ?? "unknown"}`,
    "",
    "### Error",
    "```",
    error.message,
    "```",
    "",
    "### Stack Trace",
    "```",
    error.stack ?? "No stack trace",
    "```",
    ...(context ? ["", "### Context", "```json", JSON.stringify(context, null, 2), "```"] : []),
    "",
    "---",
    "*This issue was auto-created by the Smartout error reporter.*",
  ].join("\n");

  await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: `[Auto] ${title}`, body, labels }),
    signal: AbortSignal.timeout(5000),
  });
}

/**
 * Client-side error reporter — sends to Sentry directly, and to /api/error-report
 * which handles the GitHub issue creation server-side.
 */
export async function reportErrorFromClient(
  title: string,
  error: Error,
  context?: Record<string, unknown>,
): Promise<void> {
  Sentry.withScope((scope) => {
    scope.setTag("auto_reported", "true");
    if (context) scope.setContext("error_context", context);
    Sentry.captureException(error);
  });

  try {
    await fetch("/api/error-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        message: error.message,
        stack: error.stack,
        context,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Best effort — Sentry already captured it above
  }
}
