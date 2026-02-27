type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

// In-memory fallback for local dev (no Redis)
const memoryStore = new Map<string, { count: number; resetAt: number }>();

export function createRateLimiter(opts: { maxRequests: number; windowMs: number }) {
  return {
    async check(key: string): Promise<RateLimitResult> {
      const now = Date.now();
      const entry = memoryStore.get(key);

      if (!entry || now > entry.resetAt) {
        memoryStore.set(key, { count: 1, resetAt: now + opts.windowMs });
        return {
          success: true,
          limit: opts.maxRequests,
          remaining: opts.maxRequests - 1,
          reset: now + opts.windowMs,
        };
      }

      entry.count++;
      const remaining = Math.max(0, opts.maxRequests - entry.count);
      return {
        success: entry.count <= opts.maxRequests,
        limit: opts.maxRequests,
        remaining,
        reset: entry.resetAt,
      };
    },
  };
}
