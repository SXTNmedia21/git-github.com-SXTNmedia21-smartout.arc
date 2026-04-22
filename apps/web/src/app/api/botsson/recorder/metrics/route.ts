/**
 * GET /api/botsson/recorder/metrics
 *
 * ADR-0184 Phase 2a — godmode-only introspection into the Session Recorder
 * singleton. Proxies to stage-engine `GET /recorder/metrics` (see
 * services/stage-engine/src/routes/recorder-metrics.ts) and returns the
 * same JSON shape.
 *
 * Consumers:
 *   - `apps/e2e/tests/botsson-recorder/recorder-failure-resilience.spec.ts`
 *     asserts ADR-0184 Q8b invariant — recorder must NEVER block Emma. The
 *     spec induces a Supabase-level failure and reads this endpoint to
 *     confirm `recorder_blocking_emma: false` even as `error_count` climbs.
 *
 * Why godmode?
 *   Recorder state is platform-level — it spans every workspace. A
 *   workspace admin has no legitimate need to see the global counters, and
 *   surfacing them per-workspace would leak cross-tenant operational state.
 *
 * Approach A (stage-engine proxy) chosen over Approach B (DB-persisted
 * metrics) because:
 *   - Recorder getters (getBufferSize/getDropCount/getErrorCount) already
 *     exist on the singleton.
 *   - Eliminates a write-side dependency (a failing recorder would also
 *     fail at persisting its own metrics — catch-22).
 *   - Matches the existing BFF → stage-engine pattern used by
 *     apps/web/src/app/api/emma/chat/route.ts.
 */

import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { env } from "@/env";

const STAGE_ENGINE_URL = env.STAGE_ENGINE_URL ?? "http://localhost:5010";
const STAGE_ENGINE_API_KEY = env.STAGE_ENGINE_API_KEY;

export async function GET(_request: Request) {
  const supabase = await createClient();

  // 1. Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Godmode gate — recorder state is platform-level, workspace admins
  // have no business seeing cross-tenant counters.
  const { data: identity } = await supabase
    .from("user_identity")
    .select("user_id, is_godmode")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!identity?.is_godmode) {
    return NextResponse.json({ error: "Godmode required" }, { status: 403 });
  }

  // 3. Proxy to stage-engine. Include x-api-key so stage-engine's dual-auth
  // middleware accepts the call (service-to-service path).
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (STAGE_ENGINE_API_KEY) {
    headers["x-api-key"] = STAGE_ENGINE_API_KEY;
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${STAGE_ENGINE_URL}/recorder/metrics`, {
      method: "GET",
      headers,
      // Metrics must not be cached — each probe reflects current buffer state.
      cache: "no-store",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Stage-engine unreachable",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Stage-engine returned non-OK", status: upstream.status },
      { status: 502 },
    );
  }

  const body = (await upstream.json()) as {
    buffer_size: number;
    drop_count: number;
    error_count: number;
    recorder_blocking_emma: boolean;
  };

  // Guard: Q8b invariant is structural — if stage-engine ever returns true,
  // something is very wrong. We still forward the value so the E2E can fail
  // loudly rather than silently coerce.
  return NextResponse.json(body);
}
