import { resolveLocationId, serverEnv } from "@/lib/config";
import { getTenantConfig } from "./tenant";
import { buildFieldResolver } from "./customFields";
import {
  addContactNote,
  addContactTags,
  createContact,
  fetchAllByTag,
  getContactChannels,
  getContactDetail,
  listContactsByTag,
  quickSearchContacts,
  removeContactTags,
  sendContactMessage,
  updateContactBasics,
  updateContactCustomField,
  type CreateContactInput,
} from "./contacts";
import { linkContacts } from "./associations";
import { getRenewals } from "./renewals";
import { getOverview } from "./overview";
import { getPipelineViews } from "./pipelineView";
import { getActivity } from "./activity";
import { moveOpportunityStage } from "./opportunities";
import { GhlConfigError } from "./errors";
import * as fx from "./__fixtures__/data";
import type { ActivitySummary, Contact, OverviewSummary, Paginated, PipelineView, RenewalItem, SemanticField } from "@/lib/types";

/**
 * High-level, typed data facade consumed by the route handlers (CLAUDE.md §8).
 * The front NEVER imports this — it calls /api/* which calls these. Each
 * function switches between fixtures (dev) and the real GHL API.
 */

export async function getConfigData(locationIn?: string) {
  const locationId = resolveLocationId(locationIn);
  const tenant = await getTenantConfig(locationId);
  return {
    locationId,
    ghlAppBase: serverEnv.ghlAppBase,
    tags: {
      linha: tenant.linhaTag,
      active: tenant.overviewTags.activeClients,
      applicationsInProgress: tenant.overviewTags.applicationsInProgress,
      awaiting: tenant.overviewTags.awaitingApproval,
      attention: tenant.attentionTags,
      renewal: tenant.renewalTags,
    },
  };
}

/** The full linha_saude book for client-side analytics (capped by fetchAllByTag). */
export async function getBookData(locationIn?: string): Promise<Contact[]> {
  const locationId = resolveLocationId(locationIn);
  const tenant = await getTenantConfig(locationId);
  if (serverEnv.useFixtures) return fx.FIXTURE_CONTACTS;
  const resolver = await buildFieldResolver(locationId, tenant);
  return fetchAllByTag({ locationId, tenant, resolver, tag: tenant.linhaTag });
}

export async function getOverviewData(
  locationIn?: string,
  params: { from?: string; to?: string } = {},
): Promise<OverviewSummary> {
  const locationId = resolveLocationId(locationIn);
  const tenant = await getTenantConfig(locationId);
  if (serverEnv.useFixtures) return fx.fixtureOverview(tenant, params);
  const resolver = await buildFieldResolver(locationId, tenant);
  return getOverview({ locationId, tenant, resolver, ...params });
}

export async function getRenewalsData(
  locationIn: string | undefined,
  params: { from?: string; to?: string; withinDays?: number },
): Promise<RenewalItem[]> {
  const locationId = resolveLocationId(locationIn);
  const tenant = await getTenantConfig(locationId);
  if (serverEnv.useFixtures) return fx.fixtureRenewals(tenant, params);
  const resolver = await buildFieldResolver(locationId, tenant);
  return getRenewals({ locationId, tenant, resolver, ...params });
}

export async function getActivityData(
  locationIn?: string,
  params: { from?: string; to?: string } = {},
): Promise<ActivitySummary> {
  const locationId = resolveLocationId(locationIn);
  const tenant = await getTenantConfig(locationId);
  if (serverEnv.useFixtures) return fx.fixtureActivity();
  return getActivity({ locationId, tenant, ...params });
}

export async function getPipelineData(locationIn?: string): Promise<PipelineView[]> {
  const locationId = resolveLocationId(locationIn);
  const tenant = await getTenantConfig(locationId);
  if (serverEnv.useFixtures) return fx.FIXTURE_PIPELINE_VIEWS;
  return getPipelineViews(locationId, tenant);
}

export async function getContactsData(
  locationIn: string | undefined,
  params: { q?: string; cursor?: (string | number)[]; limit?: number; all?: boolean },
): Promise<Paginated<Contact>> {
  const locationId = resolveLocationId(locationIn);
  const tenant = await getTenantConfig(locationId);
  const limit = params.limit ?? 25;

  if (serverEnv.useFixtures) {
    let items = fx.FIXTURE_CONTACTS;
    if (params.q) {
      const q = params.q.toLowerCase();
      items = items.filter(
        (c) => c.name.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q),
      );
    }
    return { items, total: items.length, nextCursor: null };
  }

  const resolver = await buildFieldResolver(locationId, tenant);
  if (params.q) {
    const items = await quickSearchContacts({
      locationId,
      resolver,
      query: params.q,
      // `all` lifts the linha_saude restriction — household members (spouse,
      // children) usually exist in the CRM without the product tag.
      restrictTag: params.all ? undefined : tenant.linhaTag,
      limit,
    });
    return { items, total: items.length, nextCursor: null };
  }
  return listContactsByTag({ locationId, tenant, resolver, limit, searchAfter: params.cursor });
}

/** Create a contact (household member) — phone/e-mail optional by design. */
export async function createContactData(
  locationIn: string | undefined,
  input: CreateContactInput,
): Promise<{ id: string; name: string }> {
  const locationId = resolveLocationId(locationIn);
  if (serverEnv.useFixtures) return { id: `fx_${Date.now()}`, name: [input.firstName, input.lastName].filter(Boolean).join(" ") };
  return createContact(locationId, input);
}

/** Upsert native fields onto a contact (birth date, phone, e-mail). */
export async function updateBasicsData(
  locationIn: string | undefined,
  id: string,
  basics: { dateOfBirth?: string; gender?: "male" | "female"; phone?: string; email?: string },
): Promise<{ ok: true }> {
  const locationId = resolveLocationId(locationIn);
  if (serverEnv.useFixtures) return { ok: true };
  await updateContactBasics(locationId, id, basics);
  return { ok: true };
}

/** Link two contacts under the household association. */
export async function linkContactsData(
  locationIn: string | undefined,
  firstId: string,
  secondId: string,
): Promise<{ ok: true }> {
  const locationId = resolveLocationId(locationIn);
  if (serverEnv.useFixtures) return { ok: true };
  await linkContacts(locationId, firstId, secondId);
  return { ok: true };
}

/** Just the destination fields (phone/e-mail) — for the dispatch guard. */
export async function getContactChannelsData(
  locationIn: string | undefined,
  id: string,
): Promise<{ phone?: string | null; email?: string | null }> {
  const locationId = resolveLocationId(locationIn);
  if (serverEnv.useFixtures) return { phone: null, email: null };
  return getContactChannels(locationId, id);
}

export async function getContactData(locationIn: string | undefined, id: string): Promise<Contact> {
  const locationId = resolveLocationId(locationIn);
  const tenant = await getTenantConfig(locationId);
  if (serverEnv.useFixtures) {
    return fx.FIXTURE_CONTACTS.find((c) => c.id === id) ?? { id, name: "(não encontrado)", tags: [], fields: {} };
  }
  const resolver = await buildFieldResolver(locationId, tenant);
  return getContactDetail(locationId, id, resolver);
}

// --- Writes ----------------------------------------------------------------

export async function addTagsData(locationIn: string | undefined, id: string, tags: string[]): Promise<string[]> {
  const locationId = resolveLocationId(locationIn);
  if (serverEnv.useFixtures) return tags;
  return addContactTags(locationId, id, tags);
}

export async function removeTagsData(locationIn: string | undefined, id: string, tags: string[]): Promise<string[]> {
  const locationId = resolveLocationId(locationIn);
  if (serverEnv.useFixtures) return [];
  return removeContactTags(locationId, id, tags);
}

/** Register a note on the contact's timeline (quote history in the CRM). */
export async function addNoteData(locationIn: string | undefined, id: string, body: string): Promise<{ ok: true }> {
  const locationId = resolveLocationId(locationIn);
  if (serverEnv.useFixtures) return { ok: true };
  await addContactNote(locationId, id, body);
  return { ok: true };
}

/** Send the proposal to the lead through GHL Conversations. */
export async function sendMessageData(
  locationIn: string | undefined,
  contactId: string,
  message: string,
  type: "SMS" | "Email" | "WhatsApp" = "SMS",
  email?: { subject: string; html: string },
): Promise<{ ok: true; messageId?: string }> {
  const locationId = resolveLocationId(locationIn);
  if (serverEnv.useFixtures) return { ok: true };
  const res = await sendContactMessage(locationId, contactId, message, type, email);
  return { ok: true, messageId: res.messageId };
}

export async function updateFieldData(
  locationIn: string | undefined,
  id: string,
  semantic: SemanticField,
  value: string | number,
): Promise<{ ok: true }> {
  const locationId = resolveLocationId(locationIn);
  if (serverEnv.useFixtures) return { ok: true };
  const tenant = await getTenantConfig(locationId);
  const resolver = await buildFieldResolver(locationId, tenant);
  const def = resolver.resolve(semantic);
  if (!def) throw new GhlConfigError(`Campo "${semantic}" não encontrado nesta location.`);
  await updateContactCustomField(locationId, id, def.id, value);
  return { ok: true };
}

export async function moveStageData(
  locationIn: string | undefined,
  opportunityId: string,
  pipelineId: string,
  stageId: string,
): Promise<{ ok: true }> {
  const locationId = resolveLocationId(locationIn);
  if (serverEnv.useFixtures) return { ok: true };
  await moveOpportunityStage({ locationId, opportunityId, pipelineId, stageId });
  return { ok: true };
}
