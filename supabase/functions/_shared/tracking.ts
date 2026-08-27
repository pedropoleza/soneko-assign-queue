// ---------------------------------------------------------------------------
// Marcador de rastreio embutido na mensagem pré-preenchida do WhatsApp.
//
// O objetivo é conseguir provar, quando a mensagem chega no GHL, de qual link
// (e portanto de qual influenciador, campanha e origem) ela veio — sem que a
// pessoa perceba.
//
// Modos:
//   invisible — sequência de caracteres de largura zero no fim da mensagem.
//               Invisível na conversa, sobrevive a copiar/colar.
//   discreet  — "(ref: ABC12)" numa linha separada.
//   visible   — "Código: ABC12".
//   none      — nada; a atribuição fica por conta da impressão digital do texto.
//
// Independente do modo, o webhook também casa a mensagem pelo texto normalizado
// (fingerprint), então nenhum modo é ponto único de falha.
//
// O marcador invisível carrega mais do que o código do link:
//
//   SKRWK*story*a
//   └─┬─┘ └─┬─┘ └┬┘
//     │     │    └── content  (variação criativa)
//     │     └─────── src      (onde foi postado)
//     └───────────── code     (link -> influenciador + campanha)
//
// Com isso a mensagem é auto-suficiente: mesmo que o clique não tenha sido
// registrado (link do WhatsApp compartilhado direto, mensagem encaminhada para
// um amigo, falha na gravação), o envio ainda chega ao CRM com a origem certa.
// Payload só com o código continua válido — os links antigos não quebram.
// ---------------------------------------------------------------------------

export type CodeMode = 'invisible' | 'discreet' | 'visible' | 'none';

/** Dados extras que viajam junto do código dentro do marcador invisível. */
export type MarkerExtras = { src?: string | null; content?: string | null };

const SEP = '*';
const TOKEN_RE = /^[a-z0-9_-]{1,24}$/;

/** Normaliza um token de origem para caber no marcador sem ambiguidade. */
function token(value: string | null | undefined): string {
  const v = (value ?? '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
  return TOKEN_RE.test(v) ? v : '';
}

/** Monta o payload do marcador: `CODE`, `CODE*src` ou `CODE*src*content`. */
export function buildMarkerPayload(code: string, extras?: MarkerExtras): string {
  const base = (code ?? '').trim().toUpperCase();
  if (!base) return '';
  const src = token(extras?.src);
  const content = token(extras?.content);
  // `content` sem `src` viraria ambíguo na leitura, então guarda o lugar vazio.
  if (content) return `${base}${SEP}${src}${SEP}${content}`;
  if (src) return `${base}${SEP}${src}`;
  return base;
}

const CODE_RE = /^[2-9A-HJ-NP-Z]{5}$/i;

/** Lê o payload do marcador de volta para código + origem. */
export function parseMarkerPayload(
  payload: string,
): { code: string; src: string | null; content: string | null } | null {
  const [rawCode, rawSrc, rawContent] = (payload ?? '').trim().split(SEP);
  if (!rawCode || !CODE_RE.test(rawCode)) return null;
  return {
    code: rawCode.toUpperCase(),
    src: token(rawSrc) || null,
    content: token(rawContent) || null,
  };
}

// Alfabeto base-4 de caracteres invisíveis.
// U+200B zero width space, U+200C non-joiner, U+200D joiner, U+2060 word joiner.
// Montado a partir dos code points de propósito: literais invisíveis no código
// são fáceis de perder num copiar/colar ou numa normalização de arquivo.
const ZW = [0x200b, 0x200c, 0x200d, 0x2060].map((c) => String.fromCharCode(c));
const ZW_SET = new Set(ZW);

/** Codifica ASCII em caracteres de largura zero (4 símbolos base-4 por byte). */
export function encodeInvisible(payload: string): string {
  let out = '';
  for (const ch of payload) {
    const byte = ch.charCodeAt(0) & 0xff;
    out += ZW[(byte >> 6) & 3] + ZW[(byte >> 4) & 3] + ZW[(byte >> 2) & 3] + ZW[byte & 3];
  }
  return out;
}

/** Procura a maior sequência de largura zero do texto e decodifica. */
export function decodeInvisible(text: string): string | null {
  if (!text) return null;
  let best = '';
  let run = '';
  for (const ch of text) {
    if (ZW_SET.has(ch)) {
      run += ch;
    } else {
      if (run.length > best.length) best = run;
      run = '';
    }
  }
  if (run.length > best.length) best = run;
  if (best.length < 4 || best.length % 4 !== 0) return null;

  let out = '';
  for (let i = 0; i < best.length; i += 4) {
    const byte =
      (ZW.indexOf(best[i]) << 6) |
      (ZW.indexOf(best[i + 1]) << 4) |
      (ZW.indexOf(best[i + 2]) << 2) |
      ZW.indexOf(best[i + 3]);
    if (byte < 32 || byte > 126) return null;
    out += String.fromCharCode(byte);
  }
  return out || null;
}

/**
 * Anexa o marcador do link à mensagem, conforme o modo escolhido.
 *
 * Só o modo invisível carrega `extras` — em "discreet" e "visible" o marcador
 * aparece na conversa, e um `(ref: SKRWK*story)` na cara do lead não ajuda
 * ninguém. Nesses modos a origem continua vindo do clique.
 */
export function stampMessage(
  message: string,
  code: string,
  mode: CodeMode,
  extras?: MarkerExtras,
): string {
  const base = (message ?? '').trim();
  if (!code || mode === 'none') return base;
  switch (mode) {
    case 'invisible':
      return `${base}${encodeInvisible(buildMarkerPayload(code, extras))}`;
    case 'discreet':
      return `${base}\n\n(ref: ${code})`;
    case 'visible':
      return `${base}\n\nCódigo: ${code}`;
    default:
      return base;
  }
}

const VISIBLE_CODE_RE = /(?:ref|c[oó]digo|cod)\s*[:#]?\s*([2-9A-HJ-NP-Z]{5})\b/i;
const HASH_CODE_RE = /#([2-9A-HJ-NP-Z]{5})\b/;

export type ExtractedCode = {
  code: string;
  src: string | null;
  content: string | null;
  source: 'invisible_code' | 'code';
} | null;

/** Extrai o código de rastreio (e a origem, quando houver) de uma mensagem. */
export function extractCode(body: string): ExtractedCode {
  if (!body) return null;

  const hidden = decodeInvisible(body);
  const parsed = hidden ? parseMarkerPayload(hidden) : null;
  if (parsed) return { ...parsed, source: 'invisible_code' };

  const m = body.match(VISIBLE_CODE_RE) ?? body.match(HASH_CODE_RE);
  if (m) return { code: m[1].toUpperCase(), src: null, content: null, source: 'code' };

  return null;
}

/**
 * Monta a URL final do WhatsApp com a mensagem já carimbada.
 *
 * `wa.me` é a forma curta; o WhatsApp redireciona para `api.whatsapp.com/send/`
 * ao abrir. As duas aceitam exatamente os mesmos dois parâmetros — e só eles:
 * qualquer coisa a mais na URL o Meta descarta. Por isso o que precisamos medir
 * viaja dentro do `text`, não ao lado dele.
 */
export function whatsappUrl(phoneDigits: string, message: string): string {
  const phone = (phoneDigits ?? '').replace(/\D/g, '');
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${phone}${text}`;
}

/**
 * O esquema do aplicativo — o único destino que abre a conversa sem passar por
 * uma página do Meta.
 *
 * `wa.me` e `api.whatsapp.com` são páginas web: dentro do navegador embutido do
 * Instagram ou do TikTok o universal link costuma não ser honrado, a página de
 * 208 KB carrega de verdade e a navegação escapa para o Safari. O `whatsapp://`
 * é entendido pela própria webview e abre o app direto.
 *
 * Só serve com plano B: se o WhatsApp não estiver instalado, não existe destino.
 */
export function whatsappAppUrl(phoneDigits: string, message: string): string {
  const phone = (phoneDigits ?? '').replace(/\D/g, '');
  const qs = new URLSearchParams({ phone });
  if (message) qs.set('text', message);
  return `whatsapp://send?${qs.toString()}`;
}

/** A forma longa e canônica, a mesma que o navegador mostra depois do wa.me. */
export function whatsappSendUrl(phoneDigits: string, message: string): string {
  const phone = (phoneDigits ?? '').replace(/\D/g, '');
  const qs = new URLSearchParams({ phone });
  if (message) qs.set('text', message);
  return `https://api.whatsapp.com/send/?${qs.toString()}`;
}
