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
  report: (startISO: string, endISO: string, source?: string | null) => call<{
    start: string; end: string;
    range_seconds: number;
    source_filter: string | null;
    by_rep: Array<{
      rep_id: string; name: string; avatar_url: string | null; active: boolean;
      position: number;
      total: number; skipped: number; failed: number; synced: number;
      first_at: string | null; last_at: string | null;
      best_day: string | null; best_day_count: number;
      active_days: number;
    }>;
    by_day: Array<{ day: string; count: number }>;
    by_source: Array<{ source: string; count: number }>;
    totals: { total: number; skipped: number; failed: number };
    previous: {
      start: string; end: string;
      total: number;
      by_rep: Record<string, number>;
    };
    top_tags: Array<{ tag: string; count: number }>;
  }>('GET', `/report?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}${source ? `&source=${encodeURIComponent(source)}` : ''}`),
  repAssignments: (repId: string, startISO: string, endISO: string, source?: string | null) => call<{
    total: number; limit: number;
    items: Array<{
      id: string; ghl_contact_id: string;
      contact_name: string | null; contact_email: string | null;
      contact_phone: string | null; contact_source: string | null;
      normalized_source: string | null;
      contact_tags: string[] | null;
      was_skipped: boolean; ghl_sync_status: string; ghl_sync_error: string | null;
      created_at: string;
    }>;
  }>('GET', `/report/rep/${encodeURIComponent(repId)}?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}${source ? `&source=${encodeURIComponent(source)}` : ''}`),
  contact: (id: string) => call<any>('GET', `/contact/${id}`),

  skip: (assignment_id: string, target_rep_id: string | null, reason?: string) =>
    call<{ ok: true; rep: { id: string; name: string; ghl_user_id: string }; sync: string; error: string | null }>(
      'POST', '/skip', { assignment_id, target_rep_id, reason }),
  bulkSkip: (assignment_ids: string[], target_rep_id: string | null, reason?: string) =>
    call<{ ok: true; results: any[] }>('POST', '/bulk-skip', { assignment_ids, target_rep_id, reason }),
  bulkRandom: (assignment_ids: string[], rep_ids?: string[] | null) =>
    call<{ ok: true; results: any[]; summary: Record<string, number> }>('POST', '/bulk-random', { assignment_ids, rep_ids: rep_ids ?? null }),
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

  listRecipients: () => call<Array<{
    id: string; name: string; phone: string;
    ghl_user_id: string | null; ghl_contact_id: string | null;
    default_period: string; default_source: string | null;
    default_format: string; notes: string | null;
    last_sent_at: string | null; created_at: string;
  }>>('GET', '/notifications/recipients'),
  saveRecipient: (body: {
    id?: string | null; name: string; phone: string;
    ghl_user_id?: string | null; ghl_contact_id?: string | null;
    default_period?: string; default_source?: string | null;
    default_format?: string; notes?: string | null;
  }) => call<any>('POST', '/notifications/recipients', body),
  deleteRecipient: (id: string) => call<{ ok: true }>('DELETE', `/notifications/recipients/${id}`),
  ghlUsers: () => call<{ users: Array<{ id: string; name: string; email: string; phone?: string }> }>('GET', '/ghl-users'),
  notificationPreview: (body: { period: string; source?: string | null; custom_start?: string; custom_end?: string }) =>
    call<{ period: string; source: string | null; message: string }>('POST', '/notifications/preview', body),
  notificationSend: (body: { recipient_id: string; period?: string; source?: string | null; custom_start?: string; custom_end?: string }) =>
    call<{ ok: true; contactId: string }>('POST', '/notifications/send', body),
};

export { ApiError };
