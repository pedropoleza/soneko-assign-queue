import { getAppointments } from "./calendars";
import { getConversations } from "./conversations";
import { getPipelines } from "./pipelines";
import { searchOpportunities } from "./opportunities";
import type { TenantConfig } from "./tenant";
import type {
  ActivitySummary,
  AgendaSummary,
  Appointment,
  ChartDatum,
  ConversationItem,
  ConversationsSummary,
  OppRevenue,
} from "@/lib/types";

function countBy<T>(items: T[], key: (t: T) => string): ChartDatum[] {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
}

export function computeAgenda(appts: Appointment[]): AgendaSummary {
  const has = (s: string) => appts.filter((a) => a.status === s).length;
  const upcoming = appts
    .filter((a) => a.startTime && new Date(a.startTime).getTime() >= Date.now())
    .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime())
    .slice(0, 8);
  return {
    kpis: {
      total: appts.length,
      confirmados: has("Confirmado"),
      compareceu: has("Compareceu"),
      noShow: has("No-show"),
      cancelados: has("Cancelado"),
    },
    byStatus: countBy(appts, (a) => a.status),
    byCalendar: countBy(appts, (a) => a.calendarName),
    upcoming,
  };
}

export function computeConversations(convs: ConversationItem[]): ConversationsSummary {
  return {
    kpis: { total: convs.length, unread: convs.reduce((s, c) => s + (c.unread > 0 ? 1 : 0), 0) },
    byChannel: countBy(convs, (c) => c.channel),
    recent: convs.slice(0, 8),
  };
}

const OPP_STATUS_LABEL: Record<string, string> = {
  open: "Aberto",
  won: "Ganho",
  lost: "Perdido",
  abandoned: "Abandonado",
};

export interface OppLike {
  status?: string;
  monetaryValue?: number;
  pipelineId: string;
}

export function computeOppRevenue(opps: OppLike[], pipelineNames: Map<string, string>): OppRevenue {
  let openValue = 0;
  let wonValue = 0;
  let openCount = 0;
  let wonCount = 0;
  const byPipeline = new Map<string, number>();
  const byStatus = new Map<string, number>();
  for (const o of opps) {
    const status = (o.status ?? "open").toLowerCase();
    const value = o.monetaryValue ?? 0;
    byStatus.set(OPP_STATUS_LABEL[status] ?? status, (byStatus.get(OPP_STATUS_LABEL[status] ?? status) ?? 0) + 1);
    if (status === "won") {
      wonValue += value;
      wonCount++;
    }
    if (status === "open") {
      openValue += value;
      openCount++;
      const name = pipelineNames.get(o.pipelineId) ?? "Pipeline";
      byPipeline.set(name, (byPipeline.get(name) ?? 0) + value);
    }
  }
  return {
    kpis: { openValue, wonValue, openCount, wonCount },
    byPipeline: [...byPipeline.entries()].map(([label, value]) => ({ label, value })),
    byStatus: [...byStatus.entries()].map(([label, value]) => ({ label, value })),
  };
}

export interface ActivityParams {
  locationId: string;
  tenant: TenantConfig;
  from?: string;
  to?: string;
}

export async function getActivity(params: ActivityParams): Promise<ActivitySummary> {
  const { locationId, tenant } = params;
  const startMs = params.from ? new Date(`${params.from}T00:00:00`).getTime() : Date.now() - 30 * 86400000;
  const endMs = params.to ? new Date(`${params.to}T23:59:59`).getTime() : Date.now() + 60 * 86400000;

  const [appts, convs, pipelines] = await Promise.all([
    getAppointments(locationId, { startMs, endMs }).catch(() => [] as Appointment[]),
    getConversations(locationId).catch(() => [] as ConversationItem[]),
    getPipelines(locationId, tenant).catch(() => []),
  ]);

  const pipelineNames = new Map(pipelines.map((p) => [p.id, p.name]));
  const oppLists = await Promise.all(
    pipelines.map((p) => searchOpportunities({ locationId, pipelineId: p.id, limit: 100 }).then((r) => r.items).catch(() => [])),
  );
  const opps = oppLists.flat();

  return {
    appointments: computeAgenda(appts),
    conversations: computeConversations(convs),
    opportunities: computeOppRevenue(opps, pipelineNames),
  };
}
