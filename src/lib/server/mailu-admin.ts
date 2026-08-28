import { env } from '$env/dynamic/private';

interface MailuConfig {
  baseUrl: string;
  apiKey: string;
}

function getBaseUrl(): string | null {
  const raw = (env.MAILU_ADMIN_URL ?? 'http://mailu-admin-1:8080').trim();
  if (!raw) return null;

  try {
    return new URL(raw).toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function getConfig(): MailuConfig {
  const baseUrl = getBaseUrl();
  if (!baseUrl) throw new Error('MAILU_ADMIN_URL invalido');
  const apiKey = env.MAILU_API_KEY;
  if (!apiKey) throw new Error('MAILU_API_KEY no configurado');
  return { baseUrl, apiKey };
}

export async function validateMailuBasicAuthPassword(email: string, password: string): Promise<boolean | null> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) return null;

  try {
    const res = await fetch(`${baseUrl}/internal/auth/basic`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${email}:${password}`, 'utf8').toString('base64')}`,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 401) return false;
    if (!res.ok) return null;

    const authenticatedUser = res.headers.get('X-User');
    if (!authenticatedUser) return false;
    return authenticatedUser.toLowerCase() === email.toLowerCase();
  } catch {
    return null;
  }
}

async function adminRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const { baseUrl, apiKey } = getConfig();
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...(init.headers ?? {})
    },
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Mailu Admin ${path} -> ${res.status} ${body.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

export interface MailuDomain {
  name: string;
  alternatives: string[];
  dkim_key: string | null;
  dkim_selector: string;
}

export interface MailuUser {
  email: string;
  domain: string;
  localpart: string;
  enabled: boolean;
  quota: number | null;
  change_pw_next_login?: boolean;
}

export interface MailuAlias {
  email: string;
  destination: string;
}

function api(path: string): string {
  return `/api/v1${path.startsWith('/') ? path : `/${path}`}`;
}

export async function listDomains(): Promise<MailuDomain[]> {
  return (await adminRequest(api('/domain'))) as MailuDomain[];
}

export async function getDomain(name: string): Promise<MailuDomain | null> {
  try {
    return (await adminRequest(api(`/domain/${encodeURIComponent(name)}`))) as MailuDomain;
  } catch {
    return null;
  }
}

export async function createDomain(data: Pick<MailuDomain, 'name'> & { alternatives?: string[] }): Promise<MailuDomain> {
  return (await adminRequest(api('/domain'), {
    method: 'POST',
    body: JSON.stringify(data)
  })) as MailuDomain;
}

export async function listUsers(domain?: string): Promise<MailuUser[]> {
  const path = domain ? `/user?domain=${encodeURIComponent(domain)}` : '/user';
  return (await adminRequest(api(path))) as MailuUser[];
}

export async function getUser(email: string): Promise<MailuUser> {
  return (await adminRequest(api(`/user/${encodeURIComponent(email)}`))) as MailuUser;
}

export async function getUserPasswordChangeRequired(email: string): Promise<boolean | null> {
  if (!env.MAILU_API_KEY) return null;
  try {
    const user = await getUser(email);
    return typeof user.change_pw_next_login === 'boolean' ? user.change_pw_next_login : null;
  } catch (e) {
    console.error('mailu getUserPasswordChangeRequired', (e as Error).message);
    return null;
  }
}

export async function resolvePasswordChangeRequirement(email: string, fallback: boolean): Promise<boolean> {
  return (await getUserPasswordChangeRequired(email)) ?? fallback;
}

export async function createUser(input: { localpart: string; domain: string; password: string; quota?: number }): Promise<MailuUser> {
  const email = `${input.localpart}@${input.domain}`;
  const quotaBytes = input.quota === undefined ? null : Math.round(input.quota * 1024 * 1024);
  return (await adminRequest(api('/user'), {
    method: 'POST',
    body: JSON.stringify({
      email,
      raw_password: input.password,
      quota_bytes: quotaBytes
    })
  })) as MailuUser;
}

export async function deleteUser(email: string): Promise<void> {
  await adminRequest(api(`/user/${encodeURIComponent(email)}`), { method: 'DELETE' });
}

export async function updatePassword(email: string, password: string): Promise<void> {
  await adminRequest(api(`/user/${encodeURIComponent(email)}`), {
    method: 'PATCH',
    body: JSON.stringify({ raw_password: password, change_pw_next_login: false })
  });
}

export async function listAliases(domain?: string): Promise<MailuAlias[]> {
  const path = domain ? `/alias?domain=${encodeURIComponent(domain)}` : '/alias';
  return (await adminRequest(api(path))) as MailuAlias[];
}
