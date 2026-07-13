import type { LayoutServerLoad } from './$types';
import { getSessionUser } from '$lib/server/auth';

export const load: LayoutServerLoad = ({ locals }) => {
  return { user: getSessionUser(locals.sessionId) };
};