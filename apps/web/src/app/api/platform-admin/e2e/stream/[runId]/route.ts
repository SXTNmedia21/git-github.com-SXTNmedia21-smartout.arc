/**
 * SSE stream endpoint for live E2E test run output.
 *
 * Clients connect here after starting a run via POST /api/platform-admin/e2e/run.
 * The endpoint polls the shared `activeRuns` Map every 200ms and forwards any new
 * output lines as SSE events. The stream closes automatically once the run is
 * marked done and all lines have been sent.
 */

import { type NextRequest } from "next/server";
import { getSuperAdminId } from "@/lib/platform-admin";
import { activeRuns } from "../../run/route";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const adminId = await getSuperAdminId();
  if (!adminId) {
    return new Response("Forbidden", { status: 403 });
  }

  const { runId } = await params;
  const run = activeRuns.get(runId);

  if (!run) {
    return new Response("Run not found", { status: 404 });
  }

  const stream = new ReadableStream({
    start(controller) {
      // Track how many lines we have already sent to avoid re-sending
      let cursor = 0;

      const interval = setInterval(() => {
        // Send every line that arrived since the last tick
        while (cursor < run.lines.length) {
          const line = run.lines[cursor] ?? "";
          cursor++;

          // Forward valid JSON as-is; wrap plain strings so clients always
          // receive a consistent JSON payload they can parse safely
          let payload: string;
          try {
            JSON.parse(line);
            payload = line;
          } catch {
            payload = JSON.stringify({ type: "log", line });
          }

          controller.enqueue(`data: ${payload}\n\n`);
        }

        // Close the stream once the run is finished and we have caught up
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
