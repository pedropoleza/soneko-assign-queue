import { serverEnv } from "@/lib/config";
import { getAccessToken, forceRefresh } from "./auth";
import { GhlApiError, GhlRateLimitError } from "./errors";

/**
 * Typed fetch wrapper for the GHL API v2 (CLAUDE.md §2, §7).
 * - Injects Authorization (server token) + the required `Version` header.
 * - Retries transparently on 401 (refresh token) and on 429 (rate limit).
 * - Never runs in the browser; callers are route handlers / lib/ghl modules.
 */

interface RequestOptions {
  locationId: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  /** Version header override (defaults to env / 2021-07-28). */
  version?: string;
  signal?: AbortSignal;
}

const MAX_RATE_LIMIT_RETRIES = 3;

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(serverEnv.ghlApiBase + (path.startsWith("/") ? path : `/${path}`));
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function messageFromBody(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const msg = b.message ?? b.error ?? b.msg;
    if (typeof msg === "string") return msg;
    if (Array.isArray(msg)) return msg.join(", ");
  }
  return fallback;
}

export async function ghlFetch<T = unknown>(path: string, opts: RequestOptions): Promise<T> {
  const { locationId, method = "GET", query, body, version, signal } = opts;

  const doRequest = async (token: string): Promise<Response> => {
    return fetch(buildUrl(path, query), {
      method,
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Version: version || serverEnv.ghlApiVersion,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  };

  let token = await getAccessToken(locationId);
  let attempt = 0;
  let refreshed = false;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let res: Response;
    try {
      res = await doRequest(token);
    } catch (err) {
      throw new GhlApiError(0, err instanceof Error ? err.message : "Falha de rede ao contatar o GHL.");
    }

    if (res.ok) {
      return (await parseBody(res)) as T;
    }

    // 401 -> try a single token refresh (OAuth). PITs can't refresh -> real 401.
    if (res.status === 401 && !refreshed) {
      refreshed = true;
      const next = await forceRefresh(locationId);
      if (next) {
        token = next;
        continue;
      }
    }

    // 429 -> respect Retry-After / backoff, bounded retries.
    if (res.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      attempt += 1;
      const retryAfter = Number(res.headers.get("Retry-After"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    const parsed = await parseBody(res);
    const message = messageFromBody(parsed, `Erro ${res.status} na API do GHL.`);
    if (res.status === 429) throw new GhlRateLimitError(message, parsed);
    throw new GhlApiError(res.status, message, parsed);
  }
}
