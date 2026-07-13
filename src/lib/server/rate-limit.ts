import { env } from '$env/dynamic/private';

export interface RateLimitConfig {
  max: number;
  windowS: number;
}

const buckets = new Map<string, { tokens: number; ts: number }>();

export function rateLimit(key: string, max = 10, windowS = 60): void {
  const now = Date.now();
  const cur = buckets.get(key) ?? { tokens: max, ts: now };
  const elapsed = (now - cur.ts) / 1000;
  cur.tokens = Math.min(max, cur.tokens + (elapsed * max) / windowS);
  cur.ts = now;
  buckets.set(key, cur);
  if (cur.tokens < 1) {
    const err = new Error('rate_limit');
    (err as Error & { status: number }).status = 429;
    throw err;
  }
  cur.tokens -= 1;
}

export function rateLimitByKey(prefix: string, identifier: string, cfg: RateLimitConfig = { max: 10, windowS: 60 }): void {
  rateLimit(`${prefix}:${identifier}`, cfg.max, cfg.windowS);
}

export { env };