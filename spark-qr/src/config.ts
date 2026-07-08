const env = import.meta.env;

// Admin API (the spark-qr-admin edge function), no trailing slash.
export const API_URL: string =
  (env.VITE_SPARK_QR_API as string | undefined)?.replace(/\/+$/, '') ||
  'https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/spark-qr-admin';

// Public base the QR images point at. Once DNS is live, set this to
// https://qr.sparkleads.com. Until then it falls back to the redirect edge
// function URL so generated QRs already work end-to-end.
export const PUBLIC_BASE: string =
  (env.VITE_QR_PUBLIC_BASE as string | undefined)?.replace(/\/+$/, '') ||
  'https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/spark-qr-redirect';

export function publicUrl(slug: string): string {
  return `${PUBLIC_BASE}/${slug}`;
}

// Admin secret resolution: ?secret= (stored + stripped) -> localStorage -> build-time default.
const STORAGE_KEY = 'spark_qr_secret';

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
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  const def = env.VITE_SPARK_QR_DEFAULT_SECRET as string | undefined;
  return def ?? null;
}

// Location scope: the GHL menu link carries {{location.id}} via ?location_id=.
// Each GHL account then sees only its own QR codes. Empty string = the main
// panel (QRs without a location).
//
// The value is read from the URL exactly ONCE per page load and held in memory
// — deliberately NOT persisted. Each GHL menu open is a fresh iframe load that
// carries its own location_id, so a module cache captures the right scope every
// time. Persisting in localStorage would let one account's location leak into
// another's session (e.g. a link that arrives without the param), which is what
// caused data to bleed across accounts. If the URL has no location_id, we scope
// to '' (main) rather than inheriting a stale one.
let cachedLocationId: string | null = null;

export function getLocationId(): string {
  if (cachedLocationId !== null) return cachedLocationId;
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.get('location_id') ?? url.searchParams.get('location');
  cachedLocationId = (fromQuery ?? '').trim();
  if (fromQuery !== null) {
    url.searchParams.delete('location_id');
    url.searchParams.delete('location');
    window.history.replaceState({}, '', url.toString());
  }
  return cachedLocationId;
}

export function saveSecret(s: string) {
  localStorage.setItem(STORAGE_KEY, s.trim());
}

export function clearSecret() {
  localStorage.removeItem(STORAGE_KEY);
}
