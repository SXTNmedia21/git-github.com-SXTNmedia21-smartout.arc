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
