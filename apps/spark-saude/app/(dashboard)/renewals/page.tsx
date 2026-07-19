"use client";

import * as React from "react";
import { addDays, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { DateRangeFilter, type DateRangeValue, type DatePreset } from "@/components/ui/date-range-filter";
import { LoadingRows, ErrorState, EmptyState } from "@/components/ui/data-state";
import { RenewalsTable } from "@/components/renewals/renewals-table";

const isoDay = (d: Date) => {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
};

function buildPresets(): DatePreset[] {
  const today = new Date();
  return [
    { key: "30", label: "Próximos 30 dias", compute: () => ({ to: isoDay(addDays(today, 30)) }) },
    { key: "60", label: "Próximos 60 dias", compute: () => ({ to: isoDay(addDays(today, 60)) }) },
    { key: "90", label: "Próximos 90 dias", compute: () => ({ to: isoDay(addDays(today, 90)) }) },
    { key: "thisMonth", label: "Este mês", compute: () => ({ from: isoDay(startOfMonth(today)), to: isoDay(endOfMonth(today)) }) },
    {
      key: "nextMonth",
      label: "Próximo mês",
      compute: () => ({ from: isoDay(startOfMonth(addMonths(today, 1))), to: isoDay(endOfMonth(addMonths(today, 1))) }),
    },
  ];
}

export default function RenewalsPage() {
  const presets = React.useMemo(buildPresets, []);
  const [range, setRange] = React.useState<DateRangeValue>(() => ({
    key: "60",
    label: "Próximos 60 dias",
    to: isoDay(addDays(new Date(), 60)),
  }));

  const q = useQuery({
    queryKey: ["renewals", range.key, range.from, range.to],
    queryFn: () => api.renewals({ from: range.from, to: range.to }),
  });

  const count = q.data?.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Renovações"
        description="Clientes com renovação por data de vencimento. Marque avisado ou puxe para renovação pendente."
        actions={<DateRangeFilter value={range} onChange={setRange} presets={presets} />}
      />

      <Card>
        <div className="flex items-center justify-between border-b px-5 py-3">
          <p className="text-sm font-medium">
            {q.isSuccess
              ? `${count} ${count === 1 ? "renovação" : "renovações"} · ${range.label.toLowerCase()}`
              : "Renovações"}
          </p>
        </div>
        <div className="p-3">
          {q.isLoading ? (
            <LoadingRows rows={6} />
          ) : q.isError ? (
            <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
          ) : !q.data || count === 0 ? (
            <EmptyState
              title="Nenhuma renovação nesse período"
              hint="Ajuste o filtro de datas para ver outras janelas de vencimento."
            />
          ) : (
            <RenewalsTable items={q.data} />
          )}
        </div>
      </Card>
    </div>
  );
}
