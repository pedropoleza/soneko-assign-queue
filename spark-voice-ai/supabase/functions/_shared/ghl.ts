// Integração GoHighLevel — OAuth (D1) + chamadas de API da location, isoladas
// numa camada só (mitigação de risco "mudança de contrato da API").
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { conf } from './config.ts';

const GHL_TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token';
const GHL_AUTHORIZE_URL = 'https://marketplace.gohighlevel.com/oauth/chooselocation';
const GHL_API = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: conf('GHL_CLIENT_ID') ?? '',
    redirect_uri: conf('GHL_OAUTH_REDIRECT_URI') ?? '',
    scope: 'locations.readonly contacts.readonly contacts.write users.readonly',
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
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
    user_type: 'Location', // emite token com locationId (senão vem token de company)
    redirect_uri: conf('GHL_OAUTH_REDIRECT_URI') ?? '',
  });
}

export function refreshToken(refresh_token: string): Promise<GhlToken> {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token });
}

// Retorna um access_token válido para a conta, renovando via refresh_token se
// estiver expirado (ou perto de expirar) e persistindo o novo token.
export async function getAccessToken(db: SupabaseClient, accountId: string): Promise<string | null> {
  const { data: row } = await db.from('oauth_tokens').select('*').eq('account_id', accountId).maybeSingle();
  if (!row) return null;
  const exp = new Date(row.expires_at).getTime();
  if (exp - Date.now() > 60_000) return row.access_token;
  try {
    const t = await refreshToken(row.refresh_token);
    await db
      .from('oauth_tokens')
      .update({
        access_token: t.access_token,
        refresh_token: t.refresh_token,
        expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
        scope: t.scope,
      })
      .eq('account_id', accountId);
    return t.access_token;
  } catch {
    return row.access_token; // melhor esforço
  }
}

function apiHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, Version: GHL_VERSION, Accept: 'application/json' };
}

// Nome do usuário GHL (ex.: quem instalou/opera). Usado como titular padrão da voz.
export async function getUserName(token: string, userId: string): Promise<string | null> {
  try {
    const res = await fetch(`${GHL_API}/users/${userId}`, { headers: apiHeaders(token) });
    if (!res.ok) return null;
    const u = (await res.json()) as { name?: string; firstName?: string; lastName?: string };
    return u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(' ') || null);
  } catch {
    return null;
  }
}

export type Snippet = { id: string; name: string; body: string };

// Snippets/valores reutilizáveis da location. A API v2 pública do GHL não expõe
// os "Snippets" do compositor diretamente; usamos os Custom Values da location
// (texto reutilizável por location). Trocar o endpoint aqui se o cliente quiser
// outra fonte. Retorna [] em qualquer falha (a UI tolera vazio).
export async function getSnippets(token: string, locationId: string): Promise<Snippet[]> {
  try {
    const res = await fetch(`${GHL_API}/locations/${locationId}/customValues`, { headers: apiHeaders(token) });
    if (!res.ok) return [];
    const data = (await res.json()) as { customValues?: Array<{ id: string; name: string; value?: string }> };
    return (data.customValues ?? []).map((c) => ({ id: c.id, name: c.name, body: c.value ?? '' }));
  } catch {
    return [];
  }
}
