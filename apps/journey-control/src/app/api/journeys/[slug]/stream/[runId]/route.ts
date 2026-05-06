import { type NextRequest } from "next/server";
import { activeRuns } from "@/lib/journey-runner";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string; runId: string }> },
) {
  const { runId } = await ctx.params;
  const run = activeRuns.get(runId);
  if (!run) return new Response("Run not found", { status: 404 });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let cursor = 0;

      const interval = setInterval(() => {
        while (cursor < run.lines.length) {
          controller.enqueue(encoder.encode(`data: ${run.lines[cursor]}\n\n`));
          cursor++;
        }
        if (run.done && cursor >= run.lines.length) {
          clearInterval(interval);
          controller.close();
        }
      }, 200);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
