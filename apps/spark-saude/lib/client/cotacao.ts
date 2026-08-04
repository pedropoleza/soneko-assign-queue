import type { PlanOptionDraft, PlanQuote, PublicProposal, Quote, QuoteProfile } from "@/lib/cotacao/types";
import type { QuoteSearchResult } from "@/lib/cms";
import type { PrefillResult } from "@/lib/cotacao/prefill";
import type { Recommendation } from "@/lib/cotacao/recommend";

export interface SearchOptions {
  sort?: "premium" | "deductible" | "oopc" | "total_costs" | "quality_rating";
  metalLevels?: string[];
  limit?: number;
  offset?: number;
}

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
  /** CMS estimate for a household profile (server-side sort/filter/paging). */
  search: (profile: QuoteProfile, opts: SearchOptions = {}) =>
    request<QuoteSearchResult>("/api/quotes/search", { method: "POST", body: JSON.stringify({ profile, ...opts }) }),

  /** Seed the household from the picked GHL contact's real CRM data. */
  prefill: (contactId: string, year: number) =>
    request<PrefillResult>(`/api/quotes/prefill?contactId=${encodeURIComponent(contactId)}&year=${year}`),

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

  /** Read a plan print: returns the extracted fields plus the stored print. */
  extractFromPrint: async (file: File): Promise<{ plan: PlanQuote; printUrl: string }> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/quotes/extract", { method: "POST", body: fd });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || `Erro ${res.status}`);
    }
    return (await res.json()) as { plan: PlanQuote; printUrl: string };
  },

  /** Persist a quote from the chosen options and get its shareable link. */
  create: (profile: QuoteProfile, options: PlanOptionDraft[], recommendedPlanId?: string | null, ttlDays?: number) =>
    request<CreateQuoteResult>("/api/quotes", {
      method: "POST",
      body: JSON.stringify({ profile, options, recommendedPlanId, ttlDays }),
    }),

  /** Ask which of the chosen plans to present as the recommendation. */
  recommend: (profile: QuoteProfile, options: PlanOptionDraft[]) =>
    request<Recommendation>("/api/quotes/recommend", { method: "POST", body: JSON.stringify({ profile, options }) }),

  /** Deliver the proposal to the lead through GHL Conversations (PDF attached). */
  sendToLead: (args: {
    contactId: string;
    message: string;
    channel: "WhatsApp" | "Email";
    proposalUrl?: string;
    profile?: { contactName?: string; year?: number };
    quoteId?: string;
    attachPdf?: boolean;
  }) =>
    request<{ ok: true; messageId?: string; pdfAttached?: boolean; pdfError?: string }>("/api/quotes/send", {
      method: "POST",
      body: JSON.stringify(args),
    }),

  /** Where the broker can open/download the branded PDF for a quote. */
  pdfUrl: (quoteId: string) => `/api/quotes/${quoteId}/pdf`,

  get: (id: string) => request<Quote>(`/api/quotes/${id}`),

  /** Public proposal (Ponta B). */
  proposal: (token: string) => request<PublicProposal>(`/api/proposal/${token}`),

  respond: (token: string, quoteOptionId: string, decisao: "aprovado" | "recusado", comentario?: string) =>
    request<{ ok: true }>(`/api/proposal/${token}/respond`, {
      method: "POST",
      body: JSON.stringify({ quoteOptionId, decisao, comentario }),
    }),
};
