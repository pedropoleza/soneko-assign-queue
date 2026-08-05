// ---------------------------------------------------------------------------
// Spark Talk Link — redirecionador público.
//
//   GET  talk.sparkleads.com/{parceiro}/{campanha}?s=story&m=instagram&ct=a
//     -> resolve o link pelo caminho
//     -> lê os parâmetros de origem da própria URL (o "UTM da casa")
//     -> registra o clique (fora do caminho crítico)
//     -> 302 para wa.me/<numero>?text=<mensagem carimbada>
//
// Não existe página intermediária: todo o rastreio vive na URL e no 302.
//
// verify_jwt = false (endpoint público).
// ---------------------------------------------------------------------------

import { serviceClient } from '../_shared/supabase.ts';
import { conf, loadConfig } from '../_shared/config.ts';
import { stampMessage, whatsappUrl, type CodeMode } from '../_shared/tracking.ts';
import { clientIp, hashIp, parseUa } from '../_shared/ua.ts';

const IGNORE = new Set(['', 'favicon.ico', 'robots.txt', 'sitemap.xml', 'health', 'healthz', 'apple-touch-icon.png']);

// Aceitamos as abreviações curtas (bonitas de compartilhar) e os utm_* padrão,
// para quem já tem o hábito de colar UTM.
const PARAM_ALIASES: Record<string, string[]> = {
  src: ['s', 'src', 'source', 'utm_source', 'sl_src'],
  medium: ['m', 'med', 'medium', 'utm_medium', 'sl_med'],
  campaign: ['c', 'cmp', 'campanha', 'campaign', 'utm_campaign', 'sl_cmp'],
  content: ['ct', 'v', 'var', 'content', 'utm_content', 'sl_ct'],
  term: ['t', 'term', 'utm_term'],
};

function readParams(url: URL): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [field, aliases] of Object.entries(PARAM_ALIASES)) {
    let value: string | null = null;
    for (const a of aliases) {
      const v = url.searchParams.get(a);
      if (v && v.trim()) {
        value = v.trim().slice(0, 80).toLowerCase();
        break;
      }
    }
    out[field] = value;
  }
  return out;
}

function notFound(slug: string): Response {
  const safe = slug.replace(/[<>&"]/g, '');
  const html = `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Link indisponível</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background:#0F172A; color:#E2E8F0; }
  .card { text-align:center; padding:2.5rem; max-width:28rem; }
  .icon { font-size:3rem; line-height:1; }
  h1 { font-size:1.25rem; margin:1rem 0 .25rem; }
  p { color:#94A3B8; font-size:.9rem; margin:.25rem 0; }
  code { background:#1E293B; padding:.15rem .4rem; border-radius:.3rem; color:#6EE7B7; }
</style></head>
<body><div class="card">
  <div class="icon">💬</div>
  <h1>Esse link não está disponível</h1>
  <p>Não encontramos um destino para <code>/${safe}</code>.</p>
  <p>Confira o endereço ou peça um link novo.</p>
</div></body></html>`;
  return new Response(html, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

type Lookup = {
  link_id: string;
  account_id: string;
  destination_phone: string | null;
  message: string | null;
  code: string;
  code_mode: CodeMode;
  active: boolean;
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('method_not_allowed', { status: 405 });
  }

  const db = serviceClient();
  await loadConfig(db);

  const url = new URL(req.url);
  const raw = url.pathname.replace(/^.*\/wa-redirect/, '').replace(/^\/+/, '').replace(/\/+$/, '');
  // O slug pode ter dois níveis: /parceiro/campanha.
  const slug = decodeURIComponent(raw).toLowerCase().trim().split('/').slice(0, 2).join('/');
  if (!slug || IGNORE.has(slug)) return notFound(slug);

  let link: Lookup | null = null;
  try {
    const { data } = await db.rpc('wa_lookup', { p_slug: slug });
    if (data && (data as Lookup).link_id) link = data as Lookup;
  } catch {
    /* indisponibilidade do banco cai no 404 */
  }
  if (!link || !link.active || !link.destination_phone) return notFound(slug);

  const ua = req.headers.get('user-agent');
  const info = parseUa(ua);
  const params = readParams(url);

  // O clique não pode segurar o redirect — vai para o waitUntil.
  const record = (async () => {
    try {
      await db.rpc('wa_record_click', {
        p_link_id: link.link_id,
        p_token: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
        p_ip_hash: await hashIp(clientIp(req), conf('WA_CLICK_SALT') ?? 'spark-talk-link'),
        p_ua: ua,
        p_device: info.device,
        p_os: info.os,
        p_browser: info.browser,
        p_country:
          req.headers.get('cf-ipcountry') ??
          req.headers.get('x-vercel-ip-country') ??
          req.headers.get('x-country'),
        p_city: (() => {
          const c = req.headers.get('x-vercel-ip-city') ?? req.headers.get('x-city');
          try {
            return c ? decodeURIComponent(c) : null;
          } catch {
            return c;
          }
        })(),
        p_referer: req.headers.get('referer'),
        p_is_bot: info.isBot,
        p_src: params.src,
        p_medium: params.medium,
        p_campaign: params.campaign,
        p_content: params.content,
        p_term: params.term,
        p_query: url.search.replace(/^\?/, ''),
      });
    } catch {
      /* perder um clique é melhor do que perder o redirect */
    }
  })();

  try {
    // @ts-ignore EdgeRuntime é fornecido pelo runtime do Supabase.
    EdgeRuntime.waitUntil(record);
  } catch {
    /* runtime local */
  }

  const text = stampMessage(link.message ?? '', link.code, link.code_mode);
  const target = whatsappUrl(link.destination_phone, text);

  return new Response(null, {
    status: 302,
    headers: {
      location: target,
      'cache-control': 'no-store, no-cache, must-revalidate',
      'referrer-policy': 'no-referrer-when-downgrade',
    },
  });
});
