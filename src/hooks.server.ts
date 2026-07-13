import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { verifySession, getSessionUser, getSessionNeedPwChange } from '$lib/server/auth';

const PUBLIC_PATHS = ['/login', '/health', '/favicon.svg', '/change-password', '/logout'];

export const handle: Handle = async ({ event, resolve }) => {
  const sid = await verifySession(event.cookies);
  event.locals.sessionId = sid;
  event.locals.user = await getSessionUser(sid);

  const path = event.url.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  if (!event.locals.user && !isPublic) {
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