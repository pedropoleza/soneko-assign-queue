import { API_URL, getLocationId, getSecret, readLocationFromUrl, setLocationId } from './config';
import { requestGhlEncryptedSession } from './lib/ghlSso';
import type { Analytics, CreateInput, Overview, QrCode, SlugCheck, UpdateInput } from './types';

export class ApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  // Every call must carry the admin secret (delivered via the GHL menu link
  // ?secret=… and kept in localStorage). No secret → no access.
  const secret = getSecret();
  if (!secret) throw new ApiError('missing_secret', 401);

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-spark-secret': secret,
      'x-spark-location': getLocationId(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* keep null */ }

  if (!res.ok) throw new ApiError(data?.error ?? `http_${res.status}`, res.status);
  return data as T;
}

// Resolve which GHL location this panel session is scoped to, ONCE at startup.
// Authoritative path: ask GHL for the encrypted SSO session and have the backend
// decrypt it to the signed activeLocation. Fallback: a ?location_id= URL param.
// The resolved value is stored in config and sent on every later request.
export async function resolveLocation(): Promise<string> {
  try {
    const encryptedData = await requestGhlEncryptedSession();
    if (encryptedData) {
      const res = await call<{ locationId: string }>('POST', '/sso', { encryptedData });
      const loc = (res?.locationId ?? '').trim();
      setLocationId(loc);
      return loc;
    }
  } catch {
    /* fall through to URL fallback */
  }
  const fallback = readLocationFromUrl();
  setLocationId(fallback);
  return fallback;
}

export const api = {
  overview: (days = 30) => call<Overview>('GET', `/overview?days=${days}`),
  waNumber: () => call<{ phone: string }>('GET', '/wa-number'),
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
