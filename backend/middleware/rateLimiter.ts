import type { NextFunction, Request, Response } from "express";

interface Bucket {
  timestamps: number[];
}

export function createRateLimiter(options: { windowMs: number; maxRequests: number }) {
  const buckets = new Map<string, Bucket>();
  const { windowMs, maxRequests } = options;

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    const clientIp =
      (req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.ip || "unknown").trim();

    if (buckets.size > 5000) {
      for (const [key, bucket] of buckets.entries()) {
        const recent = bucket.timestamps.filter((t) => now - t < windowMs);
        if (recent.length === 0) buckets.delete(key);
        else bucket.timestamps = recent;
      }
    }

    const bucket = buckets.get(clientIp) || { timestamps: [] };
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

    if (bucket.timestamps.length >= maxRequests) {
      const oldest = bucket.timestamps[0] ?? now;
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({ error: "Too many requests. Please slow down and try again." });
      return;
    }

    bucket.timestamps.push(now);
    buckets.set(clientIp, bucket);
    next();
  };
}
