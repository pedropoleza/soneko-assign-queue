import type { PlanOptionDraft, PublicProposal, Quote, QuoteProfile } from "@/lib/cotacao/types";
import type { QuoteSearchResult } from "@/lib/cms";

/** Front-end client for the Cotação endpoints. Browser talks only to /api/*. */

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Erro ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface CreateQuoteResult {
  id: string;
  token: string;
  url: string;
  expiresAt: string;
}

export const cotacaoApi = {
  /** CMS estimate for a household profile. */
  search: (profile: QuoteProfile) =>
    request<QuoteSearchResult>("/api/quotes/search", { method: "POST", body: JSON.stringify(profile) }),

  /** Upload a plan print (multipart) → private storage, returns a signed URL. */
  uploadPrint: async (file: File): Promise<{ url: string }> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/quotes/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || `Erro ${res.status}`);
    }
    return (await res.json()) as { url: string };
  },

  /** Persist a quote from the chosen options and get its shareable link. */
  create: (profile: QuoteProfile, options: PlanOptionDraft[], ttlDays?: number) =>
    request<CreateQuoteResult>("/api/quotes", { method: "POST", body: JSON.stringify({ profile, options, ttlDays }) }),

  get: (id: string) => request<Quote>(`/api/quotes/${id}`),

  /** Public proposal (Ponta B). */
  proposal: (token: string) => request<PublicProposal>(`/api/proposal/${token}`),

  respond: (token: string, quoteOptionId: string, decisao: "aprovado" | "recusado", comentario?: string) =>
    request<{ ok: true }>(`/api/proposal/${token}/respond`, {
      method: "POST",
      body: JSON.stringify({ quoteOptionId, decisao, comentario }),
    }),
};
