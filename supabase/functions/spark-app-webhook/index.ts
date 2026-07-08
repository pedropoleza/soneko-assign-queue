// Spark QR — marketplace app webhook sink.
//
// The SSO flow does not need webhooks, but the app config has a webhook URL
// field, so this endpoint accepts and acknowledges events so nothing errors.
// Events are recorded in qr.debug_loc for visibility.
//
// NOTE: named "spark-*" (no "ghl"/"highlevel" in the path) — HighLevel rejects
// redirect/webhook URLs that reference its brand.
//
// verify_jwt MUST be false (called unauthenticated).

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
      p_method: 'POST', p_path: '/spark-app-webhook', p_ua: '',
    });
  } catch { /* best effort */ }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
