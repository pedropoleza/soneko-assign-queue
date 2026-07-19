"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { addDays, startOfMonth, startOfYear } from "date-fns";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api, ghlContactUrl } from "@/lib/client/api";
import { PageHeader } from "@/components/shell/page-header";
import { StatCard } from "@/components/overview/stat-card";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/data-state";
import { DateRangeFilter, type DateRangeValue, type DatePreset } from "@/components/ui/date-range-filter";
import { ChartCard } from "@/components/charts/chart-card";
import { DonutChart } from "@/components/charts/donut-chart";
import { HBarChart } from "@/components/charts/h-bar-chart";
import { colorsByMap, categoricalFor } from "@/components/charts/palette";
import { formatMoneyBR } from "@/lib/utils";

const isoDay = (d: Date) => {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
};

function buildPresets(): DatePreset[] {
  const today = new Date();
  return [
    { key: "all", label: "Todo o período", compute: () => ({}) },
    { key: "7", label: "Últimos 7 dias", compute: () => ({ from: isoDay(addDays(today, -7)), to: isoDay(today) }) },
    { key: "30", label: "Últimos 30 dias", compute: () => ({ from: isoDay(addDays(today, -30)), to: isoDay(today) }) },
    { key: "90", label: "Últimos 90 dias", compute: () => ({ from: isoDay(addDays(today, -90)), to: isoDay(today) }) },
    { key: "thisMonth", label: "Este mês", compute: () => ({ from: isoDay(startOfMonth(today)), to: isoDay(today) }) },
    { key: "thisYear", label: "Este ano", compute: () => ({ from: isoDay(startOfYear(today)), to: isoDay(today) }) },
  ];
}

const APPT_COLORS: Record<string, string> = {
  Confirmado: "#12B76A",
  Compareceu: "#0e9f6e",
  Novo: "#155EEF",
  "No-show": "#F04438",
  Cancelado: "#98A2B3",
  Inválido: "#98A2B3",
};
const OPP_COLORS: Record<string, string> = {
  Aberto: "#155EEF",
  Ganho: "#12B76A",
  Perdido: "#F04438",
  Abandonado: "#98A2B3",
};

const fmtDT = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

function apptTone(s: string): BadgeProps["tone"] {
  if (s === "No-show") return "red";
  if (s === "Cancelado") return "gray";
  if (s === "Confirmado" || s === "Compareceu") return "green";
  return "blue";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export default function ActivityPage() {
  const presets = React.useMemo(buildPresets, []);
  const [range, setRange] = React.useState<DateRangeValue>({ key: "all", label: "Todo o período" });
  const config = useQuery({ queryKey: ["config"], queryFn: api.config, staleTime: Infinity });
  const q = useQuery({
    queryKey: ["activity", range.key, range.from, range.to],
    queryFn: () => api.activity({ from: range.from, to: range.to }),
    placeholderData: keepPreviousData,
  });
  const ghlUrlFor = (cid?: string) => (cid ? ghlContactUrl(config.data, cid) : undefined);

  const a = q.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Atividade"
        description="Agenda, conversas e receita da subconta."
        actions={<DateRangeFilter value={range} onChange={setRange} presets={presets} />}
      />

      {q.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[112px] w-full" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : a ? (
        <div className={`space-y-6 ${q.isFetching ? "opacity-70 transition-opacity" : ""}`}>
          {/* AGENDA */}
          <Section title="Agenda">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Agendamentos" value={a.appointments.kpis.total} hint="No período" accent />
              <StatCard label="Confirmados" value={a.appointments.kpis.confirmados} />
              <StatCard label="Compareceram" value={a.appointments.kpis.compareceu} />
              <StatCard label="No-show" value={a.appointments.kpis.noShow} hint={`${a.appointments.kpis.cancelados} cancelados`} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <ChartCard title="Por status">
                {a.appointments.byStatus.length ? (
                  <DonutChart data={a.appointments.byStatus} colors={colorsByMap(a.appointments.byStatus.map((d) => d.label), APPT_COLORS)} centerLabel="Agend." />
                ) : (
                  <div className="flex h-[176px] items-center justify-center text-sm text-muted-foreground">Sem agendamentos</div>
                )}
              </ChartCard>
              <ChartCard title="Por calendário">
                {a.appointments.byCalendar.length ? (
                  <HBarChart data={a.appointments.byCalendar} />
                ) : (
                  <div className="flex h-[176px] items-center justify-center text-sm text-muted-foreground">—</div>
                )}
              </ChartCard>
              <Card className="flex flex-col">
                <div className="border-b px-5 py-3">
                  <h3 className="text-sm font-semibold tracking-tight">Próximos</h3>
                </div>
                <div className="max-h-[220px] flex-1 overflow-y-auto">
                  {a.appointments.upcoming.length === 0 ? (
                    <div className="p-4">
                      <EmptyState title="Nada agendado" />
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {a.appointments.upcoming.map((ap) => (
                        <li key={ap.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{ap.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{fmtDT(ap.startTime)}</p>
                          </div>
                          <Badge tone={apptTone(ap.status)}>{ap.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            </div>
          </Section>

          {/* CONVERSAS */}
          <Section title="Conversas">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Conversas" value={a.conversations.kpis.total} hint="No período" accent />
              <StatCard label="Não lidas" value={a.conversations.kpis.unread} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <ChartCard title="Por canal">
                {a.conversations.byChannel.length ? (
                  <DonutChart data={a.conversations.byChannel} colors={categoricalFor(a.conversations.byChannel.map((d) => d.label))} centerLabel="Conversas" />
                ) : (
                  <div className="flex h-[176px] items-center justify-center text-sm text-muted-foreground">Sem conversas</div>
                )}
              </ChartCard>
              <Card className="flex flex-col lg:col-span-2">
                <div className="border-b px-5 py-3">
                  <h3 className="text-sm font-semibold tracking-tight">Recentes</h3>
                </div>
                <div className="max-h-[240px] flex-1 overflow-y-auto">
                  {a.conversations.recent.length === 0 ? (
                    <div className="p-4">
                      <EmptyState title="Sem conversas recentes" />
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {a.conversations.recent.map((cv) => {
                        const url = ghlUrlFor(cv.contactId);
                        return (
                          <li key={cv.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{cv.name}</p>
                              <p className="truncate text-xs text-muted-foreground">{cv.channel} · {fmtDT(cv.lastAt)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {cv.unread > 0 ? <Badge tone="blue">{cv.unread} não lida</Badge> : null}
                              {url ? (
                                <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir no GHL" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </Card>
            </div>
          </Section>

          {/* RECEITA */}
          <Section title="Receita — negócios">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Em aberto" value={formatMoneyBR(a.opportunities.kpis.openValue)} hint={`${a.opportunities.kpis.openCount} negócios`} accent />
              <StatCard label="Ganho" value={formatMoneyBR(a.opportunities.kpis.wonValue)} hint={`${a.opportunities.kpis.wonCount} fechados`} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <ChartCard title="Valor em aberto por pipeline" className="lg:col-span-2">
                {a.opportunities.byPipeline.length ? (
                  <HBarChart data={a.opportunities.byPipeline} valueFormat={(n) => formatMoneyBR(n)} />
                ) : (
                  <div className="flex h-[176px] items-center justify-center text-sm text-muted-foreground">Sem negócios em aberto</div>
                )}
              </ChartCard>
              <ChartCard title="Negócios por status">
                {a.opportunities.byStatus.length ? (
                  <DonutChart data={a.opportunities.byStatus} colors={colorsByMap(a.opportunities.byStatus.map((d) => d.label), OPP_COLORS)} centerLabel="Negócios" />
                ) : (
                  <div className="flex h-[176px] items-center justify-center text-sm text-muted-foreground">Sem negócios</div>
                )}
              </ChartCard>
            </div>
          </Section>
        </div>
      ) : null}
    </div>
  );
}
