import { resolveLocationId, serverEnv } from "@/lib/config";
import { getTenantConfig } from "./tenant";
import { buildFieldResolver } from "./customFields";
import {
  addContactTags,
  getContactDetail,
  listContactsByTag,
  quickSearchContacts,
  removeContactTags,
  updateContactCustomField,
} from "./contacts";
import { getRenewals } from "./renewals";
import { getOverview } from "./overview";
import { getPipelineViews } from "./pipelineView";
import { moveOpportunityStage } from "./opportunities";
import { GhlConfigError } from "./errors";
import * as fx from "./__fixtures__/data";
import type { Contact, OverviewSummary, Paginated, PipelineView, RenewalItem, SemanticField } from "@/lib/types";

/**
 * High-level, typed data facade consumed by the route handlers (CLAUDE.md §8).
 * The front NEVER imports this — it calls /api/* which calls these. Each
 * function switches between fixtures (dev) and the real GHL API.
 */

export async function getConfigData(locationIn?: string): Promise<{ locationId: string; ghlAppBase: string }> {
  return { locationId: resolveLocationId(locationIn), ghlAppBase: serverEnv.ghlAppBase };
}

export async function getOverviewData(locationIn?: string): Promise<OverviewSummary> {
  const locationId = resolveLocationId(locationIn);
  const tenant = await getTenantConfig(locationId);
  if (serverEnv.useFixtures) return fx.fixtureOverview(tenant);
  const resolver = await buildFieldResolver(locationId, tenant);
  return getOverview({ locationId, tenant, resolver });
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

export async function getPipelineData(locationIn?: string): Promise<PipelineView[]> {
  const locationId = resolveLocationId(locationIn);
  const tenant = await getTenantConfig(locationId);
  if (serverEnv.useFixtures) return fx.FIXTURE_PIPELINE_VIEWS;
  return getPipelineViews(locationId, tenant);
}

export async function getContactsData(
  locationIn: string | undefined,
  params: { q?: string; cursor?: (string | number)[]; limit?: number },
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
      restrictTag: tenant.linhaTag,
      limit,
    });
    return { items, total: items.length, nextCursor: null };
  }
  return listContactsByTag({ locationId, tenant, resolver, limit, searchAfter: params.cursor });
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
