const env = import.meta.env;

export const API_URL: string =
  (env.VITE_SPARK_API_URL as string | undefined)?.replace(/\/+$/, '') || '';

// Sessão do painel. Após o OAuth do GHL (D1), a Edge Function spark-oauth emite
// um session token (opaco) que o frontend guarda e envia em cada chamada.
// Origem, em ordem: 1) ?session=... na URL  2) localStorage  3) build-time.
const STORAGE_KEY = 'spark_session';

export function getSession(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.get('session');
  if (fromQuery) {
    localStorage.setItem(STORAGE_KEY, fromQuery);
    url.searchParams.delete('session');
    window.history.replaceState({}, '', url.toString());
    return fromQuery;
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  const def = env.VITE_SPARK_DEFAULT_SESSION as string | undefined;
  return def ?? null;
}

export function saveSession(s: string) {
  localStorage.setItem(STORAGE_KEY, s);
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}
