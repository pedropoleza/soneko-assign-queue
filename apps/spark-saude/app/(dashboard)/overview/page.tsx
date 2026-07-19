"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import { PageHeader } from "@/components/shell/page-header";
import { StatCard } from "@/components/overview/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingRows, ErrorState, EmptyState } from "@/components/ui/data-state";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChartCard } from "@/components/charts/chart-card";
import { DonutChart } from "@/components/charts/donut-chart";
import { ColumnChart } from "@/components/charts/column-chart";
import { HBarChart } from "@/components/charts/h-bar-chart";
import { planoColors, colorsByMap, DOC_COLORS } from "@/components/charts/palette";
import { humanizeTag, isAttentionTag } from "@/lib/labels";
import { formatMoneyBR } from "@/lib/utils";
import type { ChartDatum } from "@/lib/types";

function ChartEmpty({ label }: { label: string }) {
  return <div className="flex h-[176px] items-center justify-center text-sm text-muted-foreground">{label}</div>;
}

export default function OverviewPage() {
  const q = useQuery({ queryKey: ["overview"], queryFn: api.overview });

  return (
    <div className="space-y-5">
      <PageHeader title="Visão geral" description="Panorama da carteira de saúde, renovações e receita." />

      {/* KPI row */}
      {q.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] w-full" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : q.data ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Clientes ativos" value={q.data.kpis.activeClients} hint={`${q.data.kpis.totalClients} na carteira`} />
            <StatCard label="Receita mensal" value={formatMoneyBR(q.data.kpis.mrr)} hint="Soma dos prêmios ativos" accent />
            <StatCard label="Renovações (60 dias)" value={q.data.kpis.upcomingRenewals} hint="Próximas do vencimento" />
            <StatCard label="Aguardando aprovação" value={q.data.kpis.awaitingApproval} hint={`${q.data.kpis.applicationsInProgress} em andamento`} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartCard title="Renovações por mês" subtitle="Próximos 6 meses" className="lg:col-span-2">
              {q.data.renewalsByMonth.some((d: ChartDatum) => d.value > 0) ? (
                <ColumnChart data={q.data.renewalsByMonth} />
              ) : (
                <ChartEmpty label="Sem renovações datadas ainda" />
              )}
            </ChartCard>

            <ChartCard title="Distribuição por plano">
              {q.data.byPlano.length ? (
                <DonutChart data={q.data.byPlano} colors={planoColors(q.data.byPlano.map((d) => d.label))} centerLabel="Clientes" />
              ) : (
                <ChartEmpty label="Sem planos preenchidos" />
              )}
            </ChartCard>

            <ChartCard title="Carteira por seguradora" className="lg:col-span-2">
              {q.data.bySeguradora.length ? (
                <HBarChart data={q.data.bySeguradora} />
              ) : (
                <ChartEmpty label="Sem seguradora preenchida" />
              )}
            </ChartCard>

            <ChartCard title="Documentação" subtitle="Status dos documentos">
              {q.data.docStatus.length ? (
                <DonutChart data={q.data.docStatus} colors={colorsByMap(q.data.docStatus.map((d) => d.label), DOC_COLORS)} centerLabel="Clientes" />
              ) : (
                <ChartEmpty label="Sem dados de documentação" />
              )}
            </ChartCard>
          </div>
        </>
      ) : null}

      {/* Attention */}
      <Card>
        <CardHeader>
          <CardTitle>Precisa de atenção</CardTitle>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <LoadingRows rows={4} />
          ) : q.isError || !q.data ? null : q.data.attention.length === 0 ? (
            <EmptyState title="Nada pendente" hint="Nenhum contato com tags de atenção no momento." />
          ) : (
            <ul className="divide-y">
              {q.data.attention.map((c) => (
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
    </div>
  );
}
