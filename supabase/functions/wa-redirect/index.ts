// ---------------------------------------------------------------------------
// Spark Talk Link — redirecionador público.
//
//   GET  talk.sparkleads.com/{parceiro}/{campanha}?s=story&m=instagram&ct=a
//     -> resolve o link pelo caminho
//     -> lê os parâmetros de origem da própria URL (o "UTM da casa")
//     -> registra o clique (fora do caminho crítico)
//     -> desktop e crawler: 302 para wa.me/<numero>?text=<mensagem carimbada>
//     -> celular: página de salto que abre o app pelo esquema whatsapp://
//
//   GET|POST  /__open?t={click_token}
//     -> confirma que o WhatsApp assumiu, disparado pela página de salto
//
// O rastreio continua vivendo na URL e no texto da mensagem — a página de salto
// não guarda estado, só troca o destino do celular pelo que abre o app direto.
//
// verify_jwt = false (endpoint público).
// ---------------------------------------------------------------------------

import { serviceClient } from '../_shared/supabase.ts';
import { conf, loadConfig } from '../_shared/config.ts';
import { stampMessage, whatsappAppUrl, whatsappUrl, type CodeMode } from '../_shared/tracking.ts';
import { clientIp, detectApp, hashIp, parseUa } from '../_shared/ua.ts';

const IGNORE = new Set(['', 'favicon.ico', 'robots.txt', 'sitemap.xml', 'health', 'healthz', 'apple-touch-icon.png']);

// Rota reservada da confirmação de abertura do app. O prefixo `__` não colide
// com slug de parceiro, que é gerado a partir do nome.
const OPEN_PATH = '__open';

// Tipo combinado com a borda: "isto é HTML, entregue como HTML no nosso
// domínio". Ver o comentário em bouncePage() para o porquê de não ser text/html.
const HTML_PASSTHROUGH = 'text/x-spark-html; charset=utf-8';

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

// A localização não chega sozinha até aqui: o runtime das Edge Functions não
// repassa o `cf-ipcountry`, e um rewrite da Vercel para um destino externo
// manda os cabeçalhos originais do cliente, sem os `x-vercel-ip-*` que a Vercel
// injeta na própria borda. Por isso a borda (apps/talk-redirect) reenvia a
// localização em `x-geo-*`. Os outros nomes ficam como plano B para quando o
// redirecionador estiver atrás de outra CDN.
function geo(req: Request): { country: string | null; city: string | null } {
  const pick = (...names: string[]): string | null => {
    for (const n of names) {
      const v = req.headers.get(n)?.trim();
      if (v) return v;
    }
    return null;
  };
  const city = pick('x-geo-city', 'x-vercel-ip-city', 'x-city');
  return {
    country: pick('x-geo-country', 'cf-ipcountry', 'x-vercel-ip-country', 'x-country')?.toUpperCase() ?? null,
    // A Vercel manda a cidade percent-encoded ("S%C3%A3o%20Paulo").
    city: city ? decodeCity(city) : null,
  };
}

function decodeCity(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// ---------------------------------------------------------------------------
// Página de salto (só no celular).
//
// No desktop o 302 direto continua valendo. No celular ele não serve: o destino
// é uma página de 208 KB do Meta, o universal link do WhatsApp normalmente não
// é honrado dentro da webview do Instagram, e a navegação escapa para o Safari.
//
// Aqui a gente entrega ~1 KB que tenta o esquema do app na hora. Se o WhatsApp
// assumir, esta página some em ~200 ms e ninguém a vê. Se não assumir — app não
// instalado, ou webview que bloqueia esquema customizado — o temporizador cai
// no destino web de sempre, então nunca existe beco sem saída.
//
// De quebra, é o único ponto do caminho que consegue confirmar que o app abriu.
// ---------------------------------------------------------------------------
const BOUNCE_MS = 1500;

/** Embute valor em <script> sem chance de fechar a tag ou escapar do literal. */
function js(value: string): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function bouncePage(appUrl: string, webUrl: string, token: string): Response {
  const html = `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>Abrindo o WhatsApp…</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; height:100vh; display:grid; place-items:center;
    background:#0F172A; color:#94A3B8;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  .d { width:26px; height:26px; border:2px solid #1E293B; border-top-color:#25D366;
    border-radius:50%; animation:s .7s linear infinite; }
  @keyframes s { to { transform:rotate(360deg) } }
  @media (prefers-reduced-motion: reduce) { .d { animation:none } }
</style></head>
<body><div class="d" role="status" aria-label="Abrindo o WhatsApp"></div>
<script>
(function(){
  var app=${js(appUrl)}, web=${js(webUrl)}, t=${js(token)}, sent=false;
  function opened(){
    if(sent) return; sent=true;
    try{
      var u='/__open?t='+encodeURIComponent(t);
      if(navigator.sendBeacon){ navigator.sendBeacon(u); }
      else{ fetch(u,{method:'POST',keepalive:true}); }
    }catch(e){}
  }
  // O app assumindo a navegação esconde a página — é essa a confirmação.
  document.addEventListener('visibilitychange',function(){ if(document.hidden) opened(); });
  window.addEventListener('pagehide',opened);
  // Ainda visível depois do tempo = o app não assumiu. Cai no destino de sempre.
  setTimeout(function(){ if(!document.hidden) location.replace(web); },${BOUNCE_MS});
  location.replace(app);
})();
</script>
<noscript><meta http-equiv="refresh" content="0;url=${webUrl.replace(/"/g, '&quot;')}"/></noscript>
</body></html>`;
  return new Response(html, {
    status: 200,
    headers: {
      // Não é `text/html` de propósito: o gateway do Supabase rebaixa qualquer
      // `text/html` para `text/plain` — presumivelmente para não deixar
      // hospedar HTML arbitrário em supabase.co. Com `text/plain` o navegador
      // mostra o código-fonte e o script nunca roda, o que mataria a página.
      // A borda (apps/talk-redirect) traduz este tipo para text/html no nosso
      // domínio, onde temos controle do cabeçalho.
      'content-type': HTML_PASSTHROUGH,
      'cache-control': 'no-store, no-cache, must-revalidate',
      'referrer-policy': 'no-referrer-when-downgrade',
    },
  });
}

/** Liga/desliga a página de salto sem novo deploy (alavanca de rollback). */
function deepLinkEnabled(): boolean {
  return switchOn('WA_MOBILE_DEEPLINK');
}

/** Liga/desliga a prévia rica entregue ao crawler. */
function previewEnabled(): boolean {
  return switchOn('WA_LINK_PREVIEW');
}

function switchOn(key: string): boolean {
  const v = (conf(key) ?? '').trim().toLowerCase();
  return v !== 'off' && v !== '0' && v !== 'false';
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Prévia rica (só para crawler).
//
// Um 302 não tem o que mostrar: colado no Instagram ou no WhatsApp, o link
// aparece pelado — sem título, sem descrição — e lê como encurtador suspeito.
// Isso derruba clique antes mesmo de existir clique.
//
// O crawler já é separado do humano para não inflar a métrica, então o mesmo
// teste serve para entregar a ele um HTML com as tags de Open Graph. Quem é
// gente continua no caminho de sempre e não vê esta página.
// ---------------------------------------------------------------------------
function previewPage(link: Lookup, webUrl: string): Response {
  const business = (link.business_name ?? '').trim();
  const partner = (link.partner_name ?? '').trim();
  const campaign = (link.link_name ?? '').trim();

  const title = business ? `Falar com ${business} no WhatsApp` : 'Falar no WhatsApp';
  const description = partner
    ? `Indicação de ${partner}${campaign ? ` · ${campaign}` : ''}. Toque para abrir a conversa com a mensagem pronta.`
    : campaign || 'Toque para abrir a conversa no WhatsApp com a mensagem pronta.';
  const canonical = link.short_domain
    ? `${link.short_domain.replace(/\/+$/, '')}/${link.slug}`
    : '';

  const html = `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(description)}"/>${
    business ? `\n<meta property="og:site_name" content="${esc(business)}"/>` : ''
  }${canonical ? `\n<meta property="og:url" content="${esc(canonical)}"/>` : ''}
<meta name="twitter:card" content="summary"/>
<meta name="twitter:title" content="${esc(title)}"/>
<meta name="twitter:description" content="${esc(description)}"/>
<meta name="theme-color" content="#25D366"/>
<!-- Rede de segurança: se um humano cair aqui por engano de detecção, segue. -->
<meta http-equiv="refresh" content="0;url=${esc(webUrl)}"/>
</head>
<body><p><a href="${esc(webUrl)}">${esc(title)}</a></p></body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': HTML_PASSTHROUGH,
      // O crawler pode guardar: a prévia só muda quando o link muda de nome.
      'cache-control': 'public, max-age=300',
    },
  });
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
    headers: { 'content-type': HTML_PASSTHROUGH, 'cache-control': 'no-store' },
  });
}

type Lookup = {
  link_id: string;
  account_id: string;
  destination_phone: string | null;
  message: string | null;
  code: string;
  code_mode: CodeMode;
  slug: string;
  link_name: string | null;
  partner_name: string | null;
  business_name: string | null;
  short_domain: string | null;
  active: boolean;
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') {
    return new Response('method_not_allowed', { status: 405 });
  }

  const db = serviceClient();
  await loadConfig(db);

  const url = new URL(req.url);
  const raw = url.pathname.replace(/^.*\/wa-redirect/, '').replace(/^\/+/, '').replace(/\/+$/, '');
  // O slug pode ter dois níveis: /parceiro/campanha.
  const slug = decodeURIComponent(raw).toLowerCase().trim().split('/').slice(0, 2).join('/');

  // Confirmação de abertura do app, disparada pela página de salto. Vem antes
  // da resolução do link porque `__open` é rota reservada, não slug.
  if (slug.split('/')[0] === OPEN_PATH) {
    const token = url.searchParams.get('t') ?? '';
    try {
      await db.rpc('wa_mark_app_opened', { p_token: token });
    } catch {
      /* a confirmação é melhor-esforço; nunca vira erro para quem clicou */
    }
    // Sempre 204, com ou sem token válido: quem chama é um beacon, e responder
    // diferente por token só entregaria um oráculo de tokens válidos.
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  }

  if (req.method === 'POST') return new Response('method_not_allowed', { status: 405 });
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
  const where = geo(req);

  // O token sai daqui, e não de dentro do waitUntil, porque a página de salto
  // precisa dele para confirmar a abertura do app.
  const clickToken = crypto.randomUUID().replace(/-/g, '').slice(0, 12);

  // O clique não pode segurar o redirect — vai para o waitUntil.
  const record = (async () => {
    try {
      await db.rpc('wa_record_click', {
        p_link_id: link.link_id,
        p_token: clickToken,
        p_ip_hash: await hashIp(clientIp(req), conf('WA_CLICK_SALT') ?? 'spark-talk-link'),
        p_ua: ua,
        p_device: info.device,
        p_os: info.os,
        p_browser: info.browser,
        p_country: where.country,
        p_city: where.city,
        p_referer: req.headers.get('referer'),
        p_is_bot: info.isBot,
        p_app: detectApp(ua),
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

  // A origem entra no próprio marcador: o clique já foi gravado, mas a mensagem
  // pode ser encaminhada, e aí só o texto sobrevive. Carimbando aqui, o envio
  // chega ao CRM sabendo de onde veio mesmo sem casar com um clique.
  const text = stampMessage(link.message ?? '', link.code, link.code_mode, {
    src: params.src,
    content: params.content,
  });
  const target = whatsappUrl(link.destination_phone, text);

  // Crawler ganha o cartão; o clique dele já não contava mesmo.
  if (info.isBot && previewEnabled()) {
    return previewPage(link, target);
  }

  // Só o celular muda de caminho. Desktop segue no 302 de sempre — lá a página
  // do Meta é o comportamento esperado, e o pulo para o Safari não existe.
  const isMobile = info.device === 'mobile' || info.device === 'tablet';
  if (isMobile && !info.isBot && deepLinkEnabled()) {
    return bouncePage(whatsappAppUrl(link.destination_phone, text), target, clickToken);
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
