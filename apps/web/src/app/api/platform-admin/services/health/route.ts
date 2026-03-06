import { NextResponse } from "next/server";
import { getSuperAdminId } from "@/lib/platform-admin";
import { createAdminClient } from "@smartout/supabase/admin";
import { env } from "@/env";

type ServiceStatus = "healthy" | "degraded" | "down";

type ServiceResult = {
  name: string;
  url: string;
  status: ServiceStatus;
  responseTime: number | null;
  checkedAt: string;
  version: string | null;
  error?: string;
};

export type ServicesHealthResponse = {
  services: ServiceResult[];
};

const TIMEOUT_MS = 5000;

type HealthCheckEntry = {
  name: string;
  slug: string;
  url: string;
  healthPath: string;
  headers?: Record<string, string>;
  acceptRedirect?: boolean;
};

/** Build health check entries from service_config table + special overrides */
async function getHealthCheckEntries(): Promise<HealthCheckEntry[]> {
  const admin = createAdminClient();
  const { data: services } = await admin
    .from("service_config")
    .select("name, slug, host_url, health_endpoint, type, status")
    .in("type", ["docker", "edge-function"])
    .eq("status", "active")
    .order("name");

  const entries: HealthCheckEntry[] = [];

  for (const svc of services ?? []) {
    if (!svc.host_url || !svc.health_endpoint) continue;

    const entry: HealthCheckEntry = {
      name: svc.slug,
      slug: svc.slug,
      url: svc.host_url,
      healthPath: svc.health_endpoint,
    };

    // Special headers for Supabase
    if (svc.slug === "supabase") {
      entry.url = env.NEXT_PUBLIC_SUPABASE_URL ?? svc.host_url;
      entry.headers = {
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      };
    }

    // Caddy accepts redirects
    if (svc.slug === "caddy") {
      entry.acceptRedirect = true;
    }

    entries.push(entry);
  }

  // Fallback: if DB is empty (first boot), add hardcoded essentials
  if (entries.length === 0) {
    entries.push(
      {
        name: "supabase",
        slug: "supabase",
        url: env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
        healthPath: "/rest/v1/",
        headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
      },
      {
        name: "stage-engine",
        slug: "stage-engine",
        url: env.STAGE_ENGINE_URL ?? "http://localhost:5010",
        healthPath: "/health",
      },
    );
  }

  return entries;
}

async function checkService(entry: HealthCheckEntry): Promise<ServiceResult> {
  const checkedAt = new Date().toISOString();

  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${entry.url}${entry.healthPath}`, {
      signal: controller.signal,
      redirect: entry.acceptRedirect ? "manual" : "follow",
      headers: entry.headers,
    });
    const responseTime = Date.now() - start;

    const isHealthy =
      res.ok ||
      (entry.acceptRedirect && res.status >= 300 && res.status < 400);

    let version: string | null = null;
    if (res.ok) {
      try {
        const body = (await res.json()) as { version?: string };
        version = body.version ?? null;
      } catch {
        // ignore parse errors
      }
    }

    return {
      name: entry.name,
      url: entry.url,
      status: isHealthy ? "healthy" : "degraded",
      responseTime,
      checkedAt,
      version,
      error: isHealthy ? undefined : `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      name: entry.name,
      url: entry.url,
      status: "down",
      responseTime: Date.now() - start,
      checkedAt,
      version: null,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const adminId = await getSuperAdminId();
  if (!adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entries = await getHealthCheckEntries();
  const results = await Promise.allSettled(entries.map(checkService));

  const services: ServiceResult[] = results.map((r, i) => {
    const entry = entries[i];
    return r.status === "fulfilled"
      ? r.value
      : {
          name: entry?.name ?? "unknown",
          url: entry?.url ?? "",
          status: "down" as const,
          responseTime: null,
          checkedAt: new Date().toISOString(),
          version: null,
          error: "Check failed",
        };
  });

  return NextResponse.json({ services } satisfies ServicesHealthResponse);
}
