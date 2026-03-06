import { NextResponse } from "next/server";
import { getSuperAdminId } from "@/lib/platform-admin";
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

type ServiceEntry = {
  name: string;
  url: string | undefined;
  healthPath: string;
  headers?: Record<string, string>;
  acceptRedirect?: boolean;
};

function getServiceEntries(): ServiceEntry[] {
  return [
    {
      name: "caddy",
      url: "http://localhost:80",
      healthPath: "/",
      acceptRedirect: true,
    },
    {
      name: "supabase",
      url: env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
      healthPath: "/rest/v1/",
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      },
    },
    {
      name: "stage-engine",
      url: env.STAGE_ENGINE_URL ?? "http://localhost:5010",
      healthPath: "/health",
    },
    {
      name: "shift-mcp",
      url: env.SHIFT_MCP_URL ?? "http://localhost:5011",
      healthPath: "/health",
    },
    {
      name: "contract-service",
      url: env.CONTRACT_SERVICE_URL ?? "http://localhost:5012",
      healthPath: "/health",
    },
    {
      name: "scrapling",
      url: env.SCRAPLING_SERVICE_URL ?? "http://localhost:8000",
      healthPath: "/health",
    },
  ];
}

async function checkService(entry: ServiceEntry): Promise<ServiceResult> {
  const checkedAt = new Date().toISOString();
  const baseUrl = entry.url;

  if (!baseUrl) {
    return {
      name: entry.name,
      url: "",
      status: "down",
      responseTime: null,
      checkedAt,
      version: null,
      error: "Not configured",
    };
  }

  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}${entry.healthPath}`, {
      signal: controller.signal,
      redirect: entry.acceptRedirect ? "manual" : "follow",
      headers: entry.headers,
    });
    const responseTime = Date.now() - start;

    const isHealthy = res.ok || (entry.acceptRedirect && res.status >= 300 && res.status < 400);

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
      url: baseUrl,
      status: isHealthy ? "healthy" : "degraded",
      responseTime,
      checkedAt,
      version,
      error: isHealthy ? undefined : `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      name: entry.name,
      url: baseUrl,
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

  const entries = getServiceEntries();
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
