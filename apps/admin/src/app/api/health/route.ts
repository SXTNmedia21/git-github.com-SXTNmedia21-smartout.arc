/**
 * route.ts — GET /api/health
 *
 * Liveness probe for Vercel and infrastructure health checks.
 * Always public — never gated by middleware auth.
 */
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ ok: true });
}
