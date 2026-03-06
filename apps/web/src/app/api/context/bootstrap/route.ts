import { type NextRequest, NextResponse } from "next/server";
import { buildBootstrapContext } from "@/lib/context/build-bootstrap-context";

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  const profileId = req.nextUrl.searchParams.get("profileId");
  const pageId = req.nextUrl.searchParams.get("pageId") ?? "dashboard";

  if (!workspaceId || !profileId) {
    return NextResponse.json({ error: "Missing workspaceId or profileId" }, { status: 400 });
  }

  const context = await buildBootstrapContext({ workspaceId, profileId, pageId });

  return NextResponse.json(context, {
    headers: {
      "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
    },
  });
}
