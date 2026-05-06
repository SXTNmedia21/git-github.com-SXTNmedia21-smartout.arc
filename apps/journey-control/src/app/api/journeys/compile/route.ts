/**
 * POST /api/journeys/compile
 *
 * Reads a markdown journey draft from docs/journeys/JOURNEY-<draft_slug>.md,
 * compiles it to JourneyIR via the LLM compiler, and writes a runnable TS
 * protocol file to apps/e2e/protocols/.
 *
 * Env required: OPENROUTER_API_KEY
 *
 * Body: { draft_slug: string, desired_slug?: string }
 * - draft_slug: matches the suffix of JOURNEY-<draft_slug>.md in docs/journeys/
 * - desired_slug: uppercase-kebab like "P-002" to override LLM-chosen slug
 *
 * Returns:
 * - 200 { ok: true, slug, title, filePath, note }
 * - 400 { ok: false, error } — invalid body
 * - 404 { ok: false, error } — draft file not found
 * - 422 { ok: false, error } — LLM returned invalid IR
 * - 500 { ok: false, error } — missing env var
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { compileMarkdownToIR } from "@/lib/journey-compiler";
import { emitIRToTypescript } from "@/lib/ir-ts-emitter";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  draft_slug: z.string().min(1),
  desired_slug: z
    .string()
    .regex(/^[A-Z0-9-]+$/)
    .optional(),
});

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "OPENROUTER_API_KEY not set in environment" },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 },
    );
  }

  // Resolve docs/journeys/ relative to repo root.
  // apps/journey-control/src/app/api/journeys/compile → 8 levels up to repo root.
  // Using process.cwd() which Next.js sets to the app directory during dev/build.
  const appDir = process.cwd(); // .../apps/journey-control
  const repoRoot = path.resolve(appDir, "../..");
  const mdPath = path.join(repoRoot, "docs/journeys", `JOURNEY-${parsed.data.draft_slug}.md`);

  let markdown: string;
  try {
    markdown = await fs.readFile(mdPath, "utf8");
  } catch {
    return NextResponse.json({ ok: false, error: `Draft not found: ${mdPath}` }, { status: 404 });
  }

  const result = await compileMarkdownToIR({
    markdown,
    apiKey,
    desiredSlug: parsed.data.desired_slug,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }

  // Write compiled TS file to apps/e2e/protocols/.
  const tsContent = emitIRToTypescript(result.ir);
  const tsFileName = `${result.ir.slug}-${parsed.data.draft_slug}.ts`;
  const tsPath = path.join(repoRoot, "apps/e2e/protocols", tsFileName);
  await fs.writeFile(tsPath, tsContent, "utf8");

  return NextResponse.json({
    ok: true,
    slug: result.ir.slug,
    title: result.ir.title,
    filePath: tsPath,
    note: "Remember to add to apps/e2e/protocols/index.ts PROTOCOL_REGISTRY before running.",
  });
}
