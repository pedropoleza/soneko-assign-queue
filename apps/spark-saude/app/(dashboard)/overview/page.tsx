"use client";

import * as React from "react";
import Link from "next/link";
import { addDays, startOfMonth, startOfYear } from "date-fns";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api, ghlContactUrl } from "@/lib/client/api";
import * as A from "@/lib/analytics";
import type { DrillSpec } from "@/lib/analytics";
import { PageHeader } from "@/components/shell/page-header";
import { StatCard } from "@/components/overview/stat-card";
import { DrillDrawer } from "@/components/overview/drill-drawer";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/data-state";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DateRangeFilter, type DateRangeValue, type DatePreset } from "@/components/ui/date-range-filter";
import { ChartDateFilter } from "@/components/ui/chart-date-filter";
import { ChartCard } from "@/components/charts/chart-card";
import { DonutChart } from "@/components/charts/donut-chart";
import { ColumnChart } from "@/components/charts/column-chart";
import { HBarChart } from "@/components/charts/h-bar-chart";
import { PipelineFunnel } from "@/components/pipeline/pipeline-funnel";
import { ActivitySections } from "@/components/activity/activity-sections";
import { planoColors, colorsByMap, categoricalFor, DOC_COLORS, RENEWAL_COLORS } from "@/components/charts/palette";
import { humanizeTag, isAttentionTag } from "@/lib/labels";
import { formatMoneyBR } from "@/lib/utils";
import type { Contact } from "@/lib/types";

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

function ChartEmpty({ label }: { label: string }) {
  return <div className="flex h-[176px] items-center justify-center text-center text-sm text-muted-foreground">{label}</div>;
}

export default function OverviewPage() {
  const presets = React.useMemo(buildPresets, []);
  const [range, setRange] = React.useState<DateRangeValue>({ key: "all", label: "Todo o período" });
  const [chartRanges, setChartRanges] = React.useState<Record<string, DateRangeValue | null>>({});
  const [drill, setDrill] = React.useState<{ title: string; contacts: Contact[] } | null>(null);

  const book = useQuery({ queryKey: ["book"], queryFn: api.book, staleTime: 60_000 });
  const config = useQuery({ queryKey: ["config"], queryFn: api.config, staleTime: Infinity });
  const pipeline = useQuery({ queryKey: ["pipeline"], queryFn: api.pipeline });
  const activity = useQuery({
    queryKey: ["activity", range.key, range.from, range.to],
    queryFn: () => api.activity({ from: range.from, to: range.to }),
    placeholderData: keepPreviousData,
  });

  const contacts = book.data?.contacts ?? [];
  const cfg = config.data;
  const tags = cfg?.tags;

  const globalFiltered = React.useMemo(
    () => A.filterByDateAdded(contacts, range.from, range.to),
    [contacts, range.from, range.to],
  );

  const dataFor = React.useCallback(
    (id: string) => {
      const r = chartRanges[id];
      if (!r) return globalFiltered;
      return A.filterByDateAdded(contacts, r.from, r.to);
    },
    [chartRanges, contacts, globalFiltered],
  );

  const kpis = tags ? A.computeKpis(globalFiltered, tags) : null;

  const openDrill = (spec: DrillSpec, source: Contact[]) => {
    if (!tags) return;
    setDrill(A.drill(source, spec, tags, tags.attention));
  };
  const ghlUrlFor = (cid?: string) => (cid ? ghlContactUrl(cfg, cid) : undefined);

  const chartFilter = (id: string) => (
    <ChartDateFilter
      value={chartRanges[id] ?? null}
      global={range}
      onChange={(v) => setChartRanges((s) => ({ ...s, [id]: v }))}
      presets={presets}
    />
  );

  const loading = book.isLoading || config.isLoading;
  const attention = tags ? A.attention(globalFiltered, tags.attention) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão geral"
        description="Panorama da carteira. Clique em qualquer número ou fatia para listar os contatos."
        actions={<DateRangeFilter value={range} onChange={setRange} presets={presets} />}
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[112px] w-full" />
          ))}
        </div>
      ) : book.isError || config.isError ? (
        <ErrorState message={((book.error || config.error) as Error)?.message} onRetry={() => book.refetch()} />
      ) : kpis ? (
        <>
          {/* KPIs — clickable */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Clientes ativos" value={kpis.activeClients} hint={`${kpis.totalClients} na carteira`} onClick={() => openDrill({ kind: "kpi", metric: "active" }, globalFiltered)} />
            <StatCard label="Receita mensal" value={formatMoneyBR(kpis.mrr)} hint="Soma dos prêmios ativos" accent onClick={() => openDrill({ kind: "kpi", metric: "mrr" }, globalFiltered)} />
            <StatCard label="Renovações (60 dias)" value={kpis.upcomingRenewals} hint="Próximas do vencimento" onClick={() => openDrill({ kind: "kpi", metric: "renewals60" }, globalFiltered)} />
            <StatCard label="Aguardando aprovação" value={kpis.awaitingApproval} hint={`${kpis.applicationsInProgress} em andamento`} onClick={() => openDrill({ kind: "kpi", metric: "awaiting" }, globalFiltered)} />
          </div>

          {/* Charts — each with its own filter + drill on click */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartCard title="Renovações por mês" subtitle="Próximos 6 meses" className="lg:col-span-2" right={chartFilter("renewals")}>
              {A.renewalsByMonth(dataFor("renewals")).some((d) => d.value > 0) ? (
                <ColumnChart
                  data={A.renewalsByMonth(dataFor("renewals"))}
                  onSelect={(i, label) => openDrill({ kind: "renewalMonth", month: i, label }, dataFor("renewals"))}
                />
              ) : (
                <ChartEmpty label="Sem renovações datadas no período" />
              )}
            </ChartCard>

            <ChartCard title="Distribuição por plano" right={chartFilter("plano")}>
              {A.byPlano(dataFor("plano")).length ? (
                <DonutChart
                  data={A.byPlano(dataFor("plano"))}
                  colors={planoColors(A.byPlano(dataFor("plano")).map((d) => d.label))}
                  centerLabel="Clientes"
                  onSelect={(v) => openDrill({ kind: "plano", value: v }, dataFor("plano"))}
                />
              ) : (
                <ChartEmpty label="Sem planos no período" />
              )}
            </ChartCard>

            <ChartCard title="Carteira por seguradora" className="lg:col-span-2" right={chartFilter("seguradora")}>
              {A.bySeguradora(dataFor("seguradora")).length ? (
                <HBarChart
                  data={A.bySeguradora(dataFor("seguradora"))}
                  onSelect={(v) => openDrill({ kind: "seguradora", value: v }, dataFor("seguradora"))}
                />
              ) : (
                <ChartEmpty label="Sem seguradora no período" />
              )}
            </ChartCard>

            <ChartCard title="Documentação" subtitle="Status dos documentos" right={chartFilter("doc")}>
              {A.docStatus(dataFor("doc")).length ? (
                <DonutChart
                  data={A.docStatus(dataFor("doc"))}
                  colors={colorsByMap(A.docStatus(dataFor("doc")).map((d) => d.label), DOC_COLORS)}
                  centerLabel="Clientes"
                  onSelect={(v) => openDrill({ kind: "doc", value: v }, dataFor("doc"))}
                />
              ) : (
                <ChartEmpty label="Sem dados de documentação" />
              )}
            </ChartCard>

            <ChartCard title="Novos clientes por mês" subtitle="Últimos 6 meses" className="lg:col-span-2" right={chartFilter("novos")}>
              {A.newByMonth(dataFor("novos")).some((d) => d.value > 0) ? (
                <ColumnChart data={A.newByMonth(dataFor("novos"))} />
              ) : (
                <ChartEmpty label="Sem novos contatos no período" />
              )}
            </ChartCard>

            <ChartCard title="Origem dos contatos" right={chartFilter("origem")}>
              {A.byOrigem(dataFor("origem")).length ? (
                <DonutChart
                  data={A.byOrigem(dataFor("origem"))}
                  colors={categoricalFor(A.byOrigem(dataFor("origem")).map((d) => d.label))}
                  centerLabel="Contatos"
                  onSelect={(v) => openDrill({ kind: "origem", value: v }, dataFor("origem"))}
                />
              ) : (
                <ChartEmpty label="Sem origem marcada no período" />
              )}
            </ChartCard>

            <ChartCard title="Receita por seguradora" subtitle="Prêmio mensal (ativos)" className="lg:col-span-2" right={chartFilter("mrrseg")}>
              {tags && A.mrrBySeguradora(dataFor("mrrseg"), tags).length ? (
                <HBarChart
                  data={A.mrrBySeguradora(dataFor("mrrseg"), tags)}
                  valueFormat={(n) => formatMoneyBR(n)}
                  onSelect={(v) => openDrill({ kind: "mrrSeguradora", value: v }, dataFor("mrrseg"))}
                />
              ) : (
                <ChartEmpty label="Sem prêmios ativos no período" />
              )}
            </ChartCard>

            <ChartCard title="Status das renovações" right={chartFilter("renovstatus")}>
              {tags && A.renewalStatusDist(dataFor("renovstatus"), tags).length ? (
                <DonutChart
                  data={A.renewalStatusDist(dataFor("renovstatus"), tags)}
                  colors={colorsByMap(A.renewalStatusDist(dataFor("renovstatus"), tags).map((d) => d.label), RENEWAL_COLORS)}
                  centerLabel="Com renovação"
                  onSelect={(v) => openDrill({ kind: "renewalStatus", value: v }, dataFor("renovstatus"))}
                />
              ) : (
                <ChartEmpty label="Sem renovações datadas no período" />
              )}
            </ChartCard>

            <ChartCard title="Faixa de prêmio mensal" subtitle="Distribuição da carteira" className="lg:col-span-3" right={chartFilter("faixa")}>
              {A.premiumBands(dataFor("faixa")).some((d) => d.value > 0) ? (
                <ColumnChart
                  data={A.premiumBands(dataFor("faixa"))}
                  onSelect={(_i, label) => openDrill({ kind: "premiumBand", value: label }, dataFor("faixa"))}
                />
              ) : (
                <ChartEmpty label="Sem prêmios preenchidos no período" />
              )}
            </ChartCard>
          </div>
        </>
      ) : null}

      {/* Pipeline */}
      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-tight">Pipeline</h2>
        {pipeline.isLoading ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-full" />
            ))}
          </div>
        ) : pipeline.isError ? (
          <ErrorState message={(pipeline.error as Error).message} onRetry={() => pipeline.refetch()} />
        ) : pipeline.data && pipeline.data.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {pipeline.data.map((view) => (
              <PipelineFunnel key={view.pipeline.id} view={view} ghlUrlFor={ghlUrlFor} />
            ))}
          </div>
        ) : (
          <EmptyState title="Nenhuma pipeline encontrada" hint="Verifique as pipelines configuradas nesta location." />
        )}
      </section>

      {/* Atividade — Agenda · Conversas · Receita */}
      {activity.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[112px] w-full" />
          ))}
        </div>
      ) : activity.isError ? (
        <ErrorState message={(activity.error as Error).message} onRetry={() => activity.refetch()} />
      ) : activity.data ? (
        <div className={`space-y-6 ${activity.isFetching ? "opacity-70 transition-opacity" : ""}`}>
          <ActivitySections data={activity.data} ghlUrlFor={ghlUrlFor} />
        </div>
      ) : null}

      {/* Attention */}
      <Card>
        <CardHeader>
          <CardTitle>Precisa de atenção</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : attention.length === 0 ? (
            <EmptyState title="Nada pendente" hint="Nenhum contato com tags de atenção no período." />
          ) : (
            <ul className="divide-y">
              {attention.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={c.name} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.email || c.phone || "—"}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {c.tags.filter(isAttentionTag).map((t) => (
                      <Badge key={t} tone="amber">
                        {humanizeTag(t)}
                      </Badge>
                    ))}
                    <Link href={`/clients?contact=${c.id}`} className="ml-1 text-xs font-medium text-primary hover:underline">
                      Abrir
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <DrillDrawer
        open={drill !== null}
        onOpenChange={(o) => !o && setDrill(null)}
        title={drill?.title ?? ""}
        contacts={drill?.contacts ?? []}
        config={cfg}
      />
    </div>
  );
}
