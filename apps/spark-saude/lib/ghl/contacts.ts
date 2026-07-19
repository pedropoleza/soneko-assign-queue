import { ghlFetch } from "./client";
import { extractContactFields, type FieldResolver } from "./customFields";
import type { TenantConfig } from "./tenant";
import type { Contact, Paginated } from "@/lib/types";

/**
 * Contacts (CLAUDE.md §7). Listing by tag uses POST /contacts/search with a
 * `tags contains` filter and cursor pagination via each contact's `searchAfter`.
 * Free-text search uses GET /contacts/?query=. Writes (tags, custom field) go
 * through dedicated helpers and are only called from validated route handlers.
 */

interface RawContact {
  id: string;
  contactName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  dateAdded?: string;
  dateUpdated?: string;
  customFields?: { id: string; value?: unknown; field_value?: unknown }[];
  searchAfter?: (string | number)[];
}

function displayName(raw: RawContact): string {
  return (
    raw.contactName?.trim() ||
    [raw.firstName, raw.lastName].filter(Boolean).join(" ").trim() ||
    raw.email ||
    "(sem nome)"
  );
}

export function normalizeContact(raw: RawContact, resolver: FieldResolver): Contact {
  return {
    id: raw.id,
    name: displayName(raw),
    firstName: raw.firstName,
    lastName: raw.lastName,
    email: raw.email,
    phone: raw.phone,
    tags: raw.tags ?? [],
    dateAdded: raw.dateAdded,
    dateUpdated: raw.dateUpdated,
    fields: extractContactFields(raw.customFields, resolver),
  };
}

export interface ListParams {
  locationId: string;
  tenant: TenantConfig;
  resolver: FieldResolver;
  tag?: string;
  limit?: number;
  searchAfter?: (string | number)[];
}

/** Paginated listing filtered by a tag (defaults to the tenant's linha tag). */
export async function listContactsByTag(params: ListParams): Promise<Paginated<Contact>> {
  const { locationId, tenant, resolver, limit = 25 } = params;
  const tag = params.tag ?? tenant.linhaTag;
  const body: Record<string, unknown> = {
    locationId,
    pageLimit: limit,
    filters: [{ field: "tags", operator: "contains", value: tag }],
    sort: [{ field: "dateAdded", direction: "desc" }],
  };
  if (params.searchAfter?.length) body.searchAfter = params.searchAfter;

  const data = await ghlFetch<{ contacts?: RawContact[]; total?: number }>("/contacts/search", {
    locationId,
    method: "POST",
    body,
  });
  const raw = data.contacts ?? [];
  const items = raw.map((r) => normalizeContact(r, resolver));
  const last = raw[raw.length - 1];
  const nextCursor =
    raw.length >= limit && last?.searchAfter ? { searchAfter: last.searchAfter } : null;
  return { items, total: data.total ?? items.length, nextCursor };
}

/** Count contacts carrying a tag (cheap — reads `total` with pageLimit 1). */
export async function countContactsByTag(locationId: string, tag: string): Promise<number> {
  const data = await ghlFetch<{ total?: number }>("/contacts/search", {
    locationId,
    method: "POST",
    body: {
      locationId,
      pageLimit: 1,
      filters: [{ field: "tags", operator: "contains", value: tag }],
    },
  });
  return data.total ?? 0;
}

/** Free-text search (name/email/phone). Optionally restrict to a tag client-side. */
export async function quickSearchContacts(params: {
  locationId: string;
  resolver: FieldResolver;
  query: string;
  restrictTag?: string;
  limit?: number;
}): Promise<Contact[]> {
  const { locationId, resolver, query, restrictTag, limit = 25 } = params;
  const data = await ghlFetch<{ contacts?: RawContact[] }>("/contacts/", {
    locationId,
    query: { locationId, query, limit },
  });
  let items = (data.contacts ?? []).map((r) => normalizeContact(r, resolver));
  if (restrictTag) items = items.filter((c) => c.tags.includes(restrictTag));
  return items;
}

/** Fetch up to `maxPages` pages of a tag's contacts (for renewals/overview aggregation). */
export async function fetchAllByTag(
  params: Omit<ListParams, "searchAfter"> & { maxPages?: number },
): Promise<Contact[]> {
  const { maxPages = 8, limit = 100 } = params;
  const all: Contact[] = [];
  let cursor: (string | number)[] | undefined;
  for (let page = 0; page < maxPages; page++) {
    const res = await listContactsByTag({ ...params, limit, searchAfter: cursor });
    all.push(...res.items);
    if (!res.nextCursor?.searchAfter?.length) break;
    cursor = res.nextCursor.searchAfter;
  }
  return all;
}

export async function getContactDetail(
  locationId: string,
  id: string,
  resolver: FieldResolver,
): Promise<Contact> {
  const data = await ghlFetch<{ contact?: RawContact }>(`/contacts/${id}`, { locationId });
  if (!data.contact) {
    return {
      id,
      name: "(não encontrado)",
      tags: [],
      fields: {},
    };
  }
  return normalizeContact(data.contact, resolver);
}

// --- Writes ----------------------------------------------------------------

export async function addContactTags(locationId: string, id: string, tags: string[]): Promise<string[]> {
  const data = await ghlFetch<{ tags?: string[] }>(`/contacts/${id}/tags`, {
    locationId,
    method: "POST",
    body: { tags },
  });
  return data.tags ?? [];
}

export async function removeContactTags(locationId: string, id: string, tags: string[]): Promise<string[]> {
  const data = await ghlFetch<{ tags?: string[] }>(`/contacts/${id}/tags`, {
    locationId,
    method: "DELETE",
    body: { tags },
  });
  return data.tags ?? [];
}

export async function updateContactCustomField(
  locationId: string,
  id: string,
  fieldId: string,
  value: string | number,
): Promise<void> {
  await ghlFetch(`/contacts/${id}`, {
    locationId,
    method: "PUT",
    body: { customFields: [{ id: fieldId, value }] },
  });
}
