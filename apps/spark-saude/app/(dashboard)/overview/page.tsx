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
import { humanizeTag, isAttentionTag } from "@/lib/labels";

export default function OverviewPage() {
  const q = useQuery({ queryKey: ["overview"], queryFn: api.overview });

  return (
    <div>
      <PageHeader
        title="Visão geral"
        description="Resumo da carteira de saúde e o que precisa de atenção hoje."
      />

      {q.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[92px] w-full" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : q.data ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {q.data.metrics.map((m, i) => (
            <StatCard key={m.key} label={m.label} value={m.value} accent={i === 1} />
          ))}
        </div>
      ) : null}

      <Card className="mt-6">
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
