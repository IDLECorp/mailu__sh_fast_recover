import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { verifyCredentialsFull } from '$lib/server/imap';
import { createSession } from '$lib/server/auth';
import {
  getUserPasswordChangeRequired,
  resolvePasswordChangeRequirement,
  validateMailuBasicAuthPassword,
} from '$lib/server/mailu-admin';
import { rateLimitByKey } from '$lib/server/rate-limit';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (locals.user) throw redirect(303, '/inbox');
  return { next: url.searchParams.get('next') ?? '/inbox' };
};

export const actions: Actions = {
  default: async ({ request, cookies, getClientAddress, url }) => {
    const data = await request.formData();
    const email = String(data.get('email') ?? '').trim().toLowerCase();
    const password = String(data.get('password') ?? '');
    const next = url.searchParams.get('next') ?? '/inbox';

    if (!email || !password) return fail(400, { error: 'Faltan credenciales', email });
    if (!email.includes('@') || email.length > 254) return fail(400, { error: 'Email inválido', email });

    try {
      rateLimitByKey('login', getClientAddress(), { max: 10, windowS: 60 });
    } catch {
      return fail(429, { error: 'Demasiados intentos. Reintentá en 60s', email });
    }

    const check = await verifyCredentialsFull({ user: email, pass: password });
    if (!check.ok) {
      const mailuRequiresPasswordChange = await getUserPasswordChangeRequired(email);
      if (mailuRequiresPasswordChange === true && (await validateMailuBasicAuthPassword(email, password)) === true) {
        await createSession(cookies, email, password, true);
        throw redirect(303, '/change-password');
      }

      return fail(401, { error: 'Email o contraseña incorrectos', email });
    }

    const needPwChange = await resolvePasswordChangeRequirement(email, check.needPwChange);
    await createSession(cookies, email, password, needPwChange);
    throw redirect(303, needPwChange ? '/change-password' : (next.startsWith('/') ? next : '/inbox'));
  }
};
