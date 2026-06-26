import { API_URL, getSecret } from './config';
import type { Analytics, CreateInput, QrCode, SlugCheck, UpdateInput } from './types';

export class ApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const secret = getSecret();
  if (!secret) throw new ApiError('missing_secret', 401);

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-spark-secret': secret,
    },
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
