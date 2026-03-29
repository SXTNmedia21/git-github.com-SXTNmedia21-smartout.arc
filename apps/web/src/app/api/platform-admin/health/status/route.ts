import { NextResponse, type NextRequest } from "next/server";
import { getSuperAdminId } from "@/lib/platform-admin";
import { createAdminClient } from "@smartout/supabase/admin";
import { env } from "@/env";

type ServiceStatus = "operational" | "degraded" | "down";

type ServiceResult = {
  name: string;
  status: ServiceStatus;
  latency_ms: number | null;
  version: string | null;
  error: string | null;
};

type ExternalServiceConfig = {
  name: string;
  configured: boolean;
  envVar: string;
};

type IntegrityCheck = {
  name: string;
  status: "pass" | "warn" | "error";
  message: string;
};

type MetricsSnapshot = {
  total_users: number;
  total_workspaces: number;
  active_workspaces_24h: number;
  mrr_nok: number;
  computed_at: string;
} | null;

type ShiftLockHealth = {
  severity: "normal" | "warning" | "critical";
  total_attempts_24h: number;
  override_attempts_24h: number;
  override_rate_pct_24h: number;
  off_workspaces: number;
  shadow_workspaces: number;
  enforce_workspaces: number;
  active_workspaces: number;
  evaluated_at: string;
};

export type HealthStatusResponse = {
  overall: ServiceStatus;
  timestamp: string;
  services: ServiceResult[];
  external: ExternalServiceConfig[];
  integrity: IntegrityCheck[] | null;
  metrics: MetricsSnapshot;
  shift_lock: ShiftLockHealth | null;
};

const TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkSupabaseDb(): Promise<ServiceResult> {
  const start = Date.now();
  try {
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return {
        name: "Supabase DB",
        status: "down",
        latency_ms: 0,
        version: null,
        error: "Missing env vars",
      };
    }
    const res = await fetchWithTimeout(`${supabaseUrl}/rest/v1/company?select=company_id&limit=1`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
    return {
      name: "Supabase DB",
      status: res.ok ? "operational" : "degraded",
      latency_ms: Date.now() - start,
      version: "PostgreSQL 17",
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      name: "Supabase DB",
      status: "down",
      latency_ms: Date.now() - start,
      version: null,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

async function checkContractService(): Promise<ServiceResult> {
  const start = Date.now();
  const url = env.CONTRACT_SERVICE_URL;
  if (!url) {
    return {
      name: "Contract Service",
      status: "down",
      latency_ms: null,
      version: null,
      error: "Not configured",
    };
  }
  try {
    const res = await fetchWithTimeout(`${url}/health`);
    const latency = Date.now() - start;
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
      name: "Contract Service",
      status: res.ok ? "operational" : "degraded",
      latency_ms: latency,
      version,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      name: "Contract Service",
      status: "down",
      latency_ms: Date.now() - start,
      version: null,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

async function checkScraplingService(): Promise<ServiceResult> {
  const start = Date.now();
  const url = env.SCRAPLING_SERVICE_URL;
  if (!url) {
    return {
      name: "Scrapling Service",
      status: "down",
      latency_ms: null,
      version: null,
      error: "Not configured",
    };
  }
  try {
    const res = await fetchWithTimeout(`${url}/health`);
    const latency = Date.now() - start;
    return {
      name: "Scrapling Service",
      status: res.ok ? "operational" : "degraded",
      latency_ms: latency,
      version: null,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      name: "Scrapling Service",
      status: "down",
      latency_ms: Date.now() - start,
      version: null,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

async function checkShiftMcpService(): Promise<ServiceResult> {
  const start = Date.now();
  const url = env.SHIFT_MCP_URL;
  if (!url) {
    return {
      name: "Shift MCP",
      status: "down",
      latency_ms: null,
      version: null,
      error: "Not configured",
    };
  }
  try {
    const res = await fetchWithTimeout(`${url}/health`);
    const latency = Date.now() - start;
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
      name: "Shift MCP",
      status: res.ok ? "operational" : "degraded",
      latency_ms: latency,
      version,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      name: "Shift MCP",
      status: "down",
      latency_ms: Date.now() - start,
      version: null,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

async function checkSupabaseEdgeFunctions(): Promise<ServiceResult> {
  const start = Date.now();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return {
      name: "Edge Functions",
      status: "down",
      latency_ms: null,
      version: null,
      error: "Missing Supabase URL",
    };
  }
  try {
    const res = await fetchWithTimeout(`${supabaseUrl}/functions/v1/health-check`);
    return {
      name: "Edge Functions",
      status: res.ok ? "operational" : "degraded",
      latency_ms: Date.now() - start,
      version: null,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      name: "Edge Functions",
      status: "down",
      latency_ms: Date.now() - start,
      version: null,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

function checkExternalServices(): ExternalServiceConfig[] {
  return [
    { name: "Stripe", configured: !!env.STRIPE_SECRET_KEY, envVar: "STRIPE_SECRET_KEY" },
    { name: "SendGrid", configured: !!env.SENDGRID_API_KEY, envVar: "SENDGRID_API_KEY" },
    {
      name: "Twilio",
      configured: !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN),
      envVar: "TWILIO_ACCOUNT_SID",
    },
    {
      name: "DocuSeal",
      configured: !!env.DOCUSEAL_WEBHOOK_SECRET,
      envVar: "DOCUSEAL_WEBHOOK_SECRET",
    },
    {
      name: "PostHog",
      configured: !!env.NEXT_PUBLIC_POSTHOG_KEY,
      envVar: "NEXT_PUBLIC_POSTHOG_KEY",
    },
    { name: "Sentry", configured: !!env.SENTRY_DSN, envVar: "SENTRY_DSN" },
    {
      name: "Upstash Redis",
      configured: !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
      envVar: "UPSTASH_REDIS_REST_URL",
    },
    { name: "OpenRouter", configured: !!env.OPENROUTER_API_KEY, envVar: "OPENROUTER_API_KEY" },
  ];
}

async function runIntegrityChecks(): Promise<IntegrityCheck[]> {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return [{ name: "Integrity", status: "error", message: "Missing Supabase credentials" }];
  }
  try {
    const res = await fetchWithTimeout(`${supabaseUrl}/functions/v1/watchdog-integrity`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ check: "all" }),
    });
    if (!res.ok) {
      return [
        { name: "Integrity", status: "error", message: `Edge Function returned ${res.status}` },
      ];
    }
    const body = (await res.json()) as {
      checks?: Array<{ name: string; status: string; message: string }>;
    };
    if (body.checks && Array.isArray(body.checks)) {
      return body.checks.map((c) => ({
        name: c.name,
        status: (c.status === "pass" || c.status === "warn" || c.status === "error"
          ? c.status
          : "warn") as IntegrityCheck["status"],
        message: c.message,
      }));
    }
    return [{ name: "Integrity", status: "pass", message: "All checks passed" }];
  } catch (e) {
    return [
      {
        name: "Integrity",
        status: "error",
        message: e instanceof Error ? e.message : "Unknown error",
      },
    ];
  }
}

async function fetchMetrics(): Promise<MetricsSnapshot> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_metrics_daily")
      .select("total_users, total_workspaces, active_workspaces_24h, mrr_nok, computed_at")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return {
      total_users: data.total_users as number,
      total_workspaces: data.total_workspaces as number,
      active_workspaces_24h: data.active_workspaces_24h as number,
      mrr_nok: Number(data.mrr_nok),
      computed_at: data.computed_at as string,
    };
  } catch {
    return null;
  }
}

/**
 * Computes platform-level shift lock health for rollout governance.
 *
 * Why: platform-admin needs one place to detect risky override behavior
 * and emergency `off` mode usage across workspaces.
 *
 * @returns Aggregated shift lock health snapshot for alerting.
 */
async function fetchShiftLockHealth(): Promise<ShiftLockHealth | null> {
  try {
    const admin = createAdminClient();
    const windowStartIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [activeWorkspacesResult, policyRowsResult, totalAttemptsResult, overrideAttemptsResult] =
      await Promise.all([
        admin
          .from("workspace")
          .select("workspace_id", { count: "exact", head: true })
          .eq("is_active", true),
        admin.from("schedule_shift_lock_policy").select("workspace_id, lock_mode"),
        admin
          .from("schedule_shift_lock_audit")
          .select("id", { count: "exact", head: true })
          .gte("created_at", windowStartIso),
        admin
          .from("schedule_shift_lock_audit")
          .select("id", { count: "exact", head: true })
          .gte("created_at", windowStartIso)
          .eq("is_overridden_by_high_access", true),
      ]);

    const activeWorkspaces = activeWorkspacesResult.count ?? 0;
    const policyRows = policyRowsResult.data ?? [];
    const totalAttempts24h = totalAttemptsResult.count ?? 0;
    const overrideAttempts24h = overrideAttemptsResult.count ?? 0;

    const offWorkspaces = policyRows.filter((row) => row.lock_mode === "off").length;
    const shadowWorkspaces = policyRows.filter((row) => row.lock_mode === "shadow").length;
    const explicitEnforceWorkspaces = policyRows.filter(
      (row) => row.lock_mode === "enforce",
    ).length;
    const implicitEnforceWorkspaces = Math.max(
      0,
      activeWorkspaces - offWorkspaces - shadowWorkspaces - explicitEnforceWorkspaces,
    );
    const enforceWorkspaces = explicitEnforceWorkspaces + implicitEnforceWorkspaces;

    const overrideRatePct24h =
      totalAttempts24h === 0
        ? 0
        : Number(((overrideAttempts24h / totalAttempts24h) * 100).toFixed(2));

    // Alert thresholds (platform governance defaults)
    // - critical: any workspace in off mode OR override rate >= 15%
    // - warning: override rate >= 5%
    let severity: ShiftLockHealth["severity"] = "normal";
    if (offWorkspaces > 0 || overrideRatePct24h >= 15) severity = "critical";
    else if (overrideRatePct24h >= 5) severity = "warning";

    return {
      severity,
      total_attempts_24h: totalAttempts24h,
      override_attempts_24h: overrideAttempts24h,
      override_rate_pct_24h: overrideRatePct24h,
      off_workspaces: offWorkspaces,
      shadow_workspaces: shadowWorkspaces,
      enforce_workspaces: enforceWorkspaces,
      active_workspaces: activeWorkspaces,
      evaluated_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const includeIntegrity = req.nextUrl.searchParams.get("include") === "integrity";

  const [services, metrics, integrity, shiftLock] = await Promise.all([
    Promise.allSettled([
      checkSupabaseDb(),
      checkContractService(),
      checkScraplingService(),
      checkShiftMcpService(),
      checkSupabaseEdgeFunctions(),
    ]),
    fetchMetrics(),
    includeIntegrity ? runIntegrityChecks() : Promise.resolve(null),
    fetchShiftLockHealth(),
  ]);

  const serviceResults: ServiceResult[] = services.map((s) =>
    s.status === "fulfilled"
      ? s.value
      : {
          name: "Unknown",
          status: "down" as const,
          latency_ms: null,
          version: null,
          error: "Check failed",
        },
  );

  const external = checkExternalServices();

  // Compute overall status
  const hasDown = serviceResults.some((s) => s.status === "down" && s.error !== "Not configured");
  const hasDegraded = serviceResults.some((s) => s.status === "degraded");
  let overall: ServiceStatus = "operational";
  if (hasDown) overall = "down";
  else if (hasDegraded) overall = "degraded";

  const response: HealthStatusResponse = {
    overall,
    timestamp: new Date().toISOString(),
    services: serviceResults,
    external,
    integrity,
    metrics,
    shift_lock: shiftLock,
  };

  return NextResponse.json(response);
}
