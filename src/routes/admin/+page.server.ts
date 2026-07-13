import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { listDomains, listUsers, createUser, deleteUser } from '$lib/server/mailu-admin';
import { getSessionPassword } from '$lib/server/auth';
import { rateLimitByKey } from '$lib/server/rate-limit';

export const load: PageServerLoad = async ({ locals, url }) => {
  const user = locals.user;
  if (!user) throw error(401, 'No autenticado');
  const adminDomain = import.meta.env.VITE_ADMIN_DOMAINS?.split(',').map((d: string) => d.trim().toLowerCase()) ?? [];
  if (adminDomain.length && !adminDomain.includes(user.domain)) throw error(403, 'Sin permisos de administración');

  const [domains, users] = await Promise.all([
    listDomains().catch((e) => { console.error('listDomains', e); return []; }),
    listUsers().catch((e) => { console.error('listUsers', e); return []; })
  ]);
  void user; void url;
  return { domains, users, currentDomain: user.domain };
};

export const actions: Actions = {
  createUser: async ({ locals, request, getClientAddress }) => {
    const user = locals.user;
    if (!user) throw error(401, 'No autenticado');
    try {
      rateLimitByKey('admin:user', getClientAddress(), { max: 20, windowS: 60 });
    } catch {
      return { ok: false, error: 'Límite alcanzado (20/min)' };
    }
    const data = await request.formData();
    const localpart = String(data.get('localpart') ?? '').trim().toLowerCase();
    const domain = String(data.get('domain') ?? '').trim();
    const password = String(data.get('password') ?? '');
    const quotaRaw = String(data.get('quota') ?? '');
    if (!localpart || !domain || !password) return { ok: false, error: 'Faltan datos' };
    if (password.length < 8) return { ok: false, error: 'Contraseña mínima 8 caracteres' };
    if (localpart.length > 64 || !/^[a-z0-9._-]+$/.test(localpart)) return { ok: false, error: 'Localpart inválido' };
    const quota = quotaRaw ? Number(quotaRaw) : undefined;
    if (quota !== undefined && (!Number.isFinite(quota) || quota < 0)) return { ok: false, error: 'Quota inválido' };
    try {
      await createUser({ localpart, domain, password, quota });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
  deleteUser: async ({ request, getClientAddress, locals }) => {
    if (!locals.user) throw error(401, 'No autenticado');
    try {
      rateLimitByKey('admin:del', getClientAddress(), { max: 20, windowS: 60 });
    } catch {
      return { ok: false };
    }
    const data = await request.formData();
    const email = String(data.get('email') ?? '');
    if (!email) return { ok: false };
    try {
      await deleteUser(email);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }
};