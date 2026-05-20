import { API_URL, getSecret } from './config';
import type { AppState, DistributionByRep, TagRule } from '@/types';

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
  distribution: (days = 30) => call<{ days: number; by_rep: DistributionByRep[] }>('GET', `/distribution?days=${days}`),
  contact: (id: string) => call<any>('GET', `/contact/${id}`),

  skip: (assignment_id: string, target_rep_id: string | null, reason?: string) =>
    call<{ ok: true; rep: { id: string; name: string; ghl_user_id: string }; sync: string; error: string | null }>(
      'POST', '/skip', { assignment_id, target_rep_id, reason }),
  bulkSkip: (assignment_ids: string[], target_rep_id: string | null, reason?: string) =>
    call<{ ok: true; results: any[] }>('POST', '/bulk-skip', { assignment_ids, target_rep_id, reason }),
  bulkRandom: (assignment_ids: string[]) =>
    call<{ ok: true; results: any[]; summary: Record<string, number> }>('POST', '/bulk-random', { assignment_ids }),
  retry: (assignment_id: string) =>
    call<{ ok: true; rep: any; sync: string; error: string | null }>('POST', '/retry', { assignment_id }),

  toggleRep: (rep_id: string, active: boolean) =>
    call<{ ok: true }>('POST', '/reps/toggle', { rep_id, active }),
  reorderReps: (ordered_rep_ids: string[]) =>
    call<{ ok: true }>('POST', '/reps/reorder', { ordered_rep_ids }),
  updateRepSettings: (rep_id: string, settings: {
    weight?: number;
    vacation_start?: string | null;
    vacation_end?: string | null;
    working_hours_start?: string | null;
    working_hours_end?: string | null;
    timezone?: string;
  }) => call<{ ok: true; rep: any }>('POST', '/reps/settings', { rep_id, ...settings }),

  setNextRep: (rep_id: string) =>
    call<{ ok: true; next_rep: { id: string; name: string } }>('POST', '/queue/set-next', { rep_id }),
  advanceQueue: () =>
    call<{ ok: true; next_rep: { id: string; name: string } }>('POST', '/queue/advance', {}),

  listTagRules: () => call<TagRule[]>('GET', '/tag-rules'),
  upsertTagRule: (tag: string, rep_id: string, priority = 100) =>
    call<{ ok: true }>('POST', '/tag-rules/upsert', { tag, rep_id, priority }),
  deleteTagRule: (id: string) =>
    call<{ ok: true }>('POST', '/tag-rules/delete', { id }),
};

export { ApiError };
