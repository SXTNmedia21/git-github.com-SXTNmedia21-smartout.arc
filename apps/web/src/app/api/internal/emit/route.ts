// ============================================
// apps/web/src/app/api/internal/emit/route.ts
// Bridge endpoint: Supabase Edge Functions (Deno) POST SmartoutEvent
// payloads here, we invoke emit() on the Node side. Edge Functions
// cannot import @smartout/telemetry directly (Deno/Node boundary).
//
// Phase 2 Task 2.2 of Billing Engine Fase 1. Expected primary caller:
// Phase 4 generate-monthly-invoices cron.
//
// Guard: shared secret WATCHDOG_CRON_SECRET (same secret the other cron
// Edge Functions already carry — see supabase/functions/ops-monitor and
// supabase/functions/watchdog-uptime). Missing or mismatched secret ->
// 401. Missing event name -> 400. Downstream emit() errors -> 500.
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { emit } from "@smartout/telemetry";
import type { SmartoutEvent } from "@smartout/telemetry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const expected = process.env.WATCHDOG_CRON_SECRET;
  if (!expected) {
    console.error(
      "[api/internal/emit] WATCHDOG_CRON_SECRET is not configured on this deployment. Refusing to accept events.",
    );
    return NextResponse.json({ error: "server_not_configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !("event" in payload) ||
    typeof (payload as { event: unknown }).event !== "string" ||
    !(payload as { event: string }).event
  ) {
    return NextResponse.json({ error: "invalid_event" }, { status: 400 });
  }

  try {
    await emit(payload as SmartoutEvent);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/internal/emit] emit() failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
