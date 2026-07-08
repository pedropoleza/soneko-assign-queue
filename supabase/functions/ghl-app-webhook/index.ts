// GHL marketplace app — webhook sink.
//
// The Spark QR SSO flow does not need webhooks, but the app config has a webhook
// URL field, so this endpoint accepts and acknowledges GHL events (INSTALL /
// UNINSTALL, etc.) so nothing errors. Events are recorded in qr.debug_loc for
// visibility; wire real handling here later if the app's scope grows.
//
// verify_jwt MUST be false (GHL calls this unauthenticated).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
);

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const body = await req.json().catch(() => ({}));
  const type = body?.type ?? body?.event ?? 'unknown';
  const loc = body?.locationId ?? body?.companyId ?? '';
  try {
    await supabase.rpc('qr_debug_loc', {
      p_location: `webhook type=${JSON.stringify(type)} loc=${JSON.stringify(loc)}`,
      p_method: 'POST', p_path: '/ghl-app-webhook', p_ua: '',
    });
  } catch { /* best effort */ }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
