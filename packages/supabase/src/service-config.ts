import { createAdminClient } from "./admin";
import type { Database } from "./database.types";

export type ServiceConfig = Database["public"]["Tables"]["service_config"]["Row"];

export type ServiceConfigInsert = Database["public"]["Tables"]["service_config"]["Insert"];

export type ServiceConfigUpdate = Database["public"]["Tables"]["service_config"]["Update"];

const CACHE_TTL_MS = 60_000; // 60 seconds

// In-memory cache (works for long-lived processes: Docker services, dev server)
const memoryCache = new Map<string, { data: ServiceConfig | null; expires: number }>();

// Redis cache (for serverless — Vercel)
let redis: {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, opts?: { ex: number }) => Promise<void>;
} | null = null;

async function getRedis() {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const { Redis } = await import("@upstash/redis");
    redis = new Redis({ url, token }) as unknown as typeof redis;
    return redis;
  } catch {
    return null;
  }
}

/** Get config for a single service by slug. Cached for 60s. */
export async function getServiceConfig(slug: string): Promise<ServiceConfig | null> {
  const cacheKey = `svc:${slug}`;
  const now = Date.now();

  // 1. Check memory cache
  const cached = memoryCache.get(cacheKey);
  if (cached && cached.expires > now) {
    return cached.data;
  }

  // 2. Check Redis cache (serverless environments)
  const redisClient = await getRedis();
  if (redisClient) {
    try {
      const redisValue = await redisClient.get(cacheKey);
      if (redisValue) {
        const parsed = JSON.parse(redisValue) as ServiceConfig | null;
        memoryCache.set(cacheKey, {
          data: parsed,
          expires: now + CACHE_TTL_MS,
        });
        return parsed;
      }
    } catch {
      // Redis unavailable — fall through to DB
    }
  }

  // 3. Fetch from DB
  const admin = createAdminClient();
  const { data, error } = await admin.from("service_config").select("*").eq("slug", slug).single();

  const config = error || !data ? null : data;

  // 4. Store in both caches
  memoryCache.set(cacheKey, { data: config, expires: now + CACHE_TTL_MS });
  if (redisClient) {
    try {
      await redisClient.set(cacheKey, JSON.stringify(config), { ex: 60 });
    } catch {
      // Non-critical
    }
  }

  return config;
}

/** Get ALL services (for admin UI listing) — not cached aggressively */
export async function getAllServiceConfigs(): Promise<ServiceConfig[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("service_config").select("*").order("name");

  if (error || !data) return [];
  return data;
}

/** Invalidate cache for a specific service (after config update) */
export async function invalidateServiceConfig(slug: string): Promise<void> {
  const cacheKey = `svc:${slug}`;
  memoryCache.delete(cacheKey);

  const redisClient = await getRedis();
  if (redisClient) {
    try {
      await redisClient.set(cacheKey, "null", { ex: 1 });
    } catch {
      // Non-critical
    }
  }
}

/** Get a specific config value from the JSONB config field */
export async function getServiceConfigValue(slug: string, key: string): Promise<string | null> {
  const config = await getServiceConfig(slug);
  if (!config) return null;

  const val = (config.config as Record<string, unknown>)[key];
  if (typeof val === "string") return val;
  if (val !== undefined) return String(val);

  return null;
}
