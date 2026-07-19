import { serverEnv } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { GhlConfigError } from "./errors";

/**
 * Server-side token management (CLAUDE.md §2).
 *
 * Two supported credential modes, both resolved here:
 *  - Private Integration Token (PIT): a long-lived "pit-..." bearer. No expiry,
 *    no refresh. This is what the pilot (Dani) uses.
 *  - OAuth 2.0: access + refresh tokens; refreshed automatically before expiry
 *    and transparently on a 401 (see forceRefresh()).
 *
 * Tokens are persisted per-location in Supabase (spark_saude.ghl_tokens via
 * SECURITY DEFINER RPCs). If Supabase isn't configured, an in-memory store
 * seeded from env is used. The store is an interface so a different backend can
 * be dropped in for multi-tenant resale without touching callers.
 */

export interface StoredToken {
  accessToken: string;
  refreshToken?: string | null;
  tokenType: string;
  scope?: string | null;
  /** ISO timestamp; null/undefined = non-expiring (e.g. a PIT). */
  expiresAt?: string | null;
}

interface TokenStore {
  get(locationId: string): Promise<StoredToken | null>;
  save(locationId: string, token: StoredToken): Promise<void>;
}

/** Supabase-backed store (default when configured). */
class SupabaseTokenStore implements TokenStore {
  async get(locationId: string): Promise<StoredToken | null> {
    const db = supabaseAdmin();
    if (!db) return null;
    const { data, error } = await db.rpc("spark_saude_get_token", { p_location_id: locationId });
    if (error || !data) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.access_token) return null;
    return {
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      tokenType: row.token_type ?? "Bearer",
      scope: row.scope,
      expiresAt: row.expires_at,
    };
  }

  async save(locationId: string, token: StoredToken): Promise<void> {
    const db = supabaseAdmin();
    if (!db) return;
    await db.rpc("spark_saude_upsert_token", {
      p_location_id: locationId,
      p_access_token: token.accessToken,
      p_refresh_token: token.refreshToken ?? null,
      p_token_type: token.tokenType ?? "Bearer",
      p_scope: token.scope ?? null,
      p_expires_at: token.expiresAt ?? null,
    });
  }
}

/** In-memory fallback when Supabase isn't configured. */
class MemoryTokenStore implements TokenStore {
  private map = new Map<string, StoredToken>();
  async get(locationId: string) {
    return this.map.get(locationId) ?? null;
  }
  async save(locationId: string, token: StoredToken) {
    this.map.set(locationId, token);
  }
}

let store: TokenStore | null = null;
function getStore(): TokenStore {
  if (!store) store = supabaseAdmin() ? new SupabaseTokenStore() : new MemoryTokenStore();
  return store;
}

// Short-lived per-location cache so we don't hit the store on every request.
const cache = new Map<string, StoredToken>();

function seedFromEnv(): StoredToken | null {
  if (!serverEnv.accessToken) return null;
  return {
    accessToken: serverEnv.accessToken,
    refreshToken: serverEnv.refreshToken || null,
    tokenType: "Bearer",
    scope: null,
    // PITs don't expire; if using OAuth via env, we refresh on the first 401.
    expiresAt: null,
  };
}

function isExpiring(token: StoredToken): boolean {
  if (!token.expiresAt) return false; // non-expiring (PIT)
  const skewMs = 120_000; // refresh 2 min early
  return new Date(token.expiresAt).getTime() - Date.now() <= skewMs;
}

function canRefresh(token: StoredToken): boolean {
  return Boolean(token.refreshToken && serverEnv.clientId && serverEnv.clientSecret);
}

async function loadToken(locationId: string): Promise<StoredToken> {
  const cached = cache.get(locationId);
  if (cached) return cached;

  let token = await getStore().get(locationId);
  if (!token) {
    token = seedFromEnv();
    if (!token) {
      throw new GhlConfigError(
        `Nenhuma credencial GHL configurada para a location "${locationId}". ` +
          `Defina GHL_ACCESS_TOKEN (PIT) ou o fluxo OAuth no ambiente.`,
      );
    }
    // Persist the env seed so the store becomes the source of truth.
    await getStore().save(locationId, token).catch(() => {});
  }
  cache.set(locationId, token);
  return token;
}

async function refresh(locationId: string, token: StoredToken): Promise<StoredToken> {
  const body = new URLSearchParams({
    client_id: serverEnv.clientId,
    client_secret: serverEnv.clientSecret,
    grant_type: "refresh_token",
    refresh_token: token.refreshToken as string,
    user_type: "Location",
  });
  const res = await fetch(`${serverEnv.ghlApiBase}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  if (!res.ok) {
    throw new GhlConfigError(`Falha ao renovar o token OAuth do GHL (HTTP ${res.status}).`);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    token_type?: string;
    scope?: string;
    expires_in?: number;
  };
  const next: StoredToken = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? token.refreshToken,
    tokenType: json.token_type ?? "Bearer",
    scope: json.scope ?? token.scope,
    expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000).toISOString() : null,
  };
  cache.set(locationId, next);
  await getStore().save(locationId, next).catch(() => {});
  return next;
}

/** Get a valid access token for the location, refreshing proactively if needed. */
export async function getAccessToken(locationId: string): Promise<string> {
  let token = await loadToken(locationId);
  if (isExpiring(token) && canRefresh(token)) {
    token = await refresh(locationId, token);
  }
  return token.accessToken;
}

/**
 * Force a refresh after a 401 and return the new token. If the credential can't
 * be refreshed (e.g. a PIT), the 401 is a real auth failure and we rethrow via
 * the caller — here we just return the current token unchanged.
 */
export async function forceRefresh(locationId: string): Promise<string | null> {
  cache.delete(locationId);
  const token = await loadToken(locationId);
  if (canRefresh(token)) {
    const next = await refresh(locationId, token);
    return next.accessToken;
  }
  return null;
}
