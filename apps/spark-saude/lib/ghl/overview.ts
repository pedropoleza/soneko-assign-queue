import { differenceInCalendarDays } from "date-fns";
import { fetchAllByTag } from "./contacts";
import { statusFromRenewalTags } from "./renewals";
import type { FieldResolver } from "./customFields";
import type { TenantConfig } from "./tenant";
import type { Contact, ChartDatum, OverviewSummary } from "@/lib/types";

/**
 * Overview aggregation (CLAUDE.md §6). Fetches the linha_saude book once and
 * computes KPIs + chart series from the custom fields — one pass, consistent
 * numbers across every widget on the dashboard.
 */

export interface OverviewParams {
  locationId: string;
  tenant: TenantConfig;
  resolver: FieldResolver;
}

export async function getOverview(params: OverviewParams): Promise<OverviewSummary> {
  const { locationId, tenant, resolver } = params;
  const contacts = await fetchAllByTag({ locationId, tenant, resolver, tag: tenant.linhaTag });
  return computeOverview(contacts, tenant);
}

const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function num(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function planoTier(p?: unknown): string {
  const s = String(p ?? "").toLowerCase();
  if (!s) return "Sem plano";
  if (s.includes("bronze")) return "Bronze";
  if (s.includes("silver") || s.includes("prata")) return "Silver";
  if (s.includes("gold") || s.includes("ouro")) return "Gold";
  if (s.includes("platin")) return "Platinum";
  return "Outros";
}

function docBucket(v?: unknown): string {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "Sem info";
  if (s.startsWith("sim") || s === "yes" || s === "complete") return "Recebida";
  if (s.startsWith("parc")) return "Parcial";
  if (s.startsWith("n")) return "Pendente";
  return "Sem info";
}

function topN(counts: Map<string, number>, n: number): ChartDatum[] {
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const head = entries.slice(0, n).map(([label, value]) => ({ label, value }));
  const rest = entries.slice(n).reduce((s, [, v]) => s + v, 0);
  if (rest > 0) head.push({ label: "Outros", value: rest });
  return head;
}

/** Pure aggregation — reused by fixtures so dev and prod compute identically. */
export function computeOverview(contacts: Contact[], tenant: TenantConfig): OverviewSummary {
  const t = tenant.overviewTags;
  const hasTag = (c: Contact, tag: string) => c.tags.includes(tag);

  let activeClients = 0;
  let awaitingApproval = 0;
  let applicationsInProgress = 0;
  let mrr = 0;

  const seguradora = new Map<string, number>();
  const plano = new Map<string, number>();
  const doc = new Map<string, number>();
  const renewalStatus = new Map<string, number>();

  // renewals by month: current month + next 5
  const now = new Date();
  const monthBuckets: ChartDatum[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return { label: MONTHS_PT[d.getMonth()], value: 0 };
  });
  let upcomingRenewals = 0;

  for (const c of contacts) {
    if (hasTag(c, t.activeClients)) activeClients++;
    if (hasTag(c, t.awaitingApproval)) awaitingApproval++;
    if (hasTag(c, t.applicationsInProgress)) applicationsInProgress++;

    const premium = num(c.fields.monthlyPremium);
    if (premium && hasTag(c, t.activeClients)) mrr += premium;

    const seg = String(c.fields.seguradora ?? "").trim();
    if (seg) seguradora.set(seg, (seguradora.get(seg) ?? 0) + 1);

    plano.set(planoTier(c.fields.planoEscolhido), (plano.get(planoTier(c.fields.planoEscolhido)) ?? 0) + 1);
    doc.set(docBucket(c.fields.documentacaoRecebida), (doc.get(docBucket(c.fields.documentacaoRecebida)) ?? 0) + 1);

    const raw = c.fields.dataRenovacao;
    if (raw) {
      const d = new Date(typeof raw === "number" ? raw : String(raw));
      if (!Number.isNaN(d.getTime())) {
        const days = differenceInCalendarDays(d, now);
        if (days >= 0 && days <= 60) upcomingRenewals++;
        const monthIdx = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
        const bucket = monthIdx < 0 ? 0 : monthIdx; // overdue folds into current month
        if (bucket >= 0 && bucket < monthBuckets.length) monthBuckets[bucket]!.value++;

        const st = statusFromRenewalTags(c.tags, tenant);
        const label =
          st === "avisado" ? "Avisado" : st === "pendente" ? "Pendente" : st === "feito" ? "Feito" : st === "nao_renovou" ? "Não renovou" : "Sem status";
        renewalStatus.set(label, (renewalStatus.get(label) ?? 0) + 1);
      }
    }
  }

  const activePremiums = contacts
    .filter((c) => hasTag(c, t.activeClients) && num(c.fields.monthlyPremium))
    .map((c) => num(c.fields.monthlyPremium) as number);
  const avgMonthly = activePremiums.length ? mrr / activePremiums.length : 0;
  void avgMonthly;

  const attention = contacts.filter((c) => tenant.attentionTags.some((tag) => c.tags.includes(tag))).slice(0, 12);

  const orderedDoc = ["Recebida", "Parcial", "Pendente", "Sem info"]
    .map((label) => ({ label, value: doc.get(label) ?? 0 }))
    .filter((d) => d.value > 0);

  const orderedPlano = ["Bronze", "Silver", "Gold", "Platinum", "Outros", "Sem plano"]
    .map((label) => ({ label, value: plano.get(label) ?? 0 }))
    .filter((d) => d.value > 0);

  const orderedRenewal = ["Pendente", "Avisado", "Feito", "Não renovou", "Sem status"]
    .map((label) => ({ label, value: renewalStatus.get(label) ?? 0 }))
    .filter((d) => d.value > 0);

  return {
    kpis: {
      activeClients,
      mrr,
      upcomingRenewals,
      awaitingApproval,
      applicationsInProgress,
      totalClients: contacts.length,
    },
    bySeguradora: topN(seguradora, 6),
    byPlano: orderedPlano,
    docStatus: orderedDoc,
    renewalsByMonth: monthBuckets,
    renewalStatus: orderedRenewal,
    attention,
  };
}
