import { NextResponse, type NextRequest } from "next/server";
import path from "path";
import { z } from "zod";
import { startRun } from "@/lib/journey-runner";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  speed_profile: z.enum(["full", "normal", "ai_companion"]).default("full"),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }

  const repoRoot = path.resolve(process.cwd(), "../..");
  const result = startRun({
    slug,
    speedProfile: parsed.data.speed_profile,
    repoRoot,
  });

  if (!result.ok) return NextResponse.json(result, { status: 409 });
  return NextResponse.json(result);
}
