import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';

export interface SessionUser {
  email: string;
  domain: string;
}

interface StoredSession extends SessionUser {
  password: string;
  createdAt: number;
}

const SESSION_COOKIE = 'fast_sid';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const sessions = new Map<string, StoredSession>();

function secret(): string {
  const s = env.SESSION_SECRET;
  if (!s || s.length < 24) throw new Error('SESSION_SECRET invalido (min 24 chars)');
  return s;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createSession(cookies: Cookies, email: string, password: string): SessionUser {
  const sid = randomUUID();
  const user: StoredSession = {
    email,
    password,
    domain: email.split('@')[1] ?? '',
    createdAt: Date.now()
  };
  sessions.set(sid, user);
  const body = Buffer.from(sid).toString('base64url');
  cookies.set(SESSION_COOKIE, `${body}.${sign(body)}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000
  });
  return { email: user.email, domain: user.domain };
}

export function verifySession(cookies: Cookies): string | null {
  const token = cookies.get(SESSION_COOKIE);
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const sid = Buffer.from(body, 'base64url').toString('utf8');
    const s = sessions.get(sid);
    if (!s) return null;
    if (Date.now() - s.createdAt > SESSION_TTL_MS) {
      sessions.delete(sid);
      return null;
    }
    return sid;
  } catch {
    return null;
  }
}

export function getSessionUser(sid: string | null): SessionUser | null {
  if (!sid) return null;
  const s = sessions.get(sid);
  if (!s) return null;
  return { email: s.email, domain: s.domain };
}

export function getSessionPassword(sid: string | null): string | null {
  if (!sid) return null;
  return sessions.get(sid)?.password ?? null;
}

export function destroySession(cookies: Cookies, sid: string | null): void {
  if (sid) sessions.delete(sid);
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

export function pruneExpired(): void {
  const now = Date.now();
  for (const [sid, s] of sessions) {
    if (now - s.createdAt > SESSION_TTL_MS) sessions.delete(sid);
  }
}

setInterval(pruneExpired, 1000 * 60 * 30).unref();