import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '$env/dynamic/private';
import { classifyCreateUserError } from '$lib/server/admin-errors';

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const key of Object.keys(env)) delete env[key];
  env.MAILU_API_KEY = 'test-api-key';
});

describe('admin create user error classification', () => {
  it.each([
    [new Error('Mailu Admin /api/v1/user -> 400 {"raw_password":["Invalid password"]}'), 'La contraseña debe tener al menos 8 caracteres.', 'password'],
    [new Error('Mailu Admin /api/v1/user -> 409 User user@example.com already exists'), 'Ese usuario ya existe. Elegí otro nombre.', undefined],
    [new Error('Mailu Admin /api/v1/user -> 404 Domain example.com does not exist'), 'El dominio no es válido o no está disponible.', undefined],
    [new Error('Mailu Admin /api/v1/user -> 409 Too many users for domain example.com'), 'Se alcanzó el límite de usuarios para este dominio.', undefined],
    [new Error('Mailu Admin /api/v1/user -> 400 quota_bytes must be greater than zero'), 'La cuota debe ser un número válido mayor o igual a cero.', undefined],
    [new Error('Mailu Admin /api/v1/user -> 403 Invalid authorization header'), 'No tenés autorización para crear usuarios.', undefined],
    [new Error('Mailu Admin /api/v1/user -> 500 upstream exploded at https://mailu.internal'), 'No se pudo crear el usuario. Revisá los datos y probá de nuevo.', undefined],
  ])('maps %s without leaking backend details', (input, message, field) => {
    expect(classifyCreateUserError(input)).toEqual({ message, ...(field ? { field } : {}) });
    expect(classifyCreateUserError(input).message).not.toMatch(/Mailu|api|https?:|raw_password|500/);
  });

  it('keeps the short-password validation message aligned with the UI', async () => {
    const { actions } = await import('./+page.server');
    const result = await actions.createUser({
      locals: { user: { domain: 'example.com' } },
      request: new Request('http://localhost/admin', {
        method: 'POST',
        body: new URLSearchParams({ localpart: 'user', domain: 'example.com', password: 'short', quota: '' }),
      }),
      getClientAddress: () => '127.0.0.1',
    } as never);

    expect(result).toEqual({ ok: false, error: 'La contraseña debe tener al menos 8 caracteres.', field: 'password' });
  });
});
