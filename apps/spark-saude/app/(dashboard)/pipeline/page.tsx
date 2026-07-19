"use client";

import { useQuery } from "@tanstack/react-query";
import { api, ghlContactUrl } from "@/lib/client/api";
import { PageHeader } from "@/components/shell/page-header";
import { PipelineFunnel } from "@/components/pipeline/pipeline-funnel";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/data-state";

export default function PipelinePage() {
  const q = useQuery({ queryKey: ["pipeline"], queryFn: api.pipeline });
  const config = useQuery({ queryKey: ["config"], queryFn: api.config, staleTime: Infinity });

  const ghlUrlFor = (contactId?: string) => (contactId ? ghlContactUrl(config.data, contactId) : undefined);

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description="Onde estão os negócios em cada etapa dos dois funis — Aquisição e Cliente."
      />

      {q.isLoading ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : !q.data || q.data.length === 0 ? (
        <EmptyState title="Nenhuma pipeline encontrada" hint="Verifique as pipelines configuradas nesta location do GHL." />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {q.data.map((view) => (
            <PipelineFunnel key={view.pipeline.id} view={view} ghlUrlFor={ghlUrlFor} />
          ))}
        </div>
      )}
    </div>
  );
}
