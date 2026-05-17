import { API_URL, getSecret } from './config';
import type { AppState } from '@/types';

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const secret = getSecret();
  if (!secret) throw new ApiError('missing_secret', 401);

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-soneko-app-secret': secret,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* keep null */ }

  if (!res.ok) {
    throw new ApiError(data?.error ?? `http_${res.status}`, res.status);
  }
  return data as T;
}

export const api = {
  getState: () => call<AppState>('GET', '/state'),
  skip: (assignment_id: string, target_rep_id: string | null, reason?: string) =>
    call<{ ok: true; rep: { id: string; name: string; ghl_user_id: string }; sync: string; error: string | null }>(
      'POST', '/skip', { assignment_id, target_rep_id, reason }),
  toggleRep: (rep_id: string, active: boolean) =>
    call<{ ok: true }>('POST', '/reps/toggle', { rep_id, active }),
  reorderReps: (ordered_rep_ids: string[]) =>
    call<{ ok: true }>('POST', '/reps/reorder', { ordered_rep_ids }),
};

export { ApiError };
