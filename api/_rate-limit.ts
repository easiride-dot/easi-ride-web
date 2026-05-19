// In-memory token bucket/window rate limiter for serverless environment.
// Note: In serverless execution context, this global memory state is preserved
// across warm-started invocations within the same container.

interface RateLimitConfig {
  intervalMs: number; // time window in ms
  maxRequests: number; // max requests per window
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Clean up expired entries every 5 minutes to avoid memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
      if (now > value.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * Checks if a request exceeds rate limits.
 * @param req Express/Vercel request object
 * @param config RateLimitConfig
 * @param userId Optional unique user ID from Auth session (prioritized over IP)
 * @returns true if allowed, false if rate limited
 */
export function rateLimit(
  req: any,
  config: RateLimitConfig = { intervalMs: 60 * 1000, maxRequests: 20 },
  userId?: string
): boolean {
  const ip = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "anonymous";
  const ipStr = Array.isArray(ip) ? ip[0] : ip;
  const identifier = userId ? `user:${userId}` : `ip:${ipStr}`;

  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.intervalMs,
    });
    return true;
  }

  if (entry.count >= config.maxRequests) {
    return false;
  }

  entry.count += 1;
  return true;
}
