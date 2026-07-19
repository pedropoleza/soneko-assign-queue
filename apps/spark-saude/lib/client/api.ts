import type {
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

export const api = {
  overview: () => request<OverviewSummary>("/api/overview"),
  renewals: (within: 30 | 60 | 90) => request<RenewalItem[]>(`/api/renewals?within=${within}`),
  pipeline: () => request<PipelineView[]>("/api/pipeline"),
  contacts: (params: { q?: string; cursor?: (string | number)[]; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.limit) sp.set("limit", String(params.limit));
    if (params.cursor?.length) sp.set("cursor", JSON.stringify(params.cursor));
    return request<Paginated<Contact>>(`/api/contacts?${sp.toString()}`);
  },
  contact: (id: string) => request<Contact>(`/api/contacts/${id}`),

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
