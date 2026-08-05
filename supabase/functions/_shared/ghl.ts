import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { conf } from './config.ts';

const GHL_TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token';
const GHL_AUTHORIZE_URL = 'https://marketplace.gohighlevel.com/oauth/chooselocation';
const GHL_API = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

// Escopos mínimos para o app funcionar ponta a ponta.
// `conversations/message.readonly` é o que libera o webhook InboundMessage —
// sem ele não existe medição de "enviou de verdade".
export const SCOPES = [
  'locations.readonly',
  'contacts.readonly',
  'contacts.write',
  'conversations.readonly',
  'conversations/message.readonly',
  'locations/customFields.readonly',
  'locations/customFields.write',
  'locations/tags.readonly',
  'locations/tags.write',
  'users.readonly',
].join(' ');

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: conf('GHL_CLIENT_ID') ?? '',
    redirect_uri: conf('GHL_OAUTH_REDIRECT_URI') ?? '',
    scope: SCOPES,
    state,
  });
  return `${GHL_AUTHORIZE_URL}?${params.toString()}`;
}

export type GhlToken = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  locationId?: string;
  companyId?: string;
  userId?: string;
  userType?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<GhlToken> {
  const res = await fetch(GHL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: conf('GHL_CLIENT_ID') ?? '',
      client_secret: conf('GHL_CLIENT_SECRET') ?? '',
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`ghl_token_${res.status}:${await res.text()}`);
  return (await res.json()) as GhlToken;
}

export function exchangeCode(code: string): Promise<GhlToken> {
  return tokenRequest({
    grant_type: 'authorization_code',
    code,
    user_type: 'Location',
    redirect_uri: conf('GHL_OAUTH_REDIRECT_URI') ?? '',
  });
}

export function refreshToken(refresh_token: string): Promise<GhlToken> {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token, user_type: 'Location' });
}

/** Token válido da location, renovando quando falta menos de 1 min. */
export async function getAccessToken(db: SupabaseClient, locationId: string): Promise<string | null> {
  const { data } = await db.rpc('wa_get_tokens', { p_location_id: locationId });
  const row = data as { access_token?: string; refresh_token?: string; expires_at?: string } | null;
  if (!row?.access_token) return null;

  const exp = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (exp - Date.now() > 60_000) return row.access_token;
  if (!row.refresh_token) return row.access_token;

  try {
    const t = await refreshToken(row.refresh_token);
    await db.rpc('wa_save_tokens', {
      p_location_id: locationId,
      p_access: t.access_token,
      p_refresh: t.refresh_token,
      p_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
      p_scope: t.scope,
    });
    return t.access_token;
  } catch {
    return row.access_token;
  }
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Version: GHL_VERSION,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export async function getUserName(token: string, userId: string): Promise<string | null> {
  try {
    const res = await fetch(`${GHL_API}/users/${userId}`, { headers: headers(token) });
    if (!res.ok) return null;
    const u = (await res.json()) as { name?: string; firstName?: string; lastName?: string };
    return u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(' ') || null);
  } catch {
    return null;
  }
}

export async function getLocationName(token: string, locationId: string): Promise<string | null> {
  try {
    const res = await fetch(`${GHL_API}/locations/${locationId}`, { headers: headers(token) });
    if (!res.ok) return null;
    const d = (await res.json()) as { location?: { name?: string } };
    return d.location?.name ?? null;
  } catch {
    return null;
  }
}

// --- campos personalizados de atribuição ------------------------------------

export const ATTRIBUTION_FIELDS = [
  { key: 'wa_origem_parceiro', name: 'Origem — Parceiro' },
  { key: 'wa_origem_campanha', name: 'Origem — Campanha' },
  { key: 'wa_origem_codigo', name: 'Origem — Código' },
] as const;

const fieldCache = new Map<string, Record<string, string>>();

/** Garante que os campos de atribuição existem na location e devolve key→id. */
export async function ensureCustomFields(
  token: string,
  locationId: string,
): Promise<Record<string, string>> {
  const cached = fieldCache.get(locationId);
  if (cached) return cached;

  const map: Record<string, string> = {};
  try {
    const res = await fetch(`${GHL_API}/locations/${locationId}/customFields?model=contact`, {
      headers: headers(token),
    });
    if (res.ok) {
      const d = (await res.json()) as { customFields?: Array<{ id: string; fieldKey?: string; name?: string }> };
      for (const f of d.customFields ?? []) {
        const key = (f.fieldKey ?? '').replace(/^contact\./, '');
        const match = ATTRIBUTION_FIELDS.find((a) => a.key === key || a.name === f.name);
        if (match) map[match.key] = f.id;
      }
    }

    for (const f of ATTRIBUTION_FIELDS) {
      if (map[f.key]) continue;
      const res2 = await fetch(`${GHL_API}/locations/${locationId}/customFields`, {
        method: 'POST',
        headers: headers(token),
        body: JSON.stringify({ name: f.name, dataType: 'TEXT', model: 'contact', fieldKey: f.key }),
      });
      if (res2.ok) {
        const created = (await res2.json()) as { customField?: { id: string }; id?: string };
        const id = created.customField?.id ?? created.id;
        if (id) map[f.key] = id;
      }
    }
  } catch {
    /* seguimos com o que der — tags ainda funcionam */
  }

  fieldCache.set(locationId, map);
  return map;
}

export type AttributionPayload = {
  partnerName: string | null;
  linkName: string;
  code: string;
  slug: string;
  matchedBy: string;
  occurredAt: string;
};

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Escreve a atribuição no contato: tags + campos personalizados + nota. */
export async function writeAttribution(
  token: string,
  locationId: string,
  contactId: string,
  a: AttributionPayload,
): Promise<void> {
  const fields = await ensureCustomFields(token, locationId);

  const tags = ['talk-link'];
  if (a.partnerName) tags.push(`origem-${slugify(a.partnerName)}`);
  if (a.linkName) tags.push(`campanha-${slugify(a.linkName)}`);

  const customFields = [
    { id: fields.wa_origem_parceiro, value: a.partnerName ?? '' },
    { id: fields.wa_origem_campanha, value: a.linkName },
    { id: fields.wa_origem_codigo, value: a.code },
  ].filter((f) => !!f.id);

  const res = await fetch(`${GHL_API}/contacts/${contactId}`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify({ tags, ...(customFields.length ? { customFields } : {}) }),
  });
  if (!res.ok) throw new Error(`ghl_contact_update_${res.status}:${(await res.text()).slice(0, 300)}`);

  // A nota é o registro humano — quem abriu o CRM entende a origem na hora.
  await fetch(`${GHL_API}/contacts/${contactId}/notes`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      body:
        `📲 Lead veio do link rastreado /${a.slug}\n` +
        `• Parceiro: ${a.partnerName ?? '—'}\n` +
        `• Campanha: ${a.linkName}\n` +
        `• Código: ${a.code}\n` +
        `• Confirmação: ${a.matchedBy}\n` +
        `• Enviado em: ${a.occurredAt}`,
    }),
  }).catch(() => {});
}
