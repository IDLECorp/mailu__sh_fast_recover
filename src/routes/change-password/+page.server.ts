import { fail, error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getSessionUser, getSessionPassword, clearSessionNeedPwChange } from '$lib/server/auth';
import { updatePassword } from '$lib/server/mailu-admin';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async ({ locals, cookies }) => {
  void cookies;
  if (!locals.user) throw redirect(303, '/login');

  const sid = locals.sessionId;
  const currentPassword = sid ? await getSessionPassword(sid) : null;

  if (!env.MAILU_API_KEY) {
    return { adminEnabled: false as const, email: locals.user.email, currentPassword: '' };
  }
  return { adminEnabled: true as const, email: locals.user.email, currentPassword: currentPassword ?? '' };
};

export const actions: Actions = {
  default: async ({ locals, request, cookies, getClientAddress }) => {
    if (!locals.user) throw error(401, 'No autorizado');
    if (!env.MAILU_API_KEY) return fail(503, { error: 'La API de Mailu no está habilitada. Pedí al administrador que la active.' });

    const sid = locals.sessionId;
    const password = sid ? await getSessionPassword(sid) : null;
    if (!password) return fail(403, { error: 'Sesión expirada. Volvé a iniciar sesión.' });

    const form = await request.formData();
    const current = String(form.get('current') ?? '');
    const newPw = String(form.get('new') ?? '');
    const confirm = String(form.get('confirm') ?? '');

    if (current !== password) return fail(400, { error: 'La contraseña actual no coincide' });
    if (newPw.length < 8) return fail(400, { error: 'La nueva contraseña debe tener al menos 8 caracteres' });
    if (newPw !== confirm) return fail(400, { error: 'Las contraseñas no coinciden' });
    if (newPw === current) return fail(400, { error: 'La nueva contraseña debe ser distinta a la actual' });

    try {
      await updatePassword(locals.user.email, newPw);
      if (sid) await clearSessionNeedPwChange(sid);
    } catch (e) {
      const msg = (e as Error).message || 'no se pudo cambiar';
      return fail(500, { error: msg });
    }
    void cookies;
    void getClientAddress;
    throw redirect(303, '/inbox');
  }
};