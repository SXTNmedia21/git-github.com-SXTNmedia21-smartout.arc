import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Only init Upstash when a real URL is configured (must start with https://).
// Vercel preview may have placeholder/op:// values that crash Redis.fromEnv().
const hasUpstash =
  process.env.UPSTASH_REDIS_REST_URL?.startsWith("https://") &&
  process.env.UPSTASH_REDIS_REST_TOKEN;

export const apiRateLimit = hasUpstash
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(20, "60 s"),
      analytics: true,
      prefix: "smartout:api",
    })
  : null;

export const authRateLimit = hasUpstash
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, "60 s"),
      analytics: true,
      prefix: "smartout:auth",
    })
  : null;
