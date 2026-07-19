import { differenceInCalendarDays } from "date-fns";
import { fetchAllByTag } from "./contacts";
import type { FieldResolver } from "./customFields";
import type { TenantConfig } from "./tenant";
import type { Contact, RenewalItem, RenewalStatus } from "@/lib/types";

/**
 * Renewal domain logic (CLAUDE.md §6 — the priority tab). Reads `data_renovacao`
 * (resolved semantically), computes days-until, and derives status from renewal
 * tags. Window filters: 30/60/90 days (overdue always included).
 */

export type RenewalWindow = 30 | 60 | 90;

function daysUntil(dateStr?: string | number): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return differenceInCalendarDays(d, new Date());
}

export function statusFromRenewalTags(tags: string[], t: TenantConfig): RenewalStatus {
  const has = (x: string) => tags.includes(x);
  if (has(t.renewalTags.feito)) return "feito";
  if (has(t.renewalTags.naoRenovou)) return "nao_renovou";
  if (has(t.renewalTags.avisado)) return "avisado";
  if (has(t.renewalTags.pendente)) return "pendente";
  return "sem_status";
}

export function contactToRenewal(c: Contact, tenant: TenantConfig): RenewalItem | null {
  const raw = c.fields.dataRenovacao;
  const dataRenovacao = typeof raw === "number" ? new Date(raw).toISOString() : (raw as string | undefined);
  const d = daysUntil(raw);
  return {
    contactId: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    seguradora: c.fields.seguradora as string | undefined,
    planoEscolhido: c.fields.planoEscolhido as string | undefined,
    monthlyPremium: typeof c.fields.monthlyPremium === "number" ? c.fields.monthlyPremium : undefined,
    dataRenovacao,
    daysUntil: d,
    status: statusFromRenewalTags(c.tags, tenant),
    tags: c.tags,
  };
}

export interface RenewalParams {
  locationId: string;
  tenant: TenantConfig;
  resolver: FieldResolver;
  withinDays?: RenewalWindow;
}

export async function getRenewals(params: RenewalParams): Promise<RenewalItem[]> {
  const { locationId, tenant, resolver, withinDays = 90 } = params;
  const contacts = await fetchAllByTag({ locationId, tenant, resolver, tag: tenant.linhaTag });

  const items = contacts
    .map((c) => contactToRenewal(c, tenant))
    .filter((r): r is RenewalItem => r !== null && r.daysUntil !== null && r.daysUntil <= withinDays)
    // most urgent first (overdue negatives lead), then by date
    .sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0));

  return items;
}
