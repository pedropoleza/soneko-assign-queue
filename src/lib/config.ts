const env = import.meta.env;

export const API_URL: string =
  (env.VITE_SONEKO_API_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/soneko-api';

// The secret can come from (in order):
//   1. URL query string ?secret=...
//   2. localStorage 'soneko_secret' (entered manually on first visit)
//   3. VITE_SONEKO_DEFAULT_SECRET (build-time)
export function getSecret(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.get('secret');
  if (fromQuery) {
    localStorage.setItem('soneko_secret', fromQuery);
    // Strip secret from URL for safety
    url.searchParams.delete('secret');
    window.history.replaceState({}, '', url.toString());
    return fromQuery;
  }
  const stored = localStorage.getItem('soneko_secret');
  if (stored) return stored;
  const def = env.VITE_SONEKO_DEFAULT_SECRET as string | undefined;
  return def ?? null;
}

export function saveSecret(s: string) {
  localStorage.setItem('soneko_secret', s);
}

export function clearSecret() {
  localStorage.removeItem('soneko_secret');
}
