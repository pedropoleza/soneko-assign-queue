import { API_URL, saveSession } from './config';

// Endpoint do OAuth (deriva do API_URL trocando spark-api -> spark-oauth).
const OAUTH_URL = (API_URL || '').replace(/spark-api\/?$/, 'spark-oauth');

// GHL Custom Page SSO: pede ao parent (GHL) os dados do usuário; o GHL responde
// com um payload criptografado (AES com a Shared Key). Retorna o payload.
function requestEncryptedUserData(timeoutMs = 4000): Promise<string | null> {
  if (typeof window === 'undefined' || window.parent === window) return Promise.resolve(null);
  return new Promise((resolve) => {
    let done = false;
    const handler = (e: MessageEvent) => {
      const d = e.data as { message?: string; payload?: unknown };
      if (d && d.message === 'REQUEST_USER_DATA_RESPONSE') {
        done = true;
        window.removeEventListener('message', handler);
        resolve(typeof d.payload === 'string' ? d.payload : null);
      }
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ message: 'REQUEST_USER_DATA' }, '*');
    setTimeout(() => {
      if (!done) {
        window.removeEventListener('message', handler);
        resolve(null);
      }
    }, timeoutMs);
  });
}

// Troca o payload do SSO por uma sessão do painel. Retorna true se logou.
export async function bootstrapViaSso(): Promise<boolean> {
  try {
    const encrypted = await requestEncryptedUserData();
    if (!encrypted) return false;
    const res = await fetch(`${OAUTH_URL}/sso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encrypted }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { session?: string };
    if (!data.session) return false;
    saveSession(data.session);
    return true;
  } catch {
    return false;
  }
}
