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
    console.error(
      "[rate-limit] Upstash env vars missing — failing CLOSED. Check UPSTASH_REDIS_REST_URL/_TOKEN.",
    );
    return { allowed: false, remaining: 0, resetAt: 0 };
  }

  const { success, remaining, reset } = await rl.limit(identifier);
  return { allowed: success, remaining, resetAt: reset };
}
