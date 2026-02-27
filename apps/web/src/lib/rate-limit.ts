import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Use Upstash in production, memory in dev
export const apiRateLimit = process.env.UPSTASH_REDIS_REST_URL
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(20, "60 s"),
      analytics: true,
      prefix: "smartout:api",
    })
  : null;

export const authRateLimit = process.env.UPSTASH_REDIS_REST_URL
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, "60 s"),
      analytics: true,
      prefix: "smartout:auth",
    })
  : null;
