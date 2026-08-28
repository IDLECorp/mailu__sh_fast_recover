export interface RateLimitConfig {
  max: number;
  windowS: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

// Ventana fija en memoria: permite `max` solicitudes por cada ventana de
// `windowS` segundos, identificadas por `key`. Al superarse se LANZA una
// excepcion con status 429, que los llamadores capturan para responder 429.
// Se mantiene sincrono a proposito: los llamadores (login, send, draft,
// admin) usan rateLimitByKey(...) dentro de un try/catch sincrono.
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, max = 10, windowS = 60): void {
  const now = Date.now();
  const existing = buckets.get(key);
  let bucket: Bucket;
  if (!existing || now >= existing.resetAt) {
    bucket = { count: 0, resetAt: now + windowS * 1000 };
    buckets.set(key, bucket);
  } else {
    bucket = existing;
  }

  bucket.count += 1;
  if (bucket.count > max) {
    const err = new Error('rate_limit_exceeded') as Error & { status: number };
    err.status = 429;
    throw err;
  }
}

export function rateLimitByKey(prefix: string, identifier: string, cfg: RateLimitConfig = { max: 10, windowS: 60 }): void {
  rateLimit(`${prefix}:${identifier}`, cfg.max, cfg.windowS);
}
