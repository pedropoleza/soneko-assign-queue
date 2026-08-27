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

/** O app está aberto dentro do iframe do CRM? */
export function inCrmFrame(): boolean {
  return typeof window !== 'undefined' && window.parent !== window;
}

/**
 * Tira o `?secret=` da URL e devolve — sem gravar.
 *
 * Quem decide se essa chave vale é o boot, e a distinção é o que sustenta o
 * multi-conta: a Custom Page tem UMA URL para todas as sub-contas. Uma chave
 * presa nela (o callback do OAuth devolve exatamente `?secret=…&location_id=…`,
 * e essa URL acaba colada na configuração do app) faria toda sub-conta entrar
 * na mesma conta. Dentro do CRM, portanto, esta chave é só plano B — quem manda
 * é o SSO, que sabe qual sub-conta está aberta agora.
 */
export function consumeUrlSecret(): string | null {
  if (typeof window === 'undefined') return null;

  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.get('secret');
  if (!fromQuery) return null;

  url.searchParams.delete('secret');
  window.history.replaceState({}, '', url.toString());
  return fromQuery;
}

/** A chave guardada neste navegador. */
export function getSecret(): string | null {
  if (typeof window === 'undefined') return null;
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
  const raw = (q.get('location_id') ?? q.get('locationId') ?? '').trim();
  if (!raw) return null;

  // Merge field que não foi substituído ({{location.id}}) chegaria aqui como
  // texto literal e nunca bateria com o id real — o app ficaria descartando a
  // chave a cada abertura. Só aceitamos o que tem cara de id do GHL.
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(raw)) return null;
  return raw;
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
export type SsoResult =
  | { secret: string }
  | { reason: 'sem_iframe' | 'sem_resposta' | 'chave_errada' | 'nao_instalado' | 'sso_desligado' | 'erro' };

/**
 * SSO do GoHighLevel: pedimos os dados do usuário ao app pai e trocamos o
 * payload cifrado pelo app_secret da sub-conta.
 *
 * Só funciona na Custom Page de um app do Marketplace — é lá que o GHL
 * responde ao `REQUEST_USER_DATA`. Num Custom Menu Link comum o pai ignora a
 * mensagem, e é por isso que devolvemos o motivo: sem ele a tela de entrada
 * some sem explicar nada.
 */
export function requestSsoSecret(timeoutMs = 4000): Promise<SsoResult> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || window.parent === window) {
      return resolve({ reason: 'sem_iframe' });
    }

    let settled = false;
    const finish = (value: SsoResult) => {
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
        const data = (await res.json().catch(() => ({}))) as { secret?: string; error?: string };

        if (data.secret) {
          saveSecret(data.secret);
          return finish({ secret: data.secret });
        }
        const map: Record<string, SsoResult> = {
          sso_decrypt_failed: { reason: 'chave_errada' },
          not_installed: { reason: 'nao_instalado' },
          sso_not_configured: { reason: 'sso_desligado' },
        };
        finish(map[data.error ?? ''] ?? { reason: 'erro' });
      } catch {
        finish({ reason: 'erro' });
      }
    };

    window.addEventListener('message', onMessage);
    window.parent.postMessage({ message: 'REQUEST_USER_DATA' }, '*');
    setTimeout(() => finish({ reason: 'sem_resposta' }), timeoutMs);
  });
}
