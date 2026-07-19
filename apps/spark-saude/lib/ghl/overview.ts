import { countContactsByTag, listContactsByTag } from "./contacts";
import { getRenewals } from "./renewals";
import type { FieldResolver } from "./customFields";
import type { TenantConfig } from "./tenant";
import type { Contact, OverviewSummary } from "@/lib/types";

/**
 * Overview aggregation (CLAUDE.md §6): summary metrics + a short "needs
 * attention" list. Counts come from cheap tag totals; the attention list merges
 * contacts carrying any of the tenant's attention tags.
 */

export interface OverviewParams {
  locationId: string;
  tenant: TenantConfig;
  resolver: FieldResolver;
}

export async function getOverview(params: OverviewParams): Promise<OverviewSummary> {
  const { locationId, tenant, resolver } = params;

  const [activeClients, applicationsInProgress, awaitingApproval, renewals60, attention] =
    await Promise.all([
      countContactsByTag(locationId, tenant.overviewTags.activeClients),
      countContactsByTag(locationId, tenant.overviewTags.applicationsInProgress),
      countContactsByTag(locationId, tenant.overviewTags.awaitingApproval),
      getRenewals({ locationId, tenant, resolver, withinDays: 60 }),
      collectAttention(locationId, tenant, resolver),
    ]);

  return {
    metrics: [
      { key: "activeClients", label: "Clientes ativos", value: activeClients },
      { key: "upcomingRenewals", label: "Renovações (60 dias)", value: renewals60.length },
      { key: "applicationsInProgress", label: "Aplicações em andamento", value: applicationsInProgress },
      { key: "awaitingApproval", label: "Aguardando aprovação", value: awaitingApproval },
    ],
    attention,
  };
}

async function collectAttention(
  locationId: string,
  tenant: TenantConfig,
  resolver: FieldResolver,
): Promise<Contact[]> {
  const perTag = await Promise.all(
    tenant.attentionTags.map((tag) =>
      listContactsByTag({ locationId, tenant, resolver, tag, limit: 10 }).then((r) => r.items).catch(() => []),
    ),
  );
  const byId = new Map<string, Contact>();
  for (const list of perTag) {
    for (const c of list) if (!byId.has(c.id)) byId.set(c.id, c);
  }
  return Array.from(byId.values()).slice(0, 12);
}
