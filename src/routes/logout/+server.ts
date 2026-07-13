import type { RequestHandler } from './$types';
import { destroySession } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';

export const POST: RequestHandler = ({ cookies, locals }) => {
  destroySession(cookies, locals.sessionId);
  throw redirect(303, '/login');
};