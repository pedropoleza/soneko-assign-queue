// spark-oauth — instalação do app GHL (D1). Dois caminhos:
//   GET /spark-oauth/install   → redireciona para o consent do GHL
//   GET /spark-oauth/callback  → troca code por token, provisiona a account,
//                                emite session e volta pro painel com ?session=
import CryptoJS from 'https://esm.sh/crypto-js@4.2.0';
import { serviceClient } from '../_shared/supabase.ts';
import { authorizeUrl, exchangeCode, getUserName } from '../_shared/ghl.ts';
import { mintSession } from '../_shared/session.ts';
import { corsHeaders, json, preflight } from '../_shared/cors.ts';
import { conf, loadConfig } from '../_shared/config.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  const db = serviceClient();
  await loadConfig(db);
  const url = new URL(req.url);
  const path = url.pathname.replace(/.*\/spark-oauth/, '');

  try {
    if (path === '/install' || path === '' || path === '/') {
      const state = crypto.randomUUID();
      return Response.redirect(authorizeUrl(state), 302);
    }

    // Abertura da custom page dentro do GHL: recebe location_id (merge field),
    // resolve a conta já instalada e entra logado. Se não estiver instalada,
    // inicia o OAuth.
    if (path === '/enter') {
      const locationId = url.searchParams.get('location_id');
      const appUrl = conf('APP_URL') ?? '';
      if (!locationId) return json({ error: 'missing_location_id' }, 400);
      const { data: account } = await db
        .from('accounts')
        .select('id')
        .eq('ghl_location_id', locationId)
        .maybeSingle();
      if (!account) {
        return Response.redirect(authorizeUrl(crypto.randomUUID()), 302);
      }
      const session = await mintSession(account.id);
      return Response.redirect(`${appUrl}/?session=${encodeURIComponent(session)}`, 302);
    }

    // SSO da Custom Page do app: o GHL entrega os dados do usuário/location
    // criptografados (AES com a Shared Key). Decripta, resolve a conta da
    // activeLocation e devolve a sessão. Não confia em id vindo da URL.
    if (path === '/sso' && req.method === 'POST') {
      const secret = conf('GHL_WEBHOOK_SECRET');
      if (!secret) return json({ error: 'sso_not_configured' }, 500);
      const raw = await req.json().catch(() => ({}));
      const encrypted = (raw as { encrypted?: string }).encrypted;
      if (!encrypted) return json({ error: 'missing_encrypted' }, 400);
      let data: { activeLocation?: string; userName?: string; email?: string; userId?: string };
      try {
        const decrypted = CryptoJS.AES.decrypt(encrypted, secret).toString(CryptoJS.enc.Utf8);
        data = JSON.parse(decrypted);
      } catch {
        return json({ error: 'sso_decrypt_failed' }, 400);
      }
      const locationId = data.activeLocation;
      if (!locationId) return json({ error: 'no_active_location', got: Object.keys(data ?? {}) }, 400);
      const { data: account } = await db
        .from('accounts')
        .select('id, owner_name')
        .eq('ghl_location_id', locationId)
        .maybeSingle();
      if (!account) return json({ error: 'not_installed', location_id: locationId }, 404);
      if (!account.owner_name && data.userName) {
        await db.from('accounts').update({ owner_name: data.userName }).eq('id', account.id);
      }
      const session = await mintSession(account.id);
      return json({ session });
    }

    if (path === '/callback') {
      const code = url.searchParams.get('code');
      if (!code) return json({ error: 'missing_code' }, 400);

      const token = await exchangeCode(code);
      if (!token.locationId) {
        return json(
          { error: 'no_location_in_token', got: { userType: token.userType, companyId: token.companyId, scope: token.scope } },
          400,
        );
      }

      // nome do usuário que instalou/acessa — titular padrão da voz
      const ownerName = token.userId ? await getUserName(token.access_token, token.userId) : null;

      // upsert da account por location
      const { data: account, error: accErr } = await db
        .from('accounts')
        .upsert(
          {
            ghl_location_id: token.locationId,
            ghl_company_id: token.companyId ?? null,
            company_name: token.locationId, // refinado depois via API do GHL
            ...(ownerName ? { owner_name: ownerName } : {}),
          },
          { onConflict: 'ghl_location_id' },
        )
        .select()
        .single();
      if (accErr || !account) return json({ error: 'account_upsert_failed', detail: accErr?.message }, 500);

      // guarda/atualiza tokens OAuth
      await db.from('oauth_tokens').upsert(
        {
          account_id: account.id,
          access_token: token.access_token,
          refresh_token: token.refresh_token,
          expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
          scope: token.scope,
        },
        { onConflict: 'account_id' },
      );

      const session = await mintSession(account.id);
      const appUrl = conf('APP_URL') ?? '';
      return Response.redirect(`${appUrl}/?session=${encodeURIComponent(session)}`, 302);
    }

    return json({ error: 'not_found' }, 404);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'oauth_error', detail: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
