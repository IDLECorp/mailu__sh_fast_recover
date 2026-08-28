import { describe, expect, it, vi, beforeEach } from 'vitest';
import { actions } from '../../routes/login/+page.server';
import { createSession } from '$lib/server/auth';
import {
  getUserPasswordChangeRequired,
  resolvePasswordChangeRequirement,
  validateMailuBasicAuthPassword,
} from '$lib/server/mailu-admin';
import { verifyCredentialsFull } from '$lib/server/imap';

vi.mock('$lib/server/auth', () => ({
  createSession: vi.fn(),
}));

vi.mock('$lib/server/imap', () => ({
  verifyCredentialsFull: vi.fn(),
}));

vi.mock('$lib/server/mailu-admin', () => ({
  getUserPasswordChangeRequired: vi.fn(),
  resolvePasswordChangeRequirement: vi.fn(),
  validateMailuBasicAuthPassword: vi.fn(),
}));

vi.mock('$lib/server/rate-limit', () => ({
  rateLimitByKey: vi.fn(),
}));

function loginRequest(email = 'user@example.com', password = 'submitted-password') {
  const formData = new FormData();
  formData.set('email', email);
  formData.set('password', password);

  return {
    request: { formData: vi.fn().mockResolvedValue(formData) },
    cookies: {},
    getClientAddress: () => '127.0.0.1',
    url: new URL('https://app.example.test/login'),
  };
}

describe('login action forced password change fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the IMAP success path using the resolved Mailu password-change requirement', async () => {
    vi.mocked(verifyCredentialsFull).mockResolvedValue({ ok: true, needPwChange: false });
    vi.mocked(resolvePasswordChangeRequirement).mockResolvedValue(true);

    await expect(actions.default(loginRequest() as never)).rejects.toMatchObject({
      status: 303,
      location: '/change-password',
    });

    expect(resolvePasswordChangeRequirement).toHaveBeenCalledWith('user@example.com', false);
    expect(validateMailuBasicAuthPassword).not.toHaveBeenCalled();
    expect(createSession).toHaveBeenCalledWith({}, 'user@example.com', 'submitted-password', true);
  });

  it('creates a forced-change session when IMAP fails but Mailu Basic auth accepts the forced-change password', async () => {
    vi.mocked(verifyCredentialsFull).mockResolvedValue({ ok: false, needPwChange: false });
    vi.mocked(getUserPasswordChangeRequired).mockResolvedValue(true);
    vi.mocked(validateMailuBasicAuthPassword).mockResolvedValue(true);

    await expect(actions.default(loginRequest() as never)).rejects.toMatchObject({
      status: 303,
      location: '/change-password',
    });

    expect(createSession).toHaveBeenCalledWith({}, 'user@example.com', 'submitted-password', true);
    expect(resolvePasswordChangeRequirement).not.toHaveBeenCalled();
  });

  it('keeps rejecting failed IMAP credentials when Mailu Basic auth does not accept them', async () => {
    vi.mocked(verifyCredentialsFull).mockResolvedValue({ ok: false, needPwChange: false });
    vi.mocked(getUserPasswordChangeRequired).mockResolvedValue(true);
    vi.mocked(validateMailuBasicAuthPassword).mockResolvedValue(false);

    await expect(actions.default(loginRequest() as never)).resolves.toMatchObject({
      status: 401,
      data: { error: 'Email o contraseña incorrectos', email: 'user@example.com' },
    });

    expect(createSession).not.toHaveBeenCalled();
  });
});
