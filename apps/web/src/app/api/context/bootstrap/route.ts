import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildBootstrapContext } from "@/lib/context/build-bootstrap-context";

const BootstrapQuerySchema = z.object({
  workspaceId: z.string().min(1),
  profileId: z.string().min(1),
  pageId: z.string().min(1).default("dashboard"),
});

export async function GET(req: NextRequest) {
  const parsed = BootstrapQuerySchema.safeParse({
    workspaceId: req.nextUrl.searchParams.get("workspaceId"),
    profileId: req.nextUrl.searchParams.get("profileId"),
    pageId: req.nextUrl.searchParams.get("pageId") ?? "dashboard",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Missing or invalid workspaceId/profileId/pageId" },
      { status: 400 },
    );
  }

  try {
    const context = await buildBootstrapContext(parsed.data);
    return NextResponse.json(context, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to build bootstrap context" }, { status: 500 });
  }
}
