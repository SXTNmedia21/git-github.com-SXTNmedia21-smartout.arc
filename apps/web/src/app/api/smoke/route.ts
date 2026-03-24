/**
 * Public health check endpoint — no auth required.
 * Verifies that core Supabase services (REST + Auth) are reachable.
 * Used by the join wizard and external monitoring tools.
 * Returns 200 if all services are up, 503 if any are down.
 */

import { NextResponse } from "next/server";

type ServiceCheck = {
  name: string;
  ok: boolean;
  latency_ms: number;
  error?: string;
};

type SmokeResponse = {
  ok: boolean;
  timestamp: string;
  services: ServiceCheck[];
};

async function checkSupabaseRest(): Promise<ServiceCheck> {
  const start = Date.now();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return { name: "supabase-rest", ok: false, latency_ms: 0, error: "Not configured" };
  }

  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(5000),
    });
    return {
      name: "supabase-rest",
      ok: res.ok,
      latency_ms: Date.now() - start,
      ...(!res.ok ? { error: `HTTP ${res.status}` } : {}),
    };
  } catch (e) {
    return {
      name: "supabase-rest",
      ok: false,
      latency_ms: Date.now() - start,
      error: e instanceof Error ? e.message : "Unknown",
    };
  }
}

async function checkSupabaseAuth(): Promise<ServiceCheck> {
  const start = Date.now();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return { name: "supabase-auth", ok: false, latency_ms: 0, error: "Not configured" };
  }

  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(5000),
    });
    return {
      name: "supabase-auth",
      ok: res.ok,
      latency_ms: Date.now() - start,
      ...(!res.ok ? { error: `HTTP ${res.status}` } : {}),
    };
  } catch (e) {
    return {
      name: "supabase-auth",
      ok: false,
      latency_ms: Date.now() - start,
      error: e instanceof Error ? e.message : "Unknown",
    };
  }
}

export async function GET() {
  const services = await Promise.all([checkSupabaseRest(), checkSupabaseAuth()]);

  const allOk = services.every((s) => s.ok);

  const response: SmokeResponse = {
    ok: allOk,
    timestamp: new Date().toISOString(),
    services,
  };

  return NextResponse.json(response, {
    status: allOk ? 200 : 503,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
