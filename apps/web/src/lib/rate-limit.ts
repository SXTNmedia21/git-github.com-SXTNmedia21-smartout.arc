import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Lazy-init rate limiters to avoid crashing at module import during build.
// Redis.fromEnv() connects immediately — if the URL is a placeholder or
// unreachable, it throws during Next.js page data collection.
let _apiRateLimit: Ratelimit | null | undefined;
let _authRateLimit: Ratelimit | null | undefined;

function createRedis(): Redis | null {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url?.startsWith("https://") || !token || url.includes("placeholder")) {
      return null;
    }
    return Redis.fromEnv();
  } catch {
    return null;
  }
}

export function getApiRateLimit(): Ratelimit | null {
  if (_apiRateLimit === undefined) {
    const redis = createRedis();
    _apiRateLimit = redis
      ? new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(20, "60 s"),
          analytics: true,
          prefix: "smartout:api",
        })
      : null;
  }
  return _apiRateLimit;
}

export function getAuthRateLimit(): Ratelimit | null {
  if (_authRateLimit === undefined) {
    const redis = createRedis();
    _authRateLimit = redis
      ? new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(5, "60 s"),
          analytics: true,
          prefix: "smartout:auth",
        })
      : null;
  }
  return _authRateLimit;
}

let _otpRateLimit: Ratelimit | null | undefined;
let _workspaceCreateRateLimit: Ratelimit | null | undefined;

export function getOtpRateLimit(): Ratelimit | null {
  if (_otpRateLimit === undefined) {
    const redis = createRedis();
    _otpRateLimit = redis
      ? new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(3, "900 s"), // 3 per 15 min
          analytics: true,
          prefix: "smartout:otp",
        })
      : null;
  }
  return _otpRateLimit;
}

export function getWorkspaceCreateRateLimit(): Ratelimit | null {
  if (_workspaceCreateRateLimit === undefined) {
    const redis = createRedis();
    _workspaceCreateRateLimit = redis
      ? new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(3, "3600 s"), // 3 per hour
          analytics: true,
          prefix: "smartout:workspace-create",
        })
      : null;
  }
  return _workspaceCreateRateLimit;
}

/** Fail-closed wrapper for auth-critical rate limiting */
export async function checkAuthRateLimit(
  identifier: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const limiter = getAuthRateLimit();
  if (!limiter) {
    // FAIL-CLOSED: if Redis is unavailable, block auth requests
    console.error("[rate-limit] Redis unavailable — blocking auth request (fail-closed)");
    return { allowed: false, remaining: 0 };
  }
  const result = await limiter.limit(identifier);
  return { allowed: result.success, remaining: result.remaining };
}
