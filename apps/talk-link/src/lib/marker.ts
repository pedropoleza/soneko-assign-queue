// ---------------------------------------------------------------------------
// Espelho do marcador invisível que vive em supabase/functions/_shared/tracking.ts.
//
// Existe aqui para o app conseguir montar o "link direto do WhatsApp" na hora,
// enquanto a pessoa troca de chip de origem, sem uma ida ao servidor a cada
// clique. As duas implementações precisam produzir o mesmo texto — se uma
// mudar, a outra muda junto.
// ---------------------------------------------------------------------------

const ZW = [0x200b, 0x200c, 0x200d, 0x2060].map((c) => String.fromCharCode(c));
const SEP = '*';

function token(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
}

/** `CODE`, `CODE*src` ou `CODE*src*content`. */
export function markerPayload(
  code: string,
  extras?: { src?: string | null; content?: string | null },
): string {
  const base = (code ?? '').trim().toUpperCase();
  if (!base) return '';
  const src = token(extras?.src);
  const content = token(extras?.content);
  if (content) return `${base}${SEP}${src}${SEP}${content}`;
  if (src) return `${base}${SEP}${src}`;
  return base;
}

/** Cada byte vira 4 símbolos de largura zero (base 4). */
export function encodeInvisible(payload: string): string {
  let out = '';
  for (const ch of payload) {
    const byte = ch.charCodeAt(0) & 0xff;
    out += ZW[(byte >> 6) & 3] + ZW[(byte >> 4) & 3] + ZW[(byte >> 2) & 3] + ZW[byte & 3];
  }
  return out;
}

/**
 * O link do WhatsApp com a mensagem já carimbada.
 *
 * `api.whatsapp.com/send/` é a forma canônica — é para ela que o `wa.me`
 * redireciona. Só `phone` e `text` sobrevivem: qualquer outro parâmetro o Meta
 * descarta, e é por isso que o rastreio viaja dentro do texto.
 */
export function directWhatsappUrl(
  phone: string,
  message: string,
  code: string,
  extras?: { src?: string | null; content?: string | null },
): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  const text = `${(message ?? '').trim()}${encodeInvisible(markerPayload(code, extras))}`;
  const qs = new URLSearchParams({ phone: digits });
  if (text) qs.set('text', text);
  return `https://api.whatsapp.com/send/?${qs.toString()}`;
}
