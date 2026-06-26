import { API_URL, getSecret } from './config';
import type { Analytics, CreateInput, QrCode, SlugCheck, UpdateInput } from './types';

export class ApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  // Secret is optional: the admin function authorizes itself server-side when
  // no secret is supplied. Sending one (?secret= / localStorage) still works if
  // you later choose to lock the API down.
  const secret = getSecret();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers['x-spark-secret'] = secret;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* keep null */ }

  if (!res.ok) throw new ApiError(data?.error ?? `http_${res.status}`, res.status);
  return data as T;
}

export const api = {
  list: () => call<QrCode[]>('GET', '/qrs'),
  get: (id: string) => call<QrCode>('GET', `/qrs/${id}`),
  create: (input: CreateInput) => call<QrCode>('POST', '/qrs', input),
  update: (id: string, input: UpdateInput) => call<QrCode>('PATCH', `/qrs/${id}`, input),
  remove: (id: string) => call<{ ok: true; id: string }>('DELETE', `/qrs/${id}`),
  checkSlug: (slug: string, excludeId?: string | null) =>
    call<SlugCheck>(
      'GET',
      `/check-slug?slug=${encodeURIComponent(slug)}${excludeId ? `&exclude=${excludeId}` : ''}`,
    ),
  analytics: (id: string, days = 30) =>
    call<Analytics>('GET', `/qrs/${id}/analytics?days=${days}`),
};
