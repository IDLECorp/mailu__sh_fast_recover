import type { Cookies } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '$env/dynamic/private';
import {
  createSession,
  getSessionNeedPwChange,
  getSessionPassword,
  updateSessionPasswordAndClearNeedPwChange,
  verifySession,
} from './auth';

function cookieJar(): Cookies {
  const values = new Map<string, string>();
  return {
    get: vi.fn((name: string) => values.get(name)),
    set: vi.fn((name: string, value: string) => values.set(name, value)),
    delete: vi.fn((name: string) => values.delete(name)),
  } as unknown as Cookies;
}

describe('auth session password changes', () => {
  beforeEach(() => {
    for (const key of Object.keys(env)) delete env[key];
    env.SESSION_SECRET = 'test-session-secret-with-enough-length';
  });

  it('updates the stored session password and clears forced-change state together', async () => {
    const cookies = cookieJar();
    await createSession(cookies, 'user@example.com', 'temporary-password', true);

    const sid = await verifySession(cookies);
    expect(await getSessionPassword(sid)).toBe('temporary-password');
    expect(await getSessionNeedPwChange(sid)).toBe(true);

    await updateSessionPasswordAndClearNeedPwChange(sid, 'changed-password');

    expect(await getSessionPassword(sid)).toBe('changed-password');
    expect(await getSessionNeedPwChange(sid)).toBe(false);
  });
});
