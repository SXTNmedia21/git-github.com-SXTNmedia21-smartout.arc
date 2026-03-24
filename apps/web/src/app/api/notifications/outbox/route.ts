import { NextResponse } from "next/server";

export async function POST() {
  // Server-side bridge for the telemetry notifications destination.
  // The actual recipient routing happens in the outbox consumer.
  // For now, this is a no-op placeholder — telemetry events that need
  // specific recipients should use the engine-dispatch path instead.

  return NextResponse.json({ ok: true });
}
