import { NextResponse, type NextRequest } from "next/server";
import { reportError } from "@/lib/error-reporter";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      title: string;
      message: string;
      stack?: string;
      context?: Record<string, unknown>;
    };

    const error = new Error(body.message);
    if (body.stack) error.stack = body.stack;

    await reportError({
      title: body.title,
      error,
      context: {
        ...body.context,
        source: "client",
        userAgent: req.headers.get("user-agent") ?? "unknown",
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
