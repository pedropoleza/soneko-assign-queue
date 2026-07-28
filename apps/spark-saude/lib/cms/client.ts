import { serverEnv } from "@/lib/config";
import { CmsApiError, CmsConfigError, CmsRateLimitError } from "./errors";
import type {
  CmsCountiesResponse,
  CmsEligibilityRequest,
  CmsEligibilityResponse,
  CmsPlan,
  CmsSearchRequest,
  CmsSearchResponse,
} from "./types";

/**
 * Server-side CMS Marketplace client (docs/cotacao.md §3). The apikey lives ONLY
 * here (query string, server-side) and never reaches the browser. Handles 429
 * with Retry-After backoff and surfaces typed errors.
 *
 * The key expires every 60 days; a new one arrives by email. Rotating it is just
 * updating CMS_MARKETPLACE_API_KEY in the env — no code change (see README).
 */

const MAX_RETRIES = 2;
const TIMEOUT_MS = 20_000;

/** Rate-limit budget from the last response — surfaced so the UI can warn. */
let lastRateLimit: { remaining: number | null; limit: number | null } = { remaining: null, limit: null };

export function cmsRateLimitSnapshot() {
  return { ...lastRateLimit };
}

export function hasCmsKey(): boolean {
  return Boolean(serverEnv.cmsApiKey);
}

function requireKey(): string {
  if (!serverEnv.cmsApiKey) {
    throw new CmsConfigError(
      "CMS_MARKETPLACE_API_KEY não configurada. Solicite em developer.cms.gov/marketplace-api/key-request.",
    );
  }
  return serverEnv.cmsApiKey;
}

function withKey(path: string): string {
  const key = requireKey();
  return `${serverEnv.cmsApiBase}${path}${path.includes("?") ? "&" : "?"}apikey=${encodeURIComponent(key)}`;
}

function captureRateLimit(res: Response) {
  const remaining = Number(res.headers.get("x-ratelimit-remaining"));
  const limit = Number(res.headers.get("x-ratelimit-limit"));
  lastRateLimit = {
    remaining: Number.isFinite(remaining) ? remaining : lastRateLimit.remaining,
    limit: Number.isFinite(limit) ? limit : lastRateLimit.limit,
  };
}

async function cmsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = withKey(path);

  let attempt = 0;
  while (true) {
    const res = await fetch(url, {
      ...init,
      headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    captureRateLimit(res);

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
  return cmsFetch<CmsSearchResponse>("/plans/search", { method: "POST", body: JSON.stringify(req) });
}

/** GET /plans/{id} — granular plan detail. */
export function getPlan(planId: string, year: number): Promise<CmsPlan> {
  return cmsFetch<CmsPlan>(`/plans/${encodeURIComponent(planId)}?year=${year}`);
}

/**
 * POST /households/eligibility/estimates — the authoritative subsidy call.
 * Returns the monthly APTC, the CSR variant, and whether the household actually
 * belongs on Medicaid/CHIP instead of a Marketplace plan.
 */
export function estimateEligibility(req: CmsEligibilityRequest): Promise<CmsEligibilityResponse> {
  return cmsFetch<CmsEligibilityResponse>("/households/eligibility/estimates", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

/** GET /counties/by/zip/{zipcode} — resolve the county FIPS a rate area needs. */
export function countiesByZip(zipcode: string): Promise<CmsCountiesResponse> {
  return cmsFetch<CmsCountiesResponse>(`/counties/by/zip/${encodeURIComponent(zipcode)}`);
}
