// Spark QR — public redirect (the "núcleo").
//
//   GET  qr.sparkleads.com/{slug}
//     -> lookup active slug
//     -> 302 redirect to target_url   (this is the only thing on the hot path)
//     -> register the scan event fire-and-forget via EdgeRuntime.waitUntil
//
// A slow scan insert never delays the redirect: the response is built and
// returned first, the insert runs after the response is flushed.
//
// Geolocation: read from whatever the fronting CDN injects
// (x-vercel-ip-country / cf-ipcountry / x-country). IPs are never stored raw —
// they are hashed (sha256 + per-install salt) inside Postgres.
//
// verify_jwt MUST be false for this function (it is a public endpoint).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
);

// Slugs the redirect must never try to resolve (mirrors qr.reserved_slugs,
// short-circuits the DB round trip for obvious noise like favicon.ico).
const IGNORE = new Set(['favicon.ico', 'robots.txt', 'sitemap.xml', '', 'health', 'healthz']);

function notFound(slug: string): Response {
  const html = `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Link não encontrado</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background:#0b1020; color:#e5e7eb; }
  .card { text-align:center; padding:2.5rem; max-width:28rem; }
  .spark { font-size:3rem; line-height:1; }
  h1 { font-size:1.25rem; margin:1rem 0 .25rem; }
  p { color:#9ca3af; font-size:.9rem; margin:.25rem 0; }
  code { background:#1f2937; padding:.15rem .4rem; border-radius:.3rem; color:#93c5fd; }
</style></head>
<body><div class="card">
  <div class="spark">⚡️</div>
  <h1>Esse link não existe (ou foi desativado)</h1>
  <p>Não encontramos um destino para <code>/${slug.replace(/[<>&"]/g, '')}</code>.</p>
  <p>Confira o endereço ou peça um novo QR.</p>
</div></body></html>`;
  return new Response(html, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function firstIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip');
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('method_not_allowed', { status: 405 });
  }

  const url = new URL(req.url);
  // Everything after the function mount point is the slug. Works whether the
  // request lands as /{slug} (custom domain) or /functions/v1/spark-qr-redirect/{slug}.
  const raw = url.pathname.replace(/^.*\/spark-qr-redirect/, '').replace(/^\/+/, '');
  const slug = decodeURIComponent(raw.split('/')[0] ?? '').toLowerCase().trim();

  if (!slug || IGNORE.has(slug)) return notFound(slug);

  let target: string | null = null;
  let qrId: string | null = null;
  try {
    const { data } = await supabase.rpc('spark_qr_lookup', { p_slug: slug });
    if (data && (data as any).target_url) {
      target = (data as any).target_url;
      qrId = (data as any).id;
    }
  } catch (_e) {
    // DB hiccup — fall through to 404 rather than hang the scanner.
  }

  if (!target || !qrId) return notFound(slug);

  // Fire-and-forget the scan event. The redirect does not wait for it.
  const ip = firstIp(req);
  const country =
    req.headers.get('x-vercel-ip-country') ??
    req.headers.get('cf-ipcountry') ??
    req.headers.get('x-country') ??
    null;
  const city =
    req.headers.get('x-vercel-ip-city') ??
    req.headers.get('cf-ipcity') ??
    req.headers.get('x-city') ??
    null;
  const userAgent = req.headers.get('user-agent');

  const record = supabase
    .rpc('spark_qr_insert_scan', {
      p_qr_id: qrId,
      p_ip: ip,
      p_user_agent: userAgent,
      p_country: country,
      p_city: city ? decodeURIComponent(city) : null,
    })
    .then(() => {})
    .catch(() => {});

  try {
    // @ts-ignore EdgeRuntime is provided by the Supabase edge runtime.
    EdgeRuntime.waitUntil(record);
  } catch (_e) {
    // Local/dev runtime without EdgeRuntime — best effort, don't block.
  }

  return new Response(null, {
    status: 302,
    headers: {
      location: target,
      'cache-control': 'no-store, no-cache, must-revalidate',
      'referrer-policy': 'no-referrer-when-downgrade',
    },
  });
});
