/** Typed errors for the GHL data layer (CLAUDE.md §2, §8). */

export class GhlConfigError extends Error {
  code = "ghl_config" as const;
  constructor(message: string) {
    super(message);
    this.name = "GhlConfigError";
  }
}

export class GhlApiError extends Error {
  code = "ghl_api" as const;
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "GhlApiError";
    this.status = status;
    this.body = body;
  }
}

export class GhlRateLimitError extends GhlApiError {
  constructor(message: string, body?: unknown) {
    super(429, message, body);
    this.name = "GhlRateLimitError";
  }
}

export function toErrorResponse(err: unknown): { status: number; payload: { error: string; code?: string } } {
  if (err instanceof GhlConfigError) {
    return { status: 500, payload: { error: err.message, code: err.code } };
  }
  if (err instanceof GhlRateLimitError) {
    return { status: 429, payload: { error: "Limite de requisições do GHL atingido. Tente de novo em instantes.", code: err.code } };
  }
  if (err instanceof GhlApiError) {
    const status = err.status >= 400 && err.status < 600 ? err.status : 502;
    return { status, payload: { error: err.message || "Erro ao falar com o GHL.", code: err.code } };
  }
  const message = err instanceof Error ? err.message : "Erro inesperado.";
  return { status: 500, payload: { error: message } };
}
