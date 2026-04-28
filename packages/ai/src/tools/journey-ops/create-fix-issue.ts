// ============================================
// create-fix-issue.ts — Open a GitHub issue from the agent
// When the journey-ops agent finds something broken, inconsistent, or
// piling up, it logs a fix request as a GitHub issue. Dedupes by title
// (won't reopen the same issue twice). Reuses the GITHUB_ERROR_TOKEN +
// GITHUB_ERROR_REPO env vars already configured for the error-reporter.
// ============================================

import { z } from "zod";
import { defineTool } from "../../types";
import type { JourneyOpsToolContext } from "./types";

const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
const CATEGORIES = [
  "binding",
  "step_validation",
  "convention",
  "data_model",
  "codebase",
  "docs",
  "duplicate",
  "stale",
  "other",
] as const;

export const createFixIssue = defineTool({
  name: "create_fix_issue",
  description:
    "Open a GitHub issue capturing a fix request the agent has discovered " +
    "(broken thing, inconsistency, debt piling up, missing piece). Dedupes " +
    "by title — if an open issue already exists with the same title, returns " +
    "that one instead of creating a duplicate. Use this to make agent " +
    "findings actionable instead of just reporting them in chat. Always " +
    "include enough context in summary that another developer can pick it up " +
    "without re-running the runbook.",
  schema: z.object({
    title: z
      .string()
      .min(8)
      .max(200)
      .describe("One-line headline. Avoid generic verbs — say what is wrong and which surface."),
    summary: z
      .string()
      .min(20)
      .describe(
        "Multi-line body. Cover: what is broken/missing, where (file path or journey code), " +
          "what was expected, evidence (sibling triggers, runbook output, validation issues), " +
          "and a suggested next step.",
      ),
    severity: z.enum(SEVERITIES).default("medium"),
    category: z.enum(CATEGORIES).default("other"),
    journey_id: z.string().uuid().nullish(),
    journey_code: z.string().nullish(),
    extra_labels: z
      .array(z.string())
      .max(8)
      .nullish()
      .describe("Additional GitHub labels beyond the defaults"),
  }),

  async execute(
    { title, summary, severity, category, journey_id, journey_code, extra_labels },
    ctx: JourneyOpsToolContext,
  ) {
    const token = process.env.GITHUB_ERROR_TOKEN;
    const repo = process.env.GITHUB_ERROR_REPO;
    if (!token || !repo) {
      return "GitHub fix-issue is not configured (missing GITHUB_ERROR_TOKEN or GITHUB_ERROR_REPO). Cannot open issue.";
    }

    const headlineTitle = `[journey-agent] ${title}`;

    // 1. Dedupe — search for an open issue with the exact same title.
    try {
      const searchRes = await fetch(
        `https://api.github.com/search/issues?q=${encodeURIComponent(
          `repo:${repo} is:issue is:open in:title "${headlineTitle}"`,
        )}&per_page=1`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (searchRes.ok) {
        const searchData = (await searchRes.json()) as {
          total_count: number;
          items?: Array<{ html_url: string; number: number }>;
        };
        if (searchData.total_count > 0 && searchData.items && searchData.items[0]) {
          return JSON.stringify({
            ok: true,
            deduped: true,
            existing_issue_url: searchData.items[0].html_url,
            existing_issue_number: searchData.items[0].number,
            note: "An open issue with this title already exists — not creating a duplicate.",
          });
        }
      }
    } catch (err) {
      // Search is best-effort. Fall through to create.
      console.warn(
        `[create_fix_issue] dedupe search failed: ${err instanceof Error ? err.message : err}`,
      );
    }

    // 2. Resolve linked journey context if a journey_id was passed and not
    // accompanied by a code (for nicer issue body).
    let resolvedCode: string | null = journey_code ?? null;
    let journeySlug: string | null = null;
    let journeyTitle: string | null = null;
    let journeyModule: string | null = null;
    const targetJourneyId = journey_id ?? ctx.currentJourneyId;
    if (targetJourneyId) {
      const { data } = await ctx.admin
        .from("journey")
        .select("code, slug, title, module")
        .eq("journey_id", targetJourneyId)
        .single();
      if (data) {
        resolvedCode = resolvedCode ?? data.code;
        journeySlug = data.slug;
        journeyTitle = data.title;
        journeyModule = data.module;
      }
    }

    // 3. Compose body + labels.
    const labels = ["journey-agent", `severity:${severity}`, `category:${category}`];
    if (extra_labels) {
      for (const l of extra_labels) {
        const trimmed = l.trim();
        if (trimmed && !labels.includes(trimmed)) labels.push(trimmed);
      }
    }

    const body = [
      `## Fix request — opened by journey-ops agent`,
      ``,
      `**Severity:** ${severity}`,
      `**Category:** ${category}`,
      ...(resolvedCode
        ? [
            `**Journey:** \`${resolvedCode}\`${journeySlug ? ` (\`${journeySlug}\`)` : ""}${
              journeyTitle ? ` — ${journeyTitle}` : ""
            }`,
          ]
        : []),
      ...(journeyModule ? [`**Module:** \`${journeyModule}\``] : []),
      ...(targetJourneyId ? [`**Journey id:** \`${targetJourneyId}\``] : []),
      `**Created:** ${new Date().toISOString()}`,
      ``,
      `### Description`,
      ``,
      summary,
      ``,
      `---`,
      `_Issue opened by the journey-ops agent in platform-admin. Edit, triage, or close as needed — the agent dedupes by title, so renaming will free the slot for a re-open._`,
    ].join("\n");

    // 4. Create the issue.
    let res: Response;
    try {
      res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: headlineTitle, body, labels }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (err) {
      return `GitHub create failed (network): ${err instanceof Error ? err.message : err}`;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return `GitHub create failed (${res.status}): ${text.slice(0, 400)}`;
    }

    const created = (await res.json()) as {
      html_url: string;
      number: number;
      title: string;
    };

    return JSON.stringify({
      ok: true,
      deduped: false,
      issue_url: created.html_url,
      issue_number: created.number,
      title: created.title,
      labels,
    });
  },
});
