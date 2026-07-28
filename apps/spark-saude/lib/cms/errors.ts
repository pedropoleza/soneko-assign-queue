/** Typed errors for the CMS Marketplace data layer (CLAUDE.md §3, §11). */

export class CmsConfigError extends Error {
  code = "cms_config" as const;
  constructor(message: string) {
    super(message);
    this.name = "CmsConfigError";
  }
}

export class CmsApiError extends Error {
  code = "cms_api" as const;
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "CmsApiError";
    this.status = status;
    this.body = body;
  }
}

export class CmsRateLimitError extends CmsApiError {
  constructor(message: string, body?: unknown) {
    super(429, message, body);
    this.name = "CmsRateLimitError";
  }
}

/** State not on the federal HealthCare.gov exchange (CA/NY/etc. run their own). */
export class CmsStateNotCoveredError extends Error {
  code = "cms_state" as const;
  constructor(public state: string) {
    super(`O estado ${state} usa marketplace próprio e não é coberto pela API federal do HealthCare.gov.`);
    this.name = "CmsStateNotCoveredError";
  }
}

/** Maps a CMS error to an HTTP payload; returns null when `err` is not a CMS error. */
export function cmsErrorPayload(err: unknown): { status: number; payload: { error: string; code?: string } } | null {
  if (err instanceof CmsConfigError) return { status: 500, payload: { error: err.message, code: err.code } };
  if (err instanceof CmsStateNotCoveredError) return { status: 422, payload: { error: err.message, code: err.code } };
  if (err instanceof CmsRateLimitError)
    return { status: 429, payload: { error: "Limite de requisições da API do CMS atingido. Tente de novo em instantes.", code: err.code } };
  if (err instanceof CmsApiError) {
    const status = err.status >= 400 && err.status < 600 ? err.status : 502;
    return { status, payload: { error: err.message || "Erro ao falar com a API do CMS.", code: err.code } };
  }
  return null;
}
