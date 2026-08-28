import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '$env/dynamic/private';
import {
  getUserPasswordChangeRequired,
  resolvePasswordChangeRequirement,
  createUser,
  updatePassword,
  validateMailuBasicAuthPassword,
} from './mailu-admin';

describe('Mailu Admin user updates', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const key of Object.keys(env)) delete env[key];
    env.MAILU_ADMIN_URL = 'https://mailu-admin.example.test/';
    env.MAILU_API_KEY = 'test-api-key';
  });

  it('sends Mailu REST v1 password fields and clears forced change on update', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await updatePassword('user@example.com', 'changed-password');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://mailu-admin.example.test/api/v1/user/user%40example.com',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          raw_password: 'changed-password',
          change_pw_next_login: false,
        }),
      }),
    );
  });

  it('reads the real Mailu forced password-change flag when available', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(Response.json({
          email: 'user@example.com',
          domain: 'example.com',
          localpart: 'user',
          enabled: true,
          quota: null,
          change_pw_next_login: false,
        })),
      ),
    );

    await expect(getUserPasswordChangeRequired('user@example.com')).resolves.toBe(false);
    await expect(resolvePasswordChangeRequirement('user@example.com', true)).resolves.toBe(false);
  });

  it('falls back to credential verification when Mailu Admin is unavailable', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 })));

    await expect(resolvePasswordChangeRequirement('user@example.com', true)).resolves.toBe(true);
    expect(errorSpy).toHaveBeenCalledWith(
      'mailu getUserPasswordChangeRequired',
      expect.stringContaining('503'),
    );
  });

  it('validates a submitted password through Mailu internal Basic auth', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
        headers: { 'X-User': 'user@example.com' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(validateMailuBasicAuthPassword('user@example.com', 'submitted-password')).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://mailu-admin.example.test/internal/auth/basic',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from('user@example.com:submitted-password', 'utf8').toString('base64')}`,
        }),
      }),
    );
  });

  it('rejects Mailu internal Basic auth success without an X-User header', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(validateMailuBasicAuthPassword('user@example.com', 'submitted-password')).resolves.toBe(false);
  });

  it('rejects Mailu internal Basic auth when X-User does not match', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 204,
          headers: { 'X-User': 'other@example.com' },
        }),
      ),
    );

    await expect(validateMailuBasicAuthPassword('user@example.com', 'submitted-password')).resolves.toBe(false);
  });

  it('returns false when Mailu internal Basic auth rejects credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    await expect(validateMailuBasicAuthPassword('user@example.com', 'submitted-password')).resolves.toBe(false);
  });

  it('returns null when Mailu internal Basic auth is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')));

    await expect(validateMailuBasicAuthPassword('user@example.com', 'submitted-password')).resolves.toBe(null);
  });

  it('returns null when Mailu Admin URL is invalid', async () => {
    env.MAILU_ADMIN_URL = 'not a url';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(validateMailuBasicAuthPassword('user@example.com', 'submitted-password')).resolves.toBe(null);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Mailu Admin user creation', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const key of Object.keys(env)) delete env[key];
    env.MAILU_ADMIN_URL = 'https://mailu-admin.example.test/';
    env.MAILU_API_KEY = 'test-api-key';
  });

  it('sends Mailu v2 user fields and converts the UI quota from MB to bytes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ email: 'user@example.com' }));
    vi.stubGlobal('fetch', fetchMock);

    await createUser({ localpart: 'user', domain: 'example.com', password: 'plain-pass', quota: 25 });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://mailu-admin.example.test/api/v1/user',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          email: 'user@example.com',
          raw_password: 'plain-pass',
          quota_bytes: 25 * 1024 * 1024,
        }),
      }),
    );
  });

  it('sends null when no quota is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ email: 'user@example.com' }));
    vi.stubGlobal('fetch', fetchMock);

    await createUser({ localpart: 'user', domain: 'example.com', password: 'plain-pass' });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: 'user@example.com',
      raw_password: 'plain-pass',
      quota_bytes: null,
    });
  });
});
