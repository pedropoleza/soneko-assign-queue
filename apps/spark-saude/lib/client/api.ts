import type {
  ActivitySummary,
  Contact,
  OverviewSummary,
  Paginated,
  PipelineView,
  RenewalItem,
  SemanticField,
} from "@/lib/types";

/**
 * Front-end API client. The browser talks ONLY to our /api/* route handlers —
 * never to the GHL API directly (CLAUDE.md §2, §8).
 */

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

export interface ConfigTags {
  linha: string;
  active: string;
  applicationsInProgress: string;
  awaiting: string;
  attention: string[];
  renewal: { avisado: string; pendente: string; feito: string; naoRenovou: string };
}

export interface AppConfig {
  locationId: string;
  ghlAppBase: string;
  tags: ConfigTags;
}

/** Deep link to a contact in the native GHL UI (opens in a new tab). */
export function ghlContactUrl(cfg: AppConfig | undefined, contactId: string): string | undefined {
  if (!cfg?.ghlAppBase || !cfg.locationId) return undefined;
  return `${cfg.ghlAppBase}/v2/location/${cfg.locationId}/contacts/detail/${contactId}`;
}

export const api = {
  config: () => request<AppConfig>("/api/config"),
  book: () => request<{ contacts: Contact[] }>("/api/book"),
  overview: (params: { from?: string; to?: string } = {}) => {
    const sp = new URLSearchParams();
    if (params.from) sp.set("from", params.from);
    if (params.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<OverviewSummary>(`/api/overview${qs ? `?${qs}` : ""}`);
  },
  renewals: (params: { within?: number; from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params.from) sp.set("from", params.from);
    if (params.to) sp.set("to", params.to);
    if (params.within && !params.from && !params.to) sp.set("within", String(params.within));
    return request<RenewalItem[]>(`/api/renewals?${sp.toString()}`);
  },
  pipeline: () => request<PipelineView[]>("/api/pipeline"),
  activity: (params: { from?: string; to?: string } = {}) => {
    const sp = new URLSearchParams();
    if (params.from) sp.set("from", params.from);
    if (params.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<ActivitySummary>(`/api/activity${qs ? `?${qs}` : ""}`);
  },
  contacts: (params: { q?: string; cursor?: (string | number)[]; limit?: number; all?: boolean }) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.limit) sp.set("limit", String(params.limit));
    if (params.cursor?.length) sp.set("cursor", JSON.stringify(params.cursor));
    if (params.all) sp.set("all", "1");
    return request<Paginated<Contact>>(`/api/contacts?${sp.toString()}`);
  },
  contact: (id: string) => request<Contact>(`/api/contacts/${id}`),

  /** Create a household member — phone/e-mail optional by design. */
  createContact: (input: {
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
    gender?: "male" | "female";
  }) => request<{ id: string; name: string }>("/api/contacts", { method: "POST", body: JSON.stringify(input) }),

  /** Upsert native fields (birth date, phone, e-mail) onto an existing contact. */
  updateContactBasics: (
    id: string,
    basics: { dateOfBirth?: string; gender?: "male" | "female"; phone?: string; email?: string },
  ) => request<{ ok: true }>(`/api/contacts/${id}`, { method: "PATCH", body: JSON.stringify(basics) }),

  addTags: (id: string, tags: string[]) =>
    request<{ tags: string[] }>(`/api/contacts/${id}/tags`, { method: "POST", body: JSON.stringify({ tags }) }),
  removeTags: (id: string, tags: string[]) =>
    request<{ tags: string[] }>(`/api/contacts/${id}/tags`, { method: "DELETE", body: JSON.stringify({ tags }) }),
  updateField: (id: string, field: SemanticField, value: string | number) =>
    request<{ ok: true }>(`/api/contacts/${id}/field`, { method: "PUT", body: JSON.stringify({ field, value }) }),
  moveStage: (id: string, pipelineId: string, stageId: string) =>
    request<{ ok: true }>(`/api/opportunities/${id}/stage`, {
      method: "PUT",
      body: JSON.stringify({ pipelineId, stageId }),
    }),
};
