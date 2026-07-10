// spark-oauth — instalação do app GHL (D1). Dois caminhos:
//   GET /spark-oauth/install   → redireciona para o consent do GHL
//   GET /spark-oauth/callback  → troca code por token, provisiona a account,
//                                emite session e volta pro painel com ?session=
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

    if (path === '/callback') {
      const code = url.searchParams.get('code');
      if (!code) return json({ error: 'missing_code' }, 400);

      const token = await exchangeCode(code);
      if (!token.locationId) return json({ error: 'no_location_in_token' }, 400);

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
