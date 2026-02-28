/**
 * @smartout/notifications — Rate limiting
 *
 * Per-admin and global rate limits for outbound email.
 * Uses Upstash Redis when available, falls back to in-memory Map.
 */

import type { EmailClassification } from "./types";

export const RECIPIENT_SOFT_CAP = 500;
export const RECIPIENT_HARD_CAP = 2000;

const PER_ADMIN_LIMIT = 10; // per hour
const GLOBAL_LIMIT = 25; // per hour
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

type RateLimitResult = {
  allowed: boolean;
  reason?: string;
  remaining?: number;
};

// In-memory fallback store
const memoryStore = new Map<string, Array<number>>();

function cleanExpired(key: string): number[] {
  const now = Date.now();
  const entries = memoryStore.get(key) ?? [];
  const valid = entries.filter((ts) => now - ts < WINDOW_MS);
  memoryStore.set(key, valid);
  return valid;
}

async function tryRedisIncrement(key: string, limit: number): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  try {
    // Use Upstash REST API directly to avoid requiring @upstash/redis at runtime
    // INCR the key
    const incrRes = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const incrData = (await incrRes.json()) as { result: number };
    const current = incrData.result;

    // Set TTL on first increment
    if (current === 1) {
      await fetch(`${url}/expire/${encodeURIComponent(key)}/3600`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    if (current > limit) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${current}/${limit} per hour`,
        remaining: 0,
      };
    }

    return { allowed: true, remaining: limit - current };
  } catch {
    // Redis unavailable — fall through to memory
    return null;
  }
}

function memoryIncrement(key: string, limit: number): RateLimitResult {
  const valid = cleanExpired(key);
  if (valid.length >= limit) {
    return {
      allowed: false,
      reason: `Rate limit exceeded: ${valid.length}/${limit} per hour`,
      remaining: 0,
    };
  }
  valid.push(Date.now());
  memoryStore.set(key, valid);
  return { allowed: true, remaining: limit - valid.length };
}

export async function checkRateLimit(
  adminId: string,
  type: EmailClassification,
): Promise<RateLimitResult> {
  // Transactional emails bypass rate limits
  if (type === "transactional") {
    return { allowed: true };
  }

  // Check per-admin limit
  const adminKey = `email:ratelimit:admin:${adminId}`;
  const adminResult =
    (await tryRedisIncrement(adminKey, PER_ADMIN_LIMIT)) ??
    memoryIncrement(adminKey, PER_ADMIN_LIMIT);

  if (!adminResult.allowed) return adminResult;

  // Check global limit
  const globalKey = "email:ratelimit:global";
  const globalResult =
    (await tryRedisIncrement(globalKey, GLOBAL_LIMIT)) ?? memoryIncrement(globalKey, GLOBAL_LIMIT);

  if (!globalResult.allowed) return globalResult;

  return {
    allowed: true,
    remaining: Math.min(adminResult.remaining ?? 0, globalResult.remaining ?? 0),
  };
}
