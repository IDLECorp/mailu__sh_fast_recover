import type { LayoutServerLoad } from './$types';
import { getSessionUser } from '$lib/server/auth';

export const load: LayoutServerLoad = async ({ locals }) => {
  return { user: await getSessionUser(locals.sessionId) };
};