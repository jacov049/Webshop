import type { Request, Response, NextFunction } from "express";

/**
 * Minimalistischer In-Memory-Rate-Limiter ohne Fremdabhängigkeit.
 * Bewusst KEINE Speicherung/Verwendung der IP über die Laufzeit dieses
 * Prozess-internen Zählers hinaus (kein Logging, kein Persistieren).
 * Für Multi-Instance-Deployments könnte dies durch Redis ersetzt werden;
 * für dieses Ausbildungsprojekt (Single-VPS) ausreichend.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

export function rateLimit(opts: { windowMs: number; max: number }) {
  const buckets = new Map<string, Bucket>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt < now) buckets.delete(key);
    }
  }, 60_000).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const identity = req.ip ?? "unknown";
    const now = Date.now();
    let bucket = buckets.get(identity);
    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(identity, bucket);
    }
    bucket.count += 1;
    if (bucket.count > opts.max) {
      res.setHeader("Retry-After", Math.ceil((bucket.resetAt - now) / 1000).toString());
      return res.status(429).json({ error: "Zu viele Anfragen, bitte später erneut versuchen." });
    }
    next();
  };
}
