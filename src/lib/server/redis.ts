import { env } from '$env/dynamic/private';

const REDIS_URL = env.REDIS_URL ?? 'redis://mailu-redis-1:6379/1';

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const SESSION_COOKIE = 'fast_sid';

let _client: import('ioredis').default | null = null;

export async function redisClient(): Promise<import('ioredis').default> {
  if (_client) return _client;
  const Redis = (await import('ioredis')).default;
  _client = new Redis(REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    connectTimeout: 3000,
    retryStrategy: (times) => Math.min(times * 200, 2000)
  });
  _client.on('error', (e) => console.error('redis error', e.message));
  return _client;
}

export async function pingRedis(): Promise<boolean> {
  try {
    const c = await redisClient();
    const r = await c.ping();
    return r === 'PONG';
  } catch (e) {
    console.error('redis ping failed', (e as Error).message);
    return false;
  }
}