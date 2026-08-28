import type { Handle } from '@sveltejs/kit';
import { json, redirect } from '@sveltejs/kit';
import { verifySession, getSessionUser, getSessionNeedPwChange } from '$lib/server/auth';

const PUBLIC_PATHS = ['/login', '/health', '/favicon.svg', '/change-password', '/logout'];

export const handle: Handle = async ({ event, resolve }) => {
  const sid = await verifySession(event.cookies);
  event.locals.sessionId = sid;
  event.locals.user = await getSessionUser(sid);

  const path = event.url.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  const isApi = path.startsWith('/api/');
  if (!event.locals.user && !isPublic) {
    // Rutas de API: 401 JSON en vez de redirigir al login (un cliente que
    // sigue el 303 terminaria sirviendo el HTML del login con 200).
    if (isApi) return json({ ok: false, error: 'No autorizado' }, { status: 401 });
    throw redirect(303, `/login?next=${encodeURIComponent(path)}`);
  }
  if (event.locals.user && sid) {
    const needPwChange = await getSessionNeedPwChange(sid);
    if (needPwChange && path !== '/change-password' && path !== '/logout') {
      throw redirect(303, '/change-password');
    }
  }

  return resolve(event);
};