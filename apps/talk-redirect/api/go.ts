// ---------------------------------------------------------------------------
// Porta de entrada do talk.sparkleads.com.
//
// Antes isso aqui era um rewrite estático direto para a Edge Function do
// Supabase. Funcionava para redirecionar, mas perdia a localização de todo
// clique: a Vercel injeta os `x-vercel-ip-*` na própria borda, e um rewrite
// para um destino *externo* repassa só os cabeçalhos originais do cliente.
// Do outro lado, o runtime do Supabase também não entrega o `cf-ipcountry`.
// Resultado: `country` e `city` nasciam nulos em 100% dos cliques.
//
// Então a borda deixa de ser um rewrite e vira este proxy: ele lê a localização
// onde ela existe e reenvia em `x-geo-*` para quem sabe gravar o clique.
//
// O redirect continua sendo um 302 do upstream, repassado sem ser seguido —
// nenhuma página a mais no caminho da pessoa.
// ---------------------------------------------------------------------------

export const config = { runtime: 'edge' };

const UPSTREAM = 'https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/wa-redirect';

/** O que identifica quem clicou — precisa chegar inteiro no upstream. */
const FORWARD = ['user-agent', 'referer', 'accept-language', 'x-forwarded-for', 'x-real-ip'];

/** Cabeçalhos de resposta que descrevem o corpo *desta* conexão, não o de lá. */
const HOP_BY_HOP = ['content-encoding', 'content-length', 'transfer-encoding', 'connection'];

/** Tipo combinado com o wa-redirect para o HTML que ele não pode rotular. */
const HTML_PASSTHROUGH = 'text/x-spark-html';

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // O vercel.json injeta o caminho original em `p` — depois do rewrite, o
  // `req.url` já aponta para /api/go e não serve mais para achar o link.
  const params = new URLSearchParams(url.searchParams);
  const path = (params.get('p') ?? '').replace(/^\/+/, '');
  params.delete('p');

  const query = params.toString();
  const target = `${UPSTREAM}/${path}${query ? `?${query}` : ''}`;

  const headers = new Headers();
  for (const name of FORWARD) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  // A localização, no único ponto do caminho em que ela existe.
  const country = req.headers.get('x-vercel-ip-country');
  const city = req.headers.get('x-vercel-ip-city');
  if (country) headers.set('x-geo-country', country);
  if (city) headers.set('x-geo-city', city);

  // POST existe por causa de um caso só: o beacon da página de salto
  // confirmando que o WhatsApp abriu. Qualquer outro método vira GET.
  const method = req.method === 'HEAD' || req.method === 'POST' ? req.method : 'GET';

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      redirect: 'manual', // o 302 é o produto: seguir aqui gastaria o hop à toa
    });
  } catch {
    // Se o upstream cair, mandar a pessoa para lugar nenhum é pior do que
    // admitir a falha — mas sem página de erro nossa no meio do caminho.
    return new Response(null, { status: 502, headers: { 'cache-control': 'no-store' } });
  }

  const out = new Headers(upstream.headers);
  for (const name of HOP_BY_HOP) out.delete(name);

  // O gateway do Supabase rebaixa `text/html` para `text/plain`, e aí o
  // navegador mostra o código-fonte em vez de renderizar — o que quebraria a
  // página de salto (o script nunca rodaria) e a de link indisponível. Por isso
  // o upstream marca o HTML com um tipo próprio e a tradução acontece aqui, no
  // nosso domínio, onde o cabeçalho é nosso.
  if (out.get('content-type')?.startsWith(HTML_PASSTHROUGH)) {
    out.set('content-type', 'text/html; charset=utf-8');
  }

  return new Response(req.method === 'HEAD' || upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers: out,
  });
}
