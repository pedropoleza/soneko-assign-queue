import { serverEnv } from "@/lib/config";
import { CmsApiError, CmsConfigError, CmsRateLimitError } from "./errors";
import type { CmsSearchRequest, CmsSearchResponse, CmsPlan } from "./types";

/**
 * Server-side CMS Marketplace client (CLAUDE.md §3). The apikey lives ONLY here
 * (query string, server-side) and never reaches the browser. Handles 429 with a
 * short backoff and surfaces typed errors.
 *
 * The key expires every 60 days; a new one arrives by email. Rotating it is just
 * updating CMS_MARKETPLACE_API_KEY in the env — no code change (see README).
 */

const MAX_RETRIES = 2;

function requireKey(): string {
  if (!serverEnv.cmsApiKey) {
    throw new CmsConfigError("CMS_MARKETPLACE_API_KEY não configurada. Solicite em developer.cms.gov/marketplace-api/key-request.");
  }
  return serverEnv.cmsApiKey;
}

async function cmsPost<T>(path: string, body: unknown): Promise<T> {
  const key = requireKey();
  const url = `${serverEnv.cmsApiBase}${path}${path.includes("?") ? "&" : "?"}apikey=${encodeURIComponent(key)}`;

  let attempt = 0;
  while (true) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get("retry-after")) || 2 ** attempt;
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      attempt++;
      continue;
    }

    const text = await res.text();
    const parsed = text ? safeJson(text) : null;
    if (res.status === 429) throw new CmsRateLimitError("Rate limit do CMS.", parsed);
    if (!res.ok) throw new CmsApiError(res.status, messageFrom(parsed) ?? `Erro ${res.status} na API do CMS.`, parsed);
    return parsed as T;
  }
}

async function cmsGet<T>(path: string): Promise<T> {
  const key = requireKey();
  const url = `${serverEnv.cmsApiBase}${path}${path.includes("?") ? "&" : "?"}apikey=${encodeURIComponent(key)}`;
  const res = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  const text = await res.text();
  const parsed = text ? safeJson(text) : null;
  if (res.status === 429) throw new CmsRateLimitError("Rate limit do CMS.", parsed);
  if (!res.ok) throw new CmsApiError(res.status, messageFrom(parsed) ?? `Erro ${res.status} na API do CMS.`, parsed);
  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function messageFrom(body: unknown): string | undefined {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const m = b.message ?? b.error;
    if (typeof m === "string") return m;
  }
  return undefined;
}

/** POST /plans/search — the core estimate call. */
export function searchPlans(req: CmsSearchRequest): Promise<CmsSearchResponse> {
  return cmsPost<CmsSearchResponse>("/plans/search", req);
}

/** GET /plans/{id} — granular plan detail. */
export function getPlan(planId: string, year: number): Promise<CmsPlan> {
  return cmsGet<CmsPlan>(`/plans/${encodeURIComponent(planId)}?year=${year}`);
}
