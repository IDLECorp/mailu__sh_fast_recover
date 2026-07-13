import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';
import { SESSION_COOKIE, SESSION_TTL_SECONDS, redisClient, pingRedis } from '$lib/server/redis';

export interface SessionUser {
  email: string;
  domain: string;
}

interface StoredSession extends SessionUser {
  password: string;
  createdAt: number;
}

const inMemory = new Map<string, StoredSession>();

function secret(): string {
  const s = env.SESSION_SECRET;
  if (!s || s.length < 24) throw new Error('SESSION_SECRET invalido (min 24 chars)');
  return s;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

function verifyToken(token: string): string | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    return Buffer.from(body, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

async function getSessionRaw(sid: string): Promise<StoredSession | null> {
  if (await pingRedis()) {
    try {
      const c = await redisClient();
      const raw = await c.get(`fast:session:${sid}`);
      if (!raw) return null;
      const data = JSON.parse(raw) as StoredSession;
      if (Date.now() - data.createdAt > SESSION_TTL_SECONDS * 1000) {
        await c.del(`fast:session:${sid}`);
        return null;
      }
      return data;
    } catch (e) {
      console.error('redis getSessionRaw', (e as Error).message);
    }
  }
  const s = inMemory.get(sid);
  if (!s) return null;
  if (Date.now() - s.createdAt > SESSION_TTL_SECONDS * 1000) {
    inMemory.delete(sid);
    return null;
  }
  return s;
}

async function setSessionRaw(sid: string, data: StoredSession): Promise<void> {
  inMemory.set(sid, data);
  if (await pingRedis()) {
    try {
      const c = await redisClient();
      await c.set(`fast:session:${sid}`, JSON.stringify(data), 'EX', SESSION_TTL_SECONDS);
    } catch (e) {
      console.error('redis setSessionRaw', (e as Error).message);
    }
  }
}

async function deleteSessionRaw(sid: string): Promise<void> {
  inMemory.delete(sid);
  if (await pingRedis()) {
    try {
      const c = await redisClient();
      await c.del(`fast:session:${sid}`);
    } catch (e) {
      console.error('redis deleteSessionRaw', (e as Error).message);
    }
  }
}

export async function createSession(cookies: Cookies, email: string, password: string): Promise<SessionUser> {
  let sid = '';
  let attempts = 0;
  do {
    sid = randomUUID();
    attempts++;
  } while ((await getSessionRaw(sid)) && attempts < 5);

  const user: StoredSession = {
    email,
    password,
    domain: email.split('@')[1] ?? '',
    createdAt: Date.now()
  };
  await setSessionRaw(sid, user);

  const body = Buffer.from(sid).toString('base64url');
  cookies.set(SESSION_COOKIE, `${body}.${sign(body)}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS
  });
  return { email: user.email, domain: user.domain };
}

export async function verifySession(cookies: Cookies): Promise<string | null> {
  const token = cookies.get(SESSION_COOKIE);
  if (!token) return null;
  const sid = verifyToken(token);
  if (!sid) return null;
  const s = await getSessionRaw(sid);
  if (!s) return null;
  return sid;
}

export async function getSessionUser(sid: string | null): Promise<SessionUser | null> {
  if (!sid) return null;
  const s = await getSessionRaw(sid);
  if (!s) return null;
  return { email: s.email, domain: s.domain };
}

export async function getSessionPassword(sid: string | null): Promise<string | null> {
  if (!sid) return null;
  const s = await getSessionRaw(sid);
  if (!s) return null;
  return s.password;
}

export async function destroySession(cookies: Cookies, sid: string | null): Promise<void> {
  if (sid) await deleteSessionRaw(sid);
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

export async function pruneExpired(): Promise<void> {
  for (const [sid, s] of inMemory) {
    if (Date.now() - s.createdAt > SESSION_TTL_SECONDS * 1000) inMemory.delete(sid);
  }
}

setInterval(() => { void pruneExpired(); }, 1000 * 60 * 30).unref();