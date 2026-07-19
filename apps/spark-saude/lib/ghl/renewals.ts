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
  /** ISO yyyy-mm-dd lower bound on data_renovacao (omit to include overdue). */
  from?: string;
  /** ISO yyyy-mm-dd upper bound on data_renovacao. */
  to?: string;
  /** Back-compat: "next N days" — sets `to` = today+N when from/to are absent. */
  withinDays?: number;
}

/** Pure date-range filter over already-computed renewal items. */
export function filterRenewalsByRange(items: RenewalItem[], from?: string, to?: string): RenewalItem[] {
  const fromT = from ? new Date(`${from}T00:00:00`).getTime() : null;
  const toT = to ? new Date(`${to}T23:59:59`).getTime() : null;
  return items
    .filter((r) => {
      if (!r.dataRenovacao) return false;
      const t = new Date(r.dataRenovacao).getTime();
      if (Number.isNaN(t)) return false;
      if (fromT != null && t < fromT) return false;
      if (toT != null && t > toT) return false;
      return true;
    })
    .sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0));
}

export function renewalRange(params: { from?: string; to?: string; withinDays?: number }): {
  from?: string;
  to?: string;
} {
  if (params.from || params.to) return { from: params.from, to: params.to };
  if (params.withinDays) {
    const to = new Date();
    to.setDate(to.getDate() + params.withinDays);
    return { to: to.toISOString().slice(0, 10) };
  }
  return {};
}

export async function getRenewals(params: RenewalParams): Promise<RenewalItem[]> {
  const { locationId, tenant, resolver } = params;
  const contacts = await fetchAllByTag({ locationId, tenant, resolver, tag: tenant.linhaTag });
  const items = contacts
    .map((c) => contactToRenewal(c, tenant))
    .filter((r): r is RenewalItem => r !== null);
  const { from, to } = renewalRange(params);
  return filterRenewalsByRange(items, from, to);
}
