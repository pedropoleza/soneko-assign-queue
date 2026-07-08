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

// Location scope. Authoritative source is the GHL marketplace-app SSO: the panel
// asks GHL for the signed user session and the backend (POST /sso) decrypts it
// to the current activeLocation. That value is set here via setLocationId() and
// then sent on every request — it can't be spoofed and doesn't depend on the
// menu link. As a fallback (e.g. opened outside the app, or SSO unavailable) we
// read a ?location_id= param from the URL once. Empty string = the main panel.
//
// Deliberately NOT persisted in localStorage: each GHL open is a fresh iframe
// load with its own session, and persisting would let one account's location
// leak into another's — the bug that made data bleed across accounts.
let cachedLocationId: string | null = null;

// Called once SSO (or the URL fallback) resolves the location for this session.
export function setLocationId(id: string) {
  cachedLocationId = (id ?? '').trim();
}

// The location scope used for API calls. Prefers a resolved value; otherwise
// falls back to a ?location_id= URL param (read + stripped once).
export function getLocationId(): string {
  if (cachedLocationId !== null) return cachedLocationId;
  return readLocationFromUrl();
}

// URL fallback only — does not set the resolved value (SSO wins when available).
export function readLocationFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.get('location_id') ?? url.searchParams.get('location');
  if (fromQuery !== null) {
    url.searchParams.delete('location_id');
    url.searchParams.delete('location');
    window.history.replaceState({}, '', url.toString());
  }
  return (fromQuery ?? '').trim();
}

export function saveSecret(s: string) {
  localStorage.setItem(STORAGE_KEY, s.trim());
}

export function clearSecret() {
  localStorage.removeItem(STORAGE_KEY);
}
