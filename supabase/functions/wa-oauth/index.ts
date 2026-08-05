// ---------------------------------------------------------------------------
// Spark Talk Link — instalação OAuth e SSO do iframe.
//
//   GET  /wa-oauth/install   -> manda o usuário escolher a location no GHL
//   GET  /wa-oauth/callback  -> troca o code por token, cria a conta, abre o app
//   POST /wa-oauth/sso       -> decodifica o payload SSO do iframe e devolve o
//                               app_secret (assim o cliente nunca vê o segredo na URL)
//
// verify_jwt = false.
// ---------------------------------------------------------------------------

import CryptoJS from 'https://esm.sh/crypto-js@4.2.0';
import { serviceClient } from '../_shared/supabase.ts';
import { conf, loadConfig } from '../_shared/config.ts';
import { json, preflight } from '../_shared/cors.ts';
import { authorizeUrl, exchangeCode, getLocationName } from '../_shared/ghl.ts';

function appUrl(): string {
  return (conf('WA_APP_URL') ?? '').replace(/\/+$/, '');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();

  const db = serviceClient();
  await loadConfig(db);

  const url = new URL(req.url);
  const path = url.pathname.replace(/.*\/wa-oauth/, '').replace(/\/+$/, '') || '/';

  try {
    if (path === '/' || path === '/install') {
      return Response.redirect(authorizeUrl(crypto.randomUUID()), 302);
    }

    if (path === '/callback') {
      const code = url.searchParams.get('code');
      if (!code) return json({ error: 'missing_code' }, 400);

      const token = await exchangeCode(code);
      if (!token.locationId) {
        return json(
          { error: 'no_location_in_token', got: { userType: token.userType, companyId: token.companyId } },
          400,
        );
      }

      const name = (await getLocationName(token.access_token, token.locationId)) ?? '';

      const { data, error } = await db.rpc('wa_upsert_install', {
        p_location_id: token.locationId,
        p_company_id: token.companyId ?? '',
        p_name: name,
        p_access: token.access_token,
        p_refresh: token.refresh_token,
        p_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
        p_scope: token.scope,
      });
      if (error) return json({ error: 'install_failed', detail: error.message }, 500);

      const account = data as { app_secret: string };
      const target = appUrl();
      if (!target) return json({ ok: true, installed: true, app_secret: account.app_secret });
      // A rota /links não existe mais — o app abre na raiz.
      return Response.redirect(
        `${target}/?secret=${encodeURIComponent(account.app_secret)}&location_id=${encodeURIComponent(token.locationId)}`,
        302,
      );
    }

    if (path === '/sso' && req.method === 'POST') {
      const ssoKey = conf('GHL_SSO_KEY');
      if (!ssoKey) return json({ error: 'sso_not_configured' }, 500);

      const raw = (await req.json().catch(() => ({}))) as { encrypted?: string };
      if (!raw.encrypted) return json({ error: 'missing_encrypted' }, 400);

      let data: { activeLocation?: string; userName?: string; email?: string; userId?: string };
      try {
        const decrypted = CryptoJS.AES.decrypt(raw.encrypted, ssoKey).toString(CryptoJS.enc.Utf8);
        data = JSON.parse(decrypted);
      } catch {
        return json({ error: 'sso_decrypt_failed' }, 400);
      }

      const locationId = data.activeLocation;
      if (!locationId) return json({ error: 'no_active_location' }, 400);

      const { data: secret } = await db.rpc('wa_secret_for_location', { p_location_id: locationId });
      if (!secret) return json({ error: 'not_installed', location_id: locationId }, 404);

      return json({ secret, location_id: locationId, user_name: data.userName ?? null });
    }

    return json({ error: 'not_found', path }, 404);
  } catch (e) {
    return json({ error: 'oauth_error', detail: String(e) }, 500);
  }
});
