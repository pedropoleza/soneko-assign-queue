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
  dateOfBirth?: string;
  postalCode?: string;
  state?: string;
  city?: string;
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
    dateOfBirth: raw.dateOfBirth,
    postalCode: raw.postalCode,
    state: raw.state,
    city: raw.city,
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

/**
 * Just the destination fields (phone / e-mail), without resolving custom
 * fields — the dispatch guard only needs to know where the proposal can land,
 * so it skips the heavier `getContactDetail` path.
 */
export async function getContactChannels(
  locationId: string,
  id: string,
): Promise<{ phone?: string | null; email?: string | null }> {
  const data = await ghlFetch<{ contact?: RawContact }>(`/contacts/${id}`, { locationId });
  return { phone: data.contact?.phone ?? null, email: data.contact?.email ?? null };
}

// --- Writes ----------------------------------------------------------------

export interface CreateContactInput {
  firstName: string;
  lastName?: string;
  /** Both optional on purpose — a dependent often has neither. */
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  tags?: string[];
}

/**
 * Create-or-upsert a contact. GHL's upsert dedupes by e-mail/phone, so filling
 * the same person twice converges on one record — but it REJECTS a body with
 * neither ("Pass at least one of number, email"). Dependents (children,
 * spouses) often have neither, and that must not block the quote: those go
 * through the plain create endpoint instead.
 */
export async function createContact(
  locationId: string,
  input: CreateContactInput,
): Promise<{ id: string; name: string }> {
  const body: Record<string, unknown> = { locationId, firstName: input.firstName };
  if (input.lastName) body.lastName = input.lastName;
  if (input.email) body.email = input.email;
  if (input.phone) body.phone = input.phone;
  if (input.dateOfBirth) body.dateOfBirth = input.dateOfBirth;
  if (input.gender) body.gender = input.gender;
  if (input.tags?.length) body.tags = input.tags;

  const name = [input.firstName, input.lastName].filter(Boolean).join(" ");
  const canUpsert = Boolean(input.email || input.phone);
  const data = await ghlFetch<{ contact?: { id: string } }>(canUpsert ? "/contacts/upsert" : "/contacts/", {
    locationId,
    method: "POST",
    body,
  });
  if (!data.contact?.id) throw new Error("O GHL não retornou o contato.");
  return { id: data.contact.id, name };
}

/**
 * Write native fields the quote/dispatch flow knows back onto the contact, so
 * the CRM record converges on what the broker just typed: date of birth feeds
 * exact-age pricing, phone/e-mail are what the proposal is actually sent to.
 *
 * GHL asymmetry (verified live): POST /contacts accepts `gender`, but
 * PUT /contacts/{id} rejects it ("property gender should not exist") — and one
 * rejected property fails the whole body. So gender is written only at creation
 * time; updates carry dateOfBirth / phone / e-mail, which PUT accepts.
 */
export async function updateContactBasics(
  locationId: string,
  id: string,
  basics: { dateOfBirth?: string; gender?: "male" | "female"; phone?: string; email?: string },
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (basics.dateOfBirth) body.dateOfBirth = basics.dateOfBirth;
  if (basics.phone) body.phone = basics.phone;
  if (basics.email) body.email = basics.email;
  if (!Object.keys(body).length) return;
  await ghlFetch(`/contacts/${id}`, { locationId, method: "PUT", body });
}

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

/**
 * Attach a note to the contact's timeline. This is how a quote stays tied to
 * the lead inside the CRM: whoever opens the contact later sees what was quoted,
 * when, and for how much — without leaving GHL.
 */
export async function addContactNote(locationId: string, id: string, body: string): Promise<void> {
  await ghlFetch(`/contacts/${id}/notes`, { locationId, method: "POST", body: { body } });
}

/**
 * Send a message to the lead through GHL Conversations, so the proposal goes
 * out on the channel the contact already uses and the thread stays in the CRM.
 * For e-mail the caller passes a ready HTML body (branded); SMS/WhatsApp carry
 * the plain text as-is.
 */
export async function sendContactMessage(
  locationId: string,
  contactId: string,
  message: string,
  type: "SMS" | "Email" | "WhatsApp" = "SMS",
  email?: { subject: string; html: string },
): Promise<{ messageId?: string; conversationId?: string }> {
  const body: Record<string, unknown> = { type, contactId, message };
  if (type === "Email") {
    body.subject = email?.subject || "Sua cotação de seguro saúde";
    body.html = email?.html || message.replace(/\n/g, "<br/>");
  }
  const data = await ghlFetch<{ messageId?: string; conversationId?: string }>("/conversations/messages", {
    locationId,
    method: "POST",
    body,
  });
  return { messageId: data.messageId, conversationId: data.conversationId };
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
