// Cliente das APIs do middleware Stevo DND (Supabase Edge Functions).
const env = import.meta.env;

const FUNCTIONS_BASE: string =
  (env.VITE_STEVO_FUNCTIONS_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1';

export const STEVO_WEBHOOK_URL = `${FUNCTIONS_BASE}/stevo-dnd`;

async function post<T>(fn: 'stevo-admin' | 'stevo-setup', payload: Record<string, unknown>): Promise<{ status: number; data: T }> {
  const res = await fetch(`${FUNCTIONS_BASE}/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { status: res.status, data: (await res.json()) as T };
}

// ── Admin ──────────────────────────────────────────────────────────────────

export interface StevoClientRow {
  id: string;
  clientName: string;
  locationId: string;
  active: boolean;
  blockOnAllInstances: boolean;
  instances: { name: string; active: boolean }[];
}

export interface AuditEntry {
  created_at: string;
  action: string;
  ghl_location_id: string;
  contact_id: string | null;
  phone: string | null;
  instance_name: string | null;
  success: boolean;
  message: string | null;
  source: string | null;
  reason: string | null;
}

export const adminApi = {
  list: (secret: string) =>
    post<{ clients?: StevoClientRow[]; error?: string }>('stevo-admin', { secret, action: 'list' }),
  create: (secret: string, clientName: string, ghlLocationId: string) =>
    post<{ created?: boolean; clientId?: string; setupToken?: string; expiresInDays?: number; error?: string }>(
      'stevo-admin',
      { secret, action: 'create', clientName, ghlLocationId },
    ),
  setupLink: (secret: string, clientId: string) =>
    post<{ setupToken?: string; expiresInDays?: number; error?: string }>('stevo-admin', {
      secret,
      action: 'setupLink',
      clientId,
    }),
  toggleClient: (secret: string, clientId: string, active: boolean) =>
    post<{ updated?: boolean; error?: string }>('stevo-admin', { secret, action: 'toggleClient', clientId, active }),
  audit: (secret: string, locationId?: string) =>
    post<{ entries?: AuditEntry[]; error?: string }>('stevo-admin', { secret, action: 'audit', locationId }),
};

/** Monta o link de setup apontando para ESTE app (a tela é daqui). */
export function buildSetupUrl(token: string): string {
  return `${window.location.origin}${window.location.pathname}?page=stevo-setup&token=${token}`;
}

// ── Setup ──────────────────────────────────────────────────────────────────

export interface SetupInstance {
  id?: string;
  name: string;
  serverUrl: string;
  maskedKey?: string;
  apiKey?: string;
  active: boolean;
}

export interface GhlConfig {
  webhookUrl: string;
  secretHeader: string;
  secretValue: string;
  locationId: string;
  blockBody: Record<string, string>;
  unblockBody: Record<string, string>;
}

export const setupApi = {
  load: (token: string) =>
    post<{ clientName?: string; locationId?: string; instances?: SetupInstance[]; error?: string }>('stevo-setup', {
      token,
      action: 'load',
    }),
  test: (token: string, serverUrl: string, apiKey: string, instanceId?: string) =>
    post<{ ok?: boolean; message?: string; error?: string }>('stevo-setup', {
      token,
      action: 'test',
      serverUrl,
      apiKey,
      instanceId,
    }),
  save: (token: string, instances: SetupInstance[]) =>
    post<{ saved?: boolean; ghlConfig?: GhlConfig; error?: string }>('stevo-setup', {
      token,
      action: 'save',
      instances,
    }),
};
