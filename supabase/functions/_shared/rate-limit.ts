import { Ratelimit } from "npm:@upstash/ratelimit@2";
import { Redis } from "npm:@upstash/redis@1";

let ratelimit: Ratelimit | null = null;

function getRateLimiter(): Ratelimit | null {
  if (ratelimit) return ratelimit;
  const url = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
  if (!url || !token) return null;

  ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(60, "60 s"),
    prefix: "rl:smartout:ef",
  });
  return ratelimit;
}

export async function checkRateLimit(
  identifier: string,
  _customLimit?: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const rl = getRateLimiter();
  if (!rl) {
    // Fail-OPEN in local/dev (no Upstash configured). Fail-CLOSED in prod —
    // Upstash being unreachable in prod = real config drift, not local-skip.
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const isLocal =
      supabaseUrl.includes("127.0.0.1") ||
      supabaseUrl.includes("localhost") ||
      supabaseUrl.includes("host.docker.internal") ||
      supabaseUrl.includes("kong:") ||
      Deno.env.get("ENVIRONMENT") === "development" ||
      Deno.env.get("DENO_ENV") === "development";
    if (isLocal) {
      console.warn(
        "[rate-limit] Upstash env vars missing — local dev fail-OPEN. Set UPSTASH_REDIS_REST_URL/_TOKEN for prod.",
      );
      return { allowed: true, remaining: 999999, resetAt: 0 };
    }
    console.error(
      "[rate-limit] Upstash env vars missing in prod — failing CLOSED. Check UPSTASH_REDIS_REST_URL/_TOKEN.",
    );
    return { allowed: false, remaining: 0, resetAt: 0 };
  }

  const { success, remaining, reset } = await rl.limit(identifier);
  return { allowed: success, remaining, resetAt: reset };
}
