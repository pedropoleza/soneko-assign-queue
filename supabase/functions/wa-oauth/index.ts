// ---------------------------------------------------------------------------
// Spark Talk Link — instalação OAuth e SSO do iframe.
//
//   GET  /wa-oauth/install   -> manda o usuário escolher onde instalar
//   GET  /wa-oauth/callback  -> troca o code por token e cria as contas
//   POST /wa-oauth/sso       -> decodifica o payload SSO do iframe e devolve o
//                               app_secret (o cliente nunca vê o segredo na URL)
//
// O callback aceita os dois tipos de instalação:
//   • Sub-conta — o token já vem com locationId; cria uma conta e abre o app.
//   • Agência   — o token vem como Company, sem locationId. Nesse caso usamos
//                 o token da agência para listar as sub-contas onde o app foi
//                 instalado e cunhar um token para cada uma.
//
// verify_jwt = false.
// ---------------------------------------------------------------------------

import CryptoJS from 'https://esm.sh/crypto-js@4.2.0';
import { serviceClient } from '../_shared/supabase.ts';
import { conf, loadConfig } from '../_shared/config.ts';
import { json, preflight } from '../_shared/cors.ts';
import {
  authorizeUrl,
  exchangeCode,
  getInstalledLocations,
  getLocationName,
  mintLocationToken,
} from '../_shared/ghl.ts';

function appUrl(): string {
  return (conf('WA_APP_URL') ?? '').replace(/\/+$/, '');
}

function openApp(secret: string, locationId: string): Response {
  const target = appUrl();
  if (!target) return json({ ok: true, installed: true, app_secret: secret });
  return Response.redirect(
    `${target}/?secret=${encodeURIComponent(secret)}&location_id=${encodeURIComponent(locationId)}`,
    302,
  );
}

const esc = (s: string) => s.replace(/[<>&"]/g, '');

/** Página de escolha quando a agência instala em várias sub-contas de uma vez. */
function chooserPage(rows: Array<{ id: string; name: string; secret: string }>): Response {
  const target = appUrl();
  const items = rows
    .map(
      (r) => `<li><a href="${target}/?secret=${encodeURIComponent(r.secret)}&location_id=${encodeURIComponent(r.id)}">
        <strong>${esc(r.name || r.id)}</strong><span>${esc(r.id)}</span></a></li>`,
    )
    .join('');

  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Talk Link instalado</title>
<style>
 body{margin:0;min-height:100vh;display:grid;place-items:center;background:#FAFBFD;color:#111827;
   font:400 15px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
 .box{width:min(520px,calc(100vw - 32px));background:#fff;border:1px solid #EAEFF5;border-radius:14px;padding:28px}
 h1{margin:0 0 4px;font-size:19px;letter-spacing:-.014em}
 p{margin:0 0 20px;color:#525F73;font-size:14px}
 ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}
 a{display:flex;flex-direction:column;gap:2px;padding:12px 14px;border:1px solid #EAEFF5;border-radius:10px;
   text-decoration:none;color:inherit;transition:background .15s,border-color .15s}
 a:hover{background:#F6F8FB;border-color:#D6DEE7}
 span{color:#919EAF;font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
</style></head><body><div class="box">
 <h1>Talk Link instalado</h1>
 <p>${rows.length} ${rows.length === 1 ? 'sub-conta pronta' : 'sub-contas prontas'}. Escolha por qual começar — no CRM o app abre sozinho na conta certa.</p>
 <ul>${items}</ul>
</div></body></html>`,
    { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  );
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
      const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

      // --- instalação por sub-conta ---------------------------------------
      if (token.locationId) {
        const name = (await getLocationName(token.access_token, token.locationId)) ?? '';
        const { data, error } = await db.rpc('wa_upsert_install', {
          p_location_id: token.locationId,
          p_company_id: token.companyId ?? '',
          p_name: name,
          p_access: token.access_token,
          p_refresh: token.refresh_token,
          p_expires_at: expiresAt,
          p_scope: token.scope,
        });
        if (error) return json({ error: 'install_failed', detail: error.message }, 500);
        return openApp((data as { app_secret: string }).app_secret, token.locationId);
      }

      // --- instalação pela agência ----------------------------------------
      if (!token.companyId) {
        return json({ error: 'no_location_and_no_company', got: { userType: token.userType } }, 400);
      }

      await db.rpc('wa_save_agency', {
        p_company_id: token.companyId,
        p_access: token.access_token,
        p_refresh: token.refresh_token,
        p_expires_at: expiresAt,
        p_scope: token.scope,
      });

      let locations;
      try {
        locations = await getInstalledLocations(token.access_token, token.companyId);
      } catch (e) {
        return json(
          {
            error: 'installed_locations_failed',
            detail: String(e),
            hint: 'A agência está conectada, mas não consegui listar as sub-contas. Instale o app numa sub-conta pelo painel do GHL.',
          },
          502,
        );
      }

      const ready: Array<{ id: string; name: string; secret: string }> = [];
      const failed: Array<{ id: string; name: string | null; error: string }> = [];

      for (const loc of locations) {
        try {
          const lt = await mintLocationToken(token.access_token, token.companyId, loc.id);
          const { data, error } = await db.rpc('wa_upsert_install', {
            p_location_id: loc.id,
            p_company_id: token.companyId,
            p_name: loc.name ?? '',
            p_access: lt.access_token,
            p_refresh: lt.refresh_token ?? '',
            p_expires_at: new Date(Date.now() + (lt.expires_in ?? 86400) * 1000).toISOString(),
            p_scope: lt.scope ?? token.scope,
          });
          if (error) throw new Error(error.message);
          ready.push({ id: loc.id, name: loc.name ?? loc.id, secret: (data as { app_secret: string }).app_secret });
        } catch (e) {
          failed.push({ id: loc.id, name: loc.name, error: String(e).slice(0, 200) });
        }
      }

      if (ready.length === 0) {
        return json(
          {
            error: 'no_sub_accounts_installed',
            company_id: token.companyId,
            failed,
            hint: 'A agência está conectada, mas o app ainda não está ativo em nenhuma sub-conta. Ative numa sub-conta e abra este link de novo.',
          },
          409,
        );
      }

      if (ready.length === 1) return openApp(ready[0].secret, ready[0].id);
      return chooserPage(ready);
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
