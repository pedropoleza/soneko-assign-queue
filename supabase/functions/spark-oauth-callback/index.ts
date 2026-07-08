// Spark QR — OAuth redirect callback for the marketplace app.
//
// GHL sends the browser here with ?code=… after a user installs/authorizes the
// app on a location. We exchange the code for tokens (using the app's client id
// + secret from qr.app_config), store them per location, and show a small
// success page.
//
// NOTE: named "spark-*" (no "ghl"/"highlevel" in the path) — HighLevel rejects
// redirect/webhook URLs that reference its brand.
//
// verify_jwt MUST be false (called unauthenticated as a browser redirect).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
);

function html(status: number, title: string, msg: string) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <title>${title}</title>
     <div style="font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.5rem;text-align:center">
       <div style="font-size:2.5rem">${status < 400 ? '✅' : '⚠️'}</div>
       <h1 style="font-size:1.25rem;margin:.5rem 0">${title}</h1>
       <p style="color:#555">${msg}</p>
     </div>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  if (!code) return html(400, 'Faltou o código', 'Nenhum authorization code recebido.');

  const { data: app } = await supabase.rpc('qr_ghl_app');
  const clientId = app?.client_id;
  const clientSecret = app?.client_secret;
  if (!clientId || !clientSecret) return html(500, 'App não configurado', 'Client ID/secret ausentes na configuração.');

  const redirectUri = `${url.origin}${url.pathname}`;
  const form = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    user_type: 'Location',
    redirect_uri: redirectUri,
  });

  let token: any;
  try {
    const r = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: form.toString(),
    });
    token = await r.json();
    if (!r.ok) return html(502, 'Falha na troca de token', String(token?.message ?? r.status));
  } catch (e) {
    return html(502, 'Erro ao contatar o servidor', (e as Error).message);
  }

  const expiresAt = token.expires_in
    ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString()
    : null;

  try {
    await supabase.rpc('qr_ghl_oauth_upsert', {
      p_location_id: token.locationId ?? '',
      p_company_id: token.companyId ?? '',
      p_user_type: token.userType ?? 'Location',
      p_access_token: token.access_token ?? '',
      p_refresh_token: token.refresh_token ?? '',
      p_expires_at: expiresAt,
      p_scope: token.scope ?? '',
      p_raw: token,
    });
  } catch {
    /* storing is best-effort; install still succeeded */
  }

  return html(200, 'Spark QR instalado', 'App conectado a esta conta. Já pode fechar esta aba e abrir o Spark QR no menu.');
});
