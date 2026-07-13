import { env } from '$env/dynamic/private';

interface MailuConfig {
  baseUrl: string;
  apiKey: string;
}

function getConfig(): MailuConfig {
  const baseUrl = (env.MAILU_ADMIN_URL ?? 'http://mailu-admin-1:8080').replace(/\/$/, '');
  const apiKey = env.MAILU_API_KEY;
  if (!apiKey) throw new Error('MAILU_API_KEY no configurado');
  return { baseUrl, apiKey };
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
}

export interface MailuAlias {
  email: string;
  destination: string;
}

export async function listDomains(): Promise<MailuDomain[]> {
  return (await adminRequest('/domain')) as MailuDomain[];
}

export async function getDomain(name: string): Promise<MailuDomain | null> {
  try {
    return (await adminRequest(`/domain/${encodeURIComponent(name)}`)) as MailuDomain;
  } catch {
    return null;
  }
}

export async function createDomain(data: Pick<MailuDomain, 'name'> & { alternatives?: string[] }): Promise<MailuDomain> {
  return (await adminRequest('/domain', {
    method: 'POST',
    body: JSON.stringify(data)
  })) as MailuDomain;
}

export async function listUsers(domain?: string): Promise<MailuUser[]> {
  const path = domain ? `/user?domain=${encodeURIComponent(domain)}` : '/user';
  return (await adminRequest(path)) as MailuUser[];
}

export async function createUser(input: { localpart: string; domain: string; password: string; quota?: number }): Promise<MailuUser> {
  return (await adminRequest('/user', {
    method: 'POST',
    body: JSON.stringify({
      localpart: input.localpart,
      domain: input.domain,
      password: input.password,
      quota: input.quota ?? null
    })
  })) as MailuUser;
}

export async function deleteUser(email: string): Promise<void> {
  await adminRequest(`/user/${encodeURIComponent(email)}`, { method: 'DELETE' });
}

export async function updatePassword(email: string, password: string): Promise<void> {
  await adminRequest(`/user/${encodeURIComponent(email)}`, {
    method: 'PATCH',
    body: JSON.stringify({ password })
  });
}

export async function listAliases(domain?: string): Promise<MailuAlias[]> {
  const path = domain ? `/alias?domain=${encodeURIComponent(domain)}` : '/alias';
  return (await adminRequest(path)) as MailuAlias[];
}