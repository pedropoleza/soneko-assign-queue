// ---------------------------------------------------------------------------
// Marcador de rastreio embutido na mensagem pré-preenchida do WhatsApp.
//
// O objetivo é conseguir provar, quando a mensagem chega no GHL, de qual link
// (e portanto de qual influenciador) ela veio — sem que a pessoa perceba.
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
// ---------------------------------------------------------------------------

export type CodeMode = 'invisible' | 'discreet' | 'visible' | 'none';

// Alfabeto base-4 de caracteres invisíveis.
// U+200B zero width space, U+200C non-joiner, U+200D joiner, U+2060 word joiner.
const ZW = ['\u200B', '\u200C', '\u200D', '\u2060'];
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

/** Anexa o marcador do link à mensagem, conforme o modo escolhido. */
export function stampMessage(message: string, code: string, mode: CodeMode): string {
  const base = (message ?? '').trim();
  if (!code || mode === 'none') return base;
  switch (mode) {
    case 'invisible':
      return `${base}${encodeInvisible(code)}`;
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

export type ExtractedCode = { code: string; source: 'invisible_code' | 'code' } | null;

/** Extrai o código de rastreio de uma mensagem recebida. */
export function extractCode(body: string): ExtractedCode {
  if (!body) return null;

  const hidden = decodeInvisible(body);
  if (hidden && /^[2-9A-HJ-NP-Z]{5}$/i.test(hidden.trim())) {
    return { code: hidden.trim().toUpperCase(), source: 'invisible_code' };
  }

  const m = body.match(VISIBLE_CODE_RE) ?? body.match(HASH_CODE_RE);
  if (m) return { code: m[1].toUpperCase(), source: 'code' };

  return null;
}

/** Monta a URL final do WhatsApp com a mensagem já carimbada. */
export function whatsappUrl(phoneDigits: string, message: string): string {
  const phone = (phoneDigits ?? '').replace(/\D/g, '');
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${phone}${text}`;
}
