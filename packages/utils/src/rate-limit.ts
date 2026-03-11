// ============================================
// rate-limit.ts
// Creates a small in-memory rate limiter utility for local/dev usage.
// This exists to provide a simple fallback when external stores are unavailable.
// ============================================

type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

type RateLimiterOptions = {
  maxRequests: number;
  windowMs: number;
};

/**
 * Creates an in-memory rate limiter instance bound to its own store.
 *
 * Why: Isolating state per limiter avoids cross-contamination between different
 * consumers that may use different windows or request limits.
 *
 * @param opts - Rate limit configuration for maximum requests and window duration.
 * @returns A limiter object with a check method for evaluating a key.
 */
export function createRateLimiter(opts: RateLimiterOptions) {
  // Keep storage per limiter instance so separate limiters cannot affect each other.
  const memoryStore = new Map<string, { count: number; resetAt: number }>();

  return {
    /**
     * Evaluates a key against the configured request window.
     *
     * Why: Callers need deterministic success/remaining/reset metadata
     * to enforce limits and surface client headers.
     *
     * @param key - Identifier to throttle (for example user id or IP).
     * @returns Current rate-limit evaluation result for the key.
     */
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
