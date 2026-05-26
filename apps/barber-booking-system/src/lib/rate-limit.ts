import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Sliding window: 5 requests per 60 seconds per IP
// Shared Redis instance — works across all serverless instances
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  prefix: "rl:barber",
  ephemeralCache: new Map(), // local micro-cache to reduce Redis roundtrips
});

export async function checkRateLimit(ip: string): Promise<boolean> {
  const { success } = await ratelimit.limit(ip);
  return success;
}
