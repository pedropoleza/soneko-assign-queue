"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { LoadingRows, ErrorState, EmptyState } from "@/components/ui/data-state";
import { RenewalsTable } from "@/components/renewals/renewals-table";

type Window = 30 | 60 | 90;

export default function RenewalsPage() {
  const [within, setWithin] = React.useState<Window>(60);
  const q = useQuery({ queryKey: ["renewals", within], queryFn: () => api.renewals(within) });

  const count = q.data?.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Renovações"
        description="Clientes com renovação próxima, por data. Marque avisado ou puxe para renovação pendente."
        actions={
          <Segmented<Window>
            value={within}
            onChange={setWithin}
            options={[
              { label: "30 dias", value: 30 },
              { label: "60 dias", value: 60 },
              { label: "90 dias", value: 90 },
            ]}
          />
        }
      />

      <Card>
        <div className="flex items-center justify-between border-b px-5 py-3">
          <p className="text-sm font-medium">
            {q.isSuccess ? `${count} ${count === 1 ? "renovação" : "renovações"} em até ${within} dias` : "Renovações"}
          </p>
        </div>
        <div className="p-3">
          {q.isLoading ? (
            <LoadingRows rows={6} />
          ) : q.isError ? (
            <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
          ) : !q.data || count === 0 ? (
            <EmptyState
              title="Nenhuma renovação nessa janela"
              hint={`Nenhum cliente com data de renovação nos próximos ${within} dias.`}
            />
          ) : (
            <RenewalsTable items={q.data} />
          )}
        </div>
      </Card>
    </div>
  );
}
