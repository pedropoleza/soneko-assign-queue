// Integração GoHighLevel — OAuth (D1) isolado numa camada só (mitigação de risco
// "mudança de contrato da API"). V2 usa esta mesma camada para custom fields.

import { conf } from './config.ts';

const GHL_TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token';
const GHL_AUTHORIZE_URL = 'https://marketplace.gohighlevel.com/oauth/chooselocation';

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: conf('GHL_CLIENT_ID') ?? '',
    redirect_uri: conf('GHL_OAUTH_REDIRECT_URI') ?? '',
    scope: 'locations.readonly contacts.readonly contacts.write',
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
    redirect_uri: conf('GHL_OAUTH_REDIRECT_URI') ?? '',
  });
}

export function refreshToken(refresh_token: string): Promise<GhlToken> {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token });
}
