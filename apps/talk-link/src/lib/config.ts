const env = import.meta.env;

export const API_URL: string =
  (env.VITE_TALK_API_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/wa-api';

export const OAUTH_URL: string =
  (env.VITE_TALK_OAUTH_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/wa-oauth';

export const SHORT_DOMAIN: string =
  (env.VITE_TALK_SHORT_DOMAIN as string | undefined)?.replace(/\/+$/, '') || 'https://talk.sparkleads.com';

const STORAGE_KEY = 'talk_link_secret';

/**
 * O segredo chega por três caminhos, nesta ordem:
 *   1. ?secret=... (Custom Menu Link ou retorno do OAuth)
 *   2. localStorage (visitas seguintes)
 *   3. SSO do GHL (o iframe pede os dados do usuário ao app pai)
 */
export function getSecret(): string | null {
  if (typeof window === 'undefined') return null;

  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.get('secret');
  if (fromQuery) {
    localStorage.setItem(STORAGE_KEY, fromQuery);
    url.searchParams.delete('secret');
    window.history.replaceState({}, '', url.toString());
    return fromQuery;
  }

  return localStorage.getItem(STORAGE_KEY);
}

/**
 * Sub-conta que o CRM está exibindo agora.
 *
 * O Custom Menu Link do GHL passa isso por `?location_id={{location.id}}`.
 * Não é credencial — serve para saber se a chave guardada no navegador é
 * mesmo desta sub-conta. Sem isso, quem administra várias contas veria os
 * dados da anterior ao trocar de cliente na mesma aba.
 */
export function getLocationId(): string | null {
  if (typeof window === 'undefined') return null;
  const q = new URL(window.location.href).searchParams;
  const id = q.get('location_id') ?? q.get('locationId');
  return id && id.trim() ? id.trim() : null;
}

export function saveSecret(s: string) {
  localStorage.setItem(STORAGE_KEY, s);
}

export function clearSecret() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * SSO do GoHighLevel: pedimos os dados do usuário ao app pai e trocamos o
 * payload cifrado pelo app_secret da location. Assim ninguém precisa colar
 * segredo em URL nenhuma.
 */
export function requestSsoSecret(timeoutMs = 4000): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || window.parent === window) return resolve(null);

    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      resolve(value);
    };

    const onMessage = async (event: MessageEvent) => {
      const payload = event.data;
      const encrypted =
        typeof payload === 'string' ? payload : (payload?.payload ?? payload?.encrypted ?? null);
      if (!encrypted || typeof encrypted !== 'string' || encrypted.length < 20) return;

      try {
        const res = await fetch(`${OAUTH_URL}/sso`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encrypted }),
        });
        if (!res.ok) return finish(null);
        const data = (await res.json()) as { secret?: string };
        if (data.secret) {
          saveSecret(data.secret);
          return finish(data.secret);
        }
        finish(null);
      } catch {
        finish(null);
      }
    };

    window.addEventListener('message', onMessage);
    window.parent.postMessage({ message: 'REQUEST_USER_DATA' }, '*');
    setTimeout(() => finish(null), timeoutMs);
  });
}
