"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";
import { StatCard } from "@/components/overview/stat-card";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/data-state";
import { ChartCard } from "@/components/charts/chart-card";
import { SectionHeader } from "@/components/shell/section-header";
import { DonutChart } from "@/components/charts/donut-chart";
import { HBarChart } from "@/components/charts/h-bar-chart";
import { colorsByMap, categoricalFor } from "@/components/charts/palette";
import { formatMoneyBR } from "@/lib/utils";
import type { ActivitySummary } from "@/lib/types";

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

function ChartEmpty({ label }: { label: string }) {
  return <div className="flex h-[176px] items-center justify-center text-sm text-muted-foreground">{label}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <SectionHeader title={title} className="mb-4" />
      {children}
    </section>
  );
}

/** The Agenda · Conversas · Receita blocks, embedded in the main dashboard. */
export function ActivitySections({
  data: a,
  ghlUrlFor,
}: {
  data: ActivitySummary;
  ghlUrlFor: (contactId?: string) => string | undefined;
}) {
  return (
    <>
      <Section title="Agenda">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Agendamentos" value={a.appointments.kpis.total} hint="No período" accent />
          <StatCard label="Confirmados" value={a.appointments.kpis.confirmados} />
          <StatCard label="Compareceram" value={a.appointments.kpis.compareceu} />
          <StatCard label="No-show" value={a.appointments.kpis.noShow} hint={`${a.appointments.kpis.cancelados} cancelados`} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard title="Por status" info="Agendamentos do período distribuídos pelo status no GHL: confirmado, compareceu, no-show e cancelado.">
            {a.appointments.byStatus.length ? (
              <DonutChart data={a.appointments.byStatus} colors={colorsByMap(a.appointments.byStatus.map((d) => d.label), APPT_COLORS)} centerLabel="Agend." />
            ) : (
              <ChartEmpty label="Sem agendamentos" />
            )}
          </ChartCard>
          <ChartCard title="Por calendário" info="Volume de agendamentos por calendário do GHL (ex.: Consulta Inicial, Apresentação & Fechamento).">
            {a.appointments.byCalendar.length ? <HBarChart data={a.appointments.byCalendar} /> : <ChartEmpty label="—" />}
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

      <Section title="Conversas">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Conversas" value={a.conversations.kpis.total} hint="No período" accent />
          <StatCard label="Não lidas" value={a.conversations.kpis.unread} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard title="Por canal" info="Conversas do período agrupadas pelo canal de origem no GHL (WhatsApp, SMS, e-mail, etc.).">
            {a.conversations.byChannel.length ? (
              <DonutChart data={a.conversations.byChannel} colors={categoricalFor(a.conversations.byChannel.map((d) => d.label))} centerLabel="Conversas" />
            ) : (
              <ChartEmpty label="Sem conversas" />
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

      <Section title="Receita — negócios">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Em aberto" value={formatMoneyBR(a.opportunities.kpis.openValue)} hint={`${a.opportunities.kpis.openCount} negócios`} accent />
          <StatCard label="Ganho" value={formatMoneyBR(a.opportunities.kpis.wonValue)} hint={`${a.opportunities.kpis.wonCount} fechados`} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard title="Valor em aberto por pipeline" info="Soma do valor monetário dos negócios (opportunities) ainda abertos, agrupada por pipeline do GHL." className="lg:col-span-2">
            {a.opportunities.byPipeline.length ? (
              <HBarChart data={a.opportunities.byPipeline} valueFormat={(n) => formatMoneyBR(n)} />
            ) : (
              <ChartEmpty label="Sem negócios em aberto" />
            )}
          </ChartCard>
          <ChartCard title="Negócios por status" info="Negócios (opportunities) distribuídos pelo status: aberto, ganho, perdido e abandonado.">
            {a.opportunities.byStatus.length ? (
              <DonutChart data={a.opportunities.byStatus} colors={colorsByMap(a.opportunities.byStatus.map((d) => d.label), OPP_COLORS)} centerLabel="Negócios" />
            ) : (
              <ChartEmpty label="Sem negócios" />
            )}
          </ChartCard>
        </div>
      </Section>
    </>
  );
}
