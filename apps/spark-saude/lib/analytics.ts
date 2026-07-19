import { differenceInCalendarDays } from "date-fns";
import type { Contact, ChartDatum } from "@/lib/types";
import type { ConfigTags } from "@/lib/client/api";

/**
 * Client-side analytics over the linha_saude book. Pure functions — the Overview
 * fetches the book once and recomputes everything here, so date filters and
 * drill-downs are instant (no server round-trip, no dense loading state).
 */

const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function num(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function planoTier(p?: unknown): string {
  const s = String(p ?? "").toLowerCase();
  if (!s) return "Sem plano";
  if (s.includes("bronze")) return "Bronze";
  if (s.includes("silver") || s.includes("prata")) return "Silver";
  if (s.includes("gold") || s.includes("ouro")) return "Gold";
  if (s.includes("platin")) return "Platinum";
  return "Outros";
}

export function docBucket(v?: unknown): string {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "Sem info";
  if (s.startsWith("sim") || s === "yes" || s === "complete") return "Recebida";
  if (s.startsWith("parc")) return "Parcial";
  if (s.startsWith("n")) return "Pendente";
  return "Sem info";
}

function renewalDate(c: Contact): Date | null {
  const raw = c.fields.dataRenovacao;
  if (!raw) return null;
  const d = new Date(typeof raw === "number" ? raw : String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function daysUntilRenewal(c: Contact): number | null {
  const d = renewalDate(c);
  return d ? differenceInCalendarDays(d, new Date()) : null;
}

function monthIndexFromNow(d: Date): number {
  const now = new Date();
  return (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
}

export function filterByDateAdded(contacts: Contact[], from?: string, to?: string): Contact[] {
  if (!from && !to) return contacts;
  const fromT = from ? new Date(`${from}T00:00:00`).getTime() : null;
  const toT = to ? new Date(`${to}T23:59:59`).getTime() : null;
  return contacts.filter((c) => {
    if (!c.dateAdded) return false;
    const t = new Date(c.dateAdded).getTime();
    if (Number.isNaN(t)) return false;
    if (fromT != null && t < fromT) return false;
    if (toT != null && t > toT) return false;
    return true;
  });
}

function topN(map: Map<string, number>, n: number): ChartDatum[] {
  const entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const head = entries.slice(0, n).map(([label, value]) => ({ label, value }));
  const rest = entries.slice(n).reduce((s, [, v]) => s + v, 0);
  if (rest > 0) head.push({ label: "Outros", value: rest });
  return head;
}

export interface Kpis {
  activeClients: number;
  mrr: number;
  upcomingRenewals: number;
  awaitingApproval: number;
  applicationsInProgress: number;
  totalClients: number;
}

export function computeKpis(contacts: Contact[], tags: ConfigTags): Kpis {
  let activeClients = 0;
  let awaitingApproval = 0;
  let applicationsInProgress = 0;
  let mrr = 0;
  let upcomingRenewals = 0;
  for (const c of contacts) {
    const active = c.tags.includes(tags.active);
    if (active) activeClients++;
    if (c.tags.includes(tags.awaiting)) awaitingApproval++;
    if (c.tags.includes(tags.applicationsInProgress)) applicationsInProgress++;
    const premium = num(c.fields.monthlyPremium);
    if (premium && active) mrr += premium;
    const days = daysUntilRenewal(c);
    if (days != null && days >= 0 && days <= 60) upcomingRenewals++;
  }
  return { activeClients, mrr, upcomingRenewals, awaitingApproval, applicationsInProgress, totalClients: contacts.length };
}

export function bySeguradora(contacts: Contact[]): ChartDatum[] {
  const m = new Map<string, number>();
  for (const c of contacts) {
    const s = String(c.fields.seguradora ?? "").trim();
    if (s) m.set(s, (m.get(s) ?? 0) + 1);
  }
  return topN(m, 6);
}

export function byPlano(contacts: Contact[]): ChartDatum[] {
  const m = new Map<string, number>();
  for (const c of contacts) m.set(planoTier(c.fields.planoEscolhido), (m.get(planoTier(c.fields.planoEscolhido)) ?? 0) + 1);
  return ["Bronze", "Silver", "Gold", "Platinum", "Outros", "Sem plano"]
    .map((label) => ({ label, value: m.get(label) ?? 0 }))
    .filter((d) => d.value > 0);
}

export function docStatus(contacts: Contact[]): ChartDatum[] {
  const m = new Map<string, number>();
  for (const c of contacts) m.set(docBucket(c.fields.documentacaoRecebida), (m.get(docBucket(c.fields.documentacaoRecebida)) ?? 0) + 1);
  return ["Recebida", "Parcial", "Pendente", "Sem info"]
    .map((label) => ({ label, value: m.get(label) ?? 0 }))
    .filter((d) => d.value > 0);
}

export function renewalsByMonth(contacts: Contact[]): ChartDatum[] {
  const now = new Date();
  const buckets: ChartDatum[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return { label: MONTHS_PT[d.getMonth()]!, value: 0 };
  });
  for (const c of contacts) {
    const d = renewalDate(c);
    if (!d) continue;
    const idx = monthIndexFromNow(d);
    const b = idx < 0 ? 0 : idx;
    if (b >= 0 && b < buckets.length) buckets[b]!.value++;
  }
  return buckets;
}

export function newByMonth(contacts: Contact[]): ChartDatum[] {
  const now = new Date();
  const buckets: ChartDatum[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { label: MONTHS_PT[d.getMonth()]!, value: 0 };
  });
  for (const c of contacts) {
    if (!c.dateAdded) continue;
    const d = new Date(c.dateAdded);
    if (Number.isNaN(d.getTime())) continue;
    const idx = monthIndexFromNow(d) + 5; // -5..0 -> 0..5
    if (idx >= 0 && idx < buckets.length) buckets[idx]!.value++;
  }
  return buckets;
}

const ORIGEM_LABELS: Record<string, string> = {
  origem_indicacao: "Indicação",
  origem_whatsapp: "WhatsApp",
  origem_organica: "Orgânica",
};

export function byOrigem(contacts: Contact[]): ChartDatum[] {
  const m = new Map<string, number>();
  for (const c of contacts) {
    for (const t of c.tags) {
      if (t.startsWith("origem_")) m.set(ORIGEM_LABELS[t] ?? t.replace("origem_", ""), (m.get(ORIGEM_LABELS[t] ?? t) ?? 0) + 1);
    }
  }
  return topN(m, 5);
}

export function attention(contacts: Contact[], attentionTags: string[]): Contact[] {
  return contacts.filter((c) => attentionTags.some((t) => c.tags.includes(t))).slice(0, 12);
}

// --- Drill-down: from a metric/segment to the underlying contacts ------------

export type DrillSpec =
  | { kind: "kpi"; metric: "active" | "mrr" | "renewals60" | "awaiting" | "apps" | "total" }
  | { kind: "seguradora"; value: string }
  | { kind: "plano"; value: string }
  | { kind: "doc"; value: string }
  | { kind: "renewalMonth"; month: number; label: string }
  | { kind: "origem"; value: string }
  | { kind: "attention" };

export function drill(contacts: Contact[], spec: DrillSpec, tags: ConfigTags, attentionTags: string[]): { title: string; contacts: Contact[] } {
  switch (spec.kind) {
    case "kpi":
      switch (spec.metric) {
        case "active":
          return { title: "Clientes ativos", contacts: contacts.filter((c) => c.tags.includes(tags.active)) };
        case "mrr":
          return { title: "Receita mensal — clientes ativos com prêmio", contacts: contacts.filter((c) => c.tags.includes(tags.active) && num(c.fields.monthlyPremium)) };
        case "renewals60": {
          return {
            title: "Renovações nos próximos 60 dias",
            contacts: contacts.filter((c) => {
              const d = daysUntilRenewal(c);
              return d != null && d >= 0 && d <= 60;
            }),
          };
        }
        case "awaiting":
          return { title: "Aguardando aprovação", contacts: contacts.filter((c) => c.tags.includes(tags.awaiting)) };
        case "apps":
          return { title: "Aplicações em andamento", contacts: contacts.filter((c) => c.tags.includes(tags.applicationsInProgress)) };
        case "total":
        default:
          return { title: "Carteira (linha saúde)", contacts };
      }
    case "seguradora":
      if (spec.value === "Outros")
        return { title: "Seguradora · Outros", contacts: contacts.filter((c) => String(c.fields.seguradora ?? "").trim() !== "") };
      return { title: `Seguradora · ${spec.value}`, contacts: contacts.filter((c) => String(c.fields.seguradora ?? "").trim() === spec.value) };
    case "plano":
      return { title: `Plano · ${spec.value}`, contacts: contacts.filter((c) => planoTier(c.fields.planoEscolhido) === spec.value) };
    case "doc":
      return { title: `Documentação · ${spec.value}`, contacts: contacts.filter((c) => docBucket(c.fields.documentacaoRecebida) === spec.value) };
    case "renewalMonth":
      return {
        title: `Renovações · ${spec.label}`,
        contacts: contacts.filter((c) => {
          const d = renewalDate(c);
          if (!d) return false;
          const idx = monthIndexFromNow(d);
          return (idx < 0 ? 0 : idx) === spec.month;
        }),
      };
    case "origem": {
      const tag = Object.keys(ORIGEM_LABELS).find((k) => ORIGEM_LABELS[k] === spec.value) ?? `origem_${spec.value.toLowerCase()}`;
      return { title: `Origem · ${spec.value}`, contacts: contacts.filter((c) => c.tags.includes(tag)) };
    }
    case "attention":
      return { title: "Precisa de atenção", contacts: attention(contacts, attentionTags) };
    default:
      return { title: "Contatos", contacts };
  }
}
