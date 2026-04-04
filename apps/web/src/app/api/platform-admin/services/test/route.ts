import { NextResponse, type NextRequest } from "next/server";
import { getSuperAdminId } from "@/lib/platform-admin";
import { env } from "@/env";

const TIMEOUT_MS = 10_000;

// In production, missing service URLs are a hard error rather than silently falling
// back to localhost (which would always fail and mask misconfiguration).
function requireInProd(name: string, fallback: string): string {
  const val = process.env[name];
  if (!val && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return val ?? fallback;
}

const SERVICE_URLS: Record<string, string | undefined> = {
  "stage-engine": requireInProd("STAGE_ENGINE_URL", "http://localhost:5010"),
  "shift-mcp": requireInProd("SHIFT_MCP_URL", "http://localhost:5011"),
  "contract-service": requireInProd("CONTRACT_SERVICE_URL", "http://localhost:5012"),
  scrapling: requireInProd("SCRAPLING_SERVICE_URL", "http://localhost:8000"),
  supabase: env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
  caddy: requireInProd("CADDY_URL", "http://localhost:80"),
};

export type TestResult = {
  status: number;
  ok: boolean;
  responseTime: number;
  headers: Record<string, string>;
  body: unknown;
  error?: string;
};

export async function POST(req: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const {
    serviceKey,
    method,
    path,
    body,
    headers: extraHeaders,
  } = (await req.json()) as {
    serviceKey: string;
    method: string;
    path: string;
    body?: unknown;
    headers?: Record<string, string>;
  };

  const baseUrl = SERVICE_URLS[serviceKey];
  if (!baseUrl) {
    return NextResponse.json({ error: `Unknown service: ${serviceKey}` }, { status: 400 });
  }

  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();

  try {
    const fetchHeaders: Record<string, string> = {
      ...(extraHeaders ?? {}),
    };

    // Add auth headers for services that need them
    if (serviceKey === "supabase" && env.SUPABASE_SERVICE_ROLE_KEY) {
      fetchHeaders["apikey"] = env.SUPABASE_SERVICE_ROLE_KEY;
      fetchHeaders["Authorization"] = `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`;
    }
    if (serviceKey === "stage-engine" && env.STAGE_ENGINE_API_KEY) {
      fetchHeaders["x-api-key"] = env.STAGE_ENGINE_API_KEY;
    }
    if (serviceKey === "contract-service" && env.CONTRACT_SERVICE_KEY) {
      fetchHeaders["X-Service-Key"] = env.CONTRACT_SERVICE_KEY;
    }
    if (serviceKey === "scrapling" && env.SCRAPLING_AUTH_TOKEN) {
      fetchHeaders["Authorization"] = `Bearer ${env.SCRAPLING_AUTH_TOKEN}`;
    }

    if (body && !fetchHeaders["Content-Type"]) {
      fetchHeaders["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      method: method.toUpperCase(),
      signal: controller.signal,
      redirect: "manual",
      headers: fetchHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseTime = Date.now() - start;

    // Read response body
    let responseBody: unknown;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        responseBody = await res.json();
      } catch {
        responseBody = await res.text();
      }
    } else {
      const text = await res.text();
      responseBody = text.length > 2000 ? text.slice(0, 2000) + "..." : text;
    }

    // Collect response headers
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const result: TestResult = {
      status: res.status,
      ok: res.ok || (res.status >= 300 && res.status < 400),
      responseTime,
      headers: responseHeaders,
      body: responseBody,
    };

    return NextResponse.json(result);
  } catch (e) {
    const result: TestResult = {
      status: 0,
      ok: false,
      responseTime: Date.now() - start,
      headers: {},
      body: null,
      error: e instanceof Error ? e.message : "Unknown error",
    };
    return NextResponse.json(result);
  } finally {
    clearTimeout(timeout);
  }
}
