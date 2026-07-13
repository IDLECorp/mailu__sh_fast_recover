import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionPassword } from '$lib/server/auth';
import { fetchAttachment } from '$lib/server/imap';

export const GET: RequestHandler = async ({ locals, url }) => {
  const sid = locals.sessionId;
  const password = sid ? getSessionPassword(sid) : null;
  if (!locals.user || !password) throw error(401, 'No autorizado');
  const uid = Number(url.searchParams.get('uid') ?? '0');
  const mailbox = url.searchParams.get('mailbox') ?? 'INBOX';
  const filename = url.searchParams.get('filename') ?? '';
  if (!uid || !filename) throw error(400, 'Parámetros inválidos');
  const attachment = await fetchAttachment({ user: locals.user.email, pass: password }, mailbox, uid, filename);
  if (!attachment) throw error(404, 'Adjunto no encontrado');
  return new Response(new Uint8Array(attachment.content), {
    headers: {
      'Content-Type': attachment.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${attachment.filename.replace(/"/g, '')}"`,
      'Content-Length': String(attachment.content.length)
    }
  });
};