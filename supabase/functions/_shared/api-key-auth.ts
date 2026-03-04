import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const pool = new Pool(Deno.env.get("DATABASE_URL") ?? Deno.env.get("SUPABASE_DB_URL")!, 3, true);

export interface ApiKeyContext {
  keyId: string;
  workspaceId: string | null;
  keyType: "workspace" | "service";
  scopes: string[];
  rateLimitPerMinute: number;
  environment: "live" | "test";
}

export async function validateApiKey(plaintextKey: string): Promise<ApiKeyContext | null> {
  const keyHash = await sha256(plaintextKey);
  const conn = await pool.connect();

  try {
    const result = await conn.queryObject<{
      id: string;
      workspace_id: string | null;
      key_type: string;
      scopes: string[];
      rate_limit_per_minute: number;
      environment: "live" | "test";
    }>(
      `
      UPDATE platform_api_key
      SET last_used_at = now()
      WHERE key_hash = $1
        AND version IN ('current', 'previous')
        AND (expires_at IS NULL OR expires_at > now())
        AND (grace_period_ends_at IS NULL OR grace_period_ends_at > now())
      RETURNING id, workspace_id, key_type, scopes, rate_limit_per_minute, environment
    `,
      [keyHash],
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      keyId: row.id,
      workspaceId: row.workspace_id,
      keyType: row.key_type as "workspace" | "service",
      scopes: row.scopes ?? [],
      rateLimitPerMinute: row.rate_limit_per_minute ?? 60,
      environment: row.environment,
    };
  } finally {
    conn.release();
  }
}

export async function executeWithWorkspaceContext<T>(
  workspaceId: string,
  query: string,
  params: unknown[],
): Promise<T[]> {
  const conn = await pool.connect();
  try {
    await conn.queryArray("BEGIN");
    await conn.queryArray("SET LOCAL ROLE authenticated");
    await conn.queryArray("SELECT set_config('app.workspace_id', $1, true)", [workspaceId]);

    const result = await conn.queryObject<T>(query, params);

    await conn.queryArray("COMMIT");
    return result.rows;
  } catch (err) {
    await conn.queryArray("ROLLBACK");
    throw err;
  } finally {
    conn.release();
  }
}

export async function logUsage(keyId: string, endpoint: string, statusCode: number): Promise<void> {
  const conn = await pool.connect();
  try {
    // Hourly bucket: truncate to hour
    await conn.queryObject(
      `INSERT INTO platform_api_key_usage (api_key_id, endpoint, hour_bucket, request_count, error_count)
       VALUES ($1, $2, date_trunc('hour', now()), 1, $3)
       ON CONFLICT (api_key_id, endpoint, hour_bucket)
       DO UPDATE SET
         request_count = platform_api_key_usage.request_count + 1,
         error_count = platform_api_key_usage.error_count + $3`,
      [keyId, endpoint, statusCode >= 400 ? 1 : 0],
    );
  } catch (err) {
    // Usage logging should never block the response
    console.error("[usage-tracking]", err);
  } finally {
    conn.release();
  }
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
