import { NextResponse } from "next/server";
import path from "path";
import { listCompiledJourneys, listDraftJourneys } from "@/lib/journey-discovery";

export const dynamic = "force-dynamic";

export async function GET() {
  const repoRoot = path.resolve(process.cwd(), "../..");
  const [compiled, drafts] = await Promise.all([
    listCompiledJourneys(repoRoot),
    listDraftJourneys(repoRoot),
  ]);
  return NextResponse.json({ compiled, drafts });
}
